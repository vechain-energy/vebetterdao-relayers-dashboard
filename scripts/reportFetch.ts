import { ABIContract, Hex } from "@vechain/sdk-core";
import { ThorClient } from "@vechain/sdk-network";
import {
  XAllocationVoting__factory,
  VoterRewards__factory,
  RelayerRewardsPool__factory,
  Emissions__factory,
} from "@vechain/vebetterdao-contracts/typechain-types";
import type Database from "better-sqlite3";

import { getMainnetNodeUrl } from "../src/config/nodeUrls";
import {
  getStoredActionRoundId,
  getStoredClaimRoundId,
  selectClaimableSnapshotRefreshRounds,
} from "../src/lib/reporting/pipeline";

import { openDatabase, getMeta, setMeta } from "./reportDb";

const FIRST_AUTO_VOTING_ROUND = 69;
const FINALITY_MARGIN = 10;
const mainnetConfig = {
  xAllocationVotingContractAddress:
    "0x89A00Bb0947a30FF95BEeF77a66AEdE3842Fe5B7",
  relayerRewardsPoolContractAddress:
    "0x34b56f892c9e977b9ba2e43ba64c27d368ab3c86",
  voterRewardsContractAddress: "0x838A33AF756a6366f93e201423E1425f67eC0Fa7",
  emissionsContractAddress: "0xDf94739bd169C84fe6478D8420Bb807F1f47b135",
};

const AMOUNT_SCALE = BigInt(1_000_000_000); // store in 1e9-wei units for SQLite
function scaleDownWeiToDbUnits(amountWei: bigint): bigint {
  return amountWei / AMOUNT_SCALE;
}


interface LogMeta {
  txID?: string;
  blockNumber?: number;
}

function normalizeAddress(addr: string): string {
  return addr.toLowerCase();
}

function ensureInteger(value: bigint | number | string | undefined): bigint {
  if (value === undefined) return BigInt(0);
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.trunc(value));
  return BigInt(value);
}

async function getLatestBlock(thor: ThorClient): Promise<number> {
  const best = await thor.blocks.getBestBlockCompressed();
  return Number(best?.number ?? 0);
}

async function getCurrentRoundId(
  thor: ThorClient,
  contractAddress: string,
): Promise<number> {
  const xAllocationVotingContract = ABIContract.ofAbi(
    XAllocationVoting__factory.abi,
  );
  const result = await thor.contracts.executeCall(
    contractAddress,
    xAllocationVotingContract.getFunction("currentRoundId"),
    [],
  );
  if (!result.success) {
    throw new Error("Failed to get current round ID");
  }
  return Number(result.result?.array?.[0] ?? 0);
}

async function getRoundSnapshot(
  thor: ThorClient,
  contractAddress: string,
  roundId: number,
): Promise<number> {
  const xAllocationVotingContract = ABIContract.ofAbi(
    XAllocationVoting__factory.abi,
  );
  const result = await thor.contracts.executeCall(
    contractAddress,
    xAllocationVotingContract.getFunction("roundSnapshot"),
    [roundId],
  );
  if (!result.success) {
    throw new Error(`Failed to get round snapshot for round ${roundId}`);
  }
  return Number(result.result?.array?.[0] ?? 0);
}

async function getRoundDeadline(
  thor: ThorClient,
  contractAddress: string,
  roundId: number,
): Promise<number> {
  const xAllocationVotingContract = ABIContract.ofAbi(
    XAllocationVoting__factory.abi,
  );
  const result = await thor.contracts.executeCall(
    contractAddress,
    xAllocationVotingContract.getFunction("roundDeadline"),
    [roundId],
  );
  if (!result.success) {
    throw new Error(`Failed to get round deadline for round ${roundId}`);
  }
  return Number(result.result?.array?.[0] ?? 0);
}

async function getRoundSetupData(
  thor: ThorClient,
  contractAddress: string,
  roundId: number,
  fromBlock: number,
  toBlock: number,
): Promise<{ contractAutoVotingUsersCount: number; numRelayers: number }> {
  const relayerPoolContract = ABIContract.ofAbi(
    RelayerRewardsPool__factory.abi,
  );
  const actionsSetEvent = relayerPoolContract.getEvent(
    "TotalAutoVotingActionsSet",
  ) as any;

  const roundIdHex = "0x" + roundId.toString(16).padStart(64, "0");

  const logs = await thor.logs.filterEventLogs({
    range: {
      unit: "block" as const,
      from: fromBlock,
      to: toBlock,
    },
    options: {
      offset: 0,
      limit: 10,
    },
    order: "asc",
    criteriaSet: [
      {
        criteria: {
          address: contractAddress,
          topic0: actionsSetEvent.encodeFilterTopicsNoNull({})[0],
          topic1: roundIdHex,
        },
        eventAbi: actionsSetEvent,
      },
    ],
  });

  if (logs.length === 0) {
    return { contractAutoVotingUsersCount: 0, numRelayers: 0 };
  }

  const decodedData = actionsSetEvent.decodeEventLog({
    topics: logs[0].topics.map((topic: string) => Hex.of(topic)),
    data: Hex.of(logs[0].data),
  });

  return {
    contractAutoVotingUsersCount: Number(
      decodedData.args.totalAutoVoteUsers ?? 0,
    ),
    numRelayers: Number(decodedData.args.numRelayers ?? 0),
  };
}

function countActiveRelayersForRound(
  db: Database.Database,
  roundId: number,
): number {
  const row = db
    .prepare(
      `
      SELECT COUNT(DISTINCT relayer) AS cnt
      FROM relayer_actions
      WHERE round_id = ?
    `,
    )
    .get(roundId) as { cnt: bigint | number | string | undefined };

  if (typeof row?.cnt === "bigint") return Number(row.cnt);
  if (typeof row?.cnt === "number") return row.cnt;
  if (typeof row?.cnt === "string") return Number(row.cnt);
  return 0;
}

function getMutableRoundIds(db: Database.Database): number[] {
  const rows = db
    .prepare(
      `
      SELECT round_id
      FROM rounds
      WHERE round_id >= ?
        AND (
          COALESCE(is_round_ended, 0) = 0
          OR COALESCE(rewards_snapshot_finalized, 0) = 0
        )
      ORDER BY round_id ASC
    `,
    )
    .all(FIRST_AUTO_VOTING_ROUND) as { round_id: number }[]

  return rows.map((row) => Number(row.round_id))
}

function getTouchedClaimRoundsByBlockRange(
  db: Database.Database,
  fromBlock: number,
  toBlock: number,
): number[] {
  if (toBlock <= fromBlock) return []

  const rows = db
    .prepare(
      `
      SELECT DISTINCT ra.round_id AS round_id
      FROM relayer_actions ra
      JOIN transactions t ON t.tx_id = ra.tx_id
      WHERE ra.weight = 1 AND t.block_number > ? AND t.block_number <= ?
      UNION
      SELECT DISTINCT c.round_id AS round_id
      FROM claims c
      JOIN transactions t ON t.tx_id = c.tx_id
      WHERE t.block_number > ? AND t.block_number <= ?
      UNION
      SELECT DISTINCT rrc.round_id AS round_id
      FROM relayer_rewards_claimed rrc
      WHERE rrc.block_number IS NOT NULL AND rrc.block_number > ? AND rrc.block_number <= ?
      ORDER BY round_id ASC
    `,
    )
    .all(
      fromBlock,
      toBlock,
      fromBlock,
      toBlock,
      fromBlock,
      toBlock,
    ) as { round_id: number }[]

  return rows.map((row) => Number(row.round_id))
}

async function isCycleEnded(
  thor: ThorClient,
  emissionsAddress: string,
  roundId: number,
): Promise<boolean> {
  const emissionsContract = ABIContract.ofAbi(Emissions__factory.abi);
  const result = await thor.contracts.executeCall(
    emissionsAddress,
    emissionsContract.getFunction("isCycleEnded"),
    [roundId],
  );
  return result.success ? (result.result?.array?.[0] as boolean) : false;
}

async function getActionVerificationData(
  thor: ThorClient,
  contractAddress: string,
  roundId: number,
): Promise<{
  expectedActions: number;
  completedActions: number;
  missedUsersCount: number;
}> {
  const relayerPoolContract = ABIContract.ofAbi(
    RelayerRewardsPool__factory.abi,
  );

  const totalWeightedResult = await thor.contracts.executeCall(
    contractAddress,
    relayerPoolContract.getFunction("totalWeightedActions"),
    [roundId],
  );
  const expectedActions = totalWeightedResult.success
    ? Number(totalWeightedResult.result?.array?.[0] ?? 0)
    : 0;

  const completedWeightedResult = await thor.contracts.executeCall(
    contractAddress,
    relayerPoolContract.getFunction("completedWeightedActions"),
    [roundId],
  );
  const completedActions = completedWeightedResult.success
    ? Number(completedWeightedResult.result?.array?.[0] ?? 0)
    : 0;

  const missedResult = await thor.contracts.executeCall(
    contractAddress,
    relayerPoolContract.getFunction("getMissedAutoVotingUsersCount"),
    [roundId],
  );
  const missedUsersCount = missedResult.success
    ? Number(missedResult.result?.array?.[0] ?? 0)
    : 0;

  return { expectedActions, completedActions, missedUsersCount };
}

async function getReducedUsersCount(
  thor: ThorClient,
  contractAddress: string,
  roundId: number,
  fromBlock: number,
  toBlock?: number,
): Promise<number> {
  const relayerPoolContract = ABIContract.ofAbi(
    RelayerRewardsPool__factory.abi,
  );
  const reducedEvent = relayerPoolContract.getEvent(
    "ExpectedActionsReduced",
  ) as any;

  const roundIdHex = "0x" + roundId.toString(16).padStart(64, "0");

  let totalReducedUsers = 0;
  let offset = 0;
  const MAX_EVENTS_PER_REQUEST = 1000;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const logs = await thor.logs.filterEventLogs({
      range: {
        unit: "block" as const,
        from: fromBlock,
        to: toBlock,
      },
      options: {
        offset,
        limit: MAX_EVENTS_PER_REQUEST,
      },
      order: "asc",
      criteriaSet: [
        {
          criteria: {
            address: contractAddress,
            topic0: reducedEvent.encodeFilterTopicsNoNull({})[0],
            topic1: roundIdHex,
          },
          eventAbi: reducedEvent,
        },
      ],
    });

    for (const log of logs) {
      const decodedData = reducedEvent.decodeEventLog({
        topics: log.topics.map((topic: string) => Hex.of(topic)),
        data: Hex.of(log.data),
      });
      totalReducedUsers += Number(decodedData.args.userCount ?? 0);
    }

    if (logs.length < MAX_EVENTS_PER_REQUEST) {
      break;
    }
    offset += MAX_EVENTS_PER_REQUEST;
  }

  return totalReducedUsers;
}

async function getTotalRelayerRewards(
  thor: ThorClient,
  contractAddress: string,
  roundId: number,
): Promise<bigint> {
  const relayerPoolContract = ABIContract.ofAbi(
    RelayerRewardsPool__factory.abi,
  );

  const rewardsResult = await thor.contracts.executeCall(
    contractAddress,
    relayerPoolContract.getFunction("getTotalRewards"),
    [roundId],
  );

  const rawRewards = rewardsResult.success
    ? rewardsResult.result?.array?.[0]
    : undefined;
  return rawRewards ? BigInt(String(rawRewards)) : BigInt(0);
}

async function estimateRelayerRewards(
  thor: ThorClient,
  voterRewardsAddress: string,
  roundId: number,
  votedUsers: Set<string>,
): Promise<bigint> {
  if (votedUsers.size === 0) {
    return BigInt(0);
  }

  const voterRewardsContract = ABIContract.ofAbi(VoterRewards__factory.abi);
  let totalEstimatedFees = BigInt(0);

  const userArray = Array.from(votedUsers);
  const BATCH_SIZE = 50;

  for (let i = 0; i < userArray.length; i += BATCH_SIZE) {
    const batch = userArray.slice(i, i + BATCH_SIZE);

    const feePromises = batch.map(async (user) => {
      const result = await thor.contracts.executeCall(
        voterRewardsAddress,
        voterRewardsContract.getFunction("getRelayerFee"),
        [roundId, user],
      );
      if (result.success && result.result?.array?.[0]) {
        return BigInt(String(result.result.array[0]));
      }
      return BigInt(0);
    });

    const fees = await Promise.all(feePromises);
    for (const fee of fees) {
      totalEstimatedFees += fee;
    }

    if (i + BATCH_SIZE < userArray.length) {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }

  return totalEstimatedFees;
}

function upsertTransaction(
  db: Database.Database,
  txId: string,
  blockNumber: number,
  txOrigin: string,
  paidVtho: bigint,
): void {
  db.prepare(
    `
    INSERT OR IGNORE INTO transactions (tx_id, block_number, tx_origin, paid_vtho_raw)
    VALUES (?, ?, ?, ?)
  `,
  ).run(
    txId,
    blockNumber,
    normalizeAddress(txOrigin),
    scaleDownWeiToDbUnits(paidVtho),
  );
}

async function fetchAndStoreReceipt(
  db: Database.Database,
  thor: ThorClient,
  txId: string,
  meta: LogMeta,
): Promise<void> {
  const existing = db
    .prepare("SELECT 1 FROM transactions WHERE tx_id = ?")
    .get(txId) as { 1: number } | undefined;
  if (existing) return;

  const receipt = await thor.transactions.getTransactionReceipt(txId);
  if (!receipt) return;

  const paid = ensureInteger(receipt.paid);
  const origin = String(receipt.meta?.txOrigin ?? "").toLowerCase();
  const blockNumber = meta.blockNumber ?? Number(receipt.meta?.blockNumber ?? 0);

  upsertTransaction(db, txId, blockNumber, origin, paid);
}

async function fetchRelayerActions(
  db: Database.Database,
  thor: ThorClient,
  fromBlock: number,
  toBlock: number,
): Promise<number> {
  const relayerPoolAbi = ABIContract.ofAbi(RelayerRewardsPool__factory.abi);
  const relayerActionEvent = relayerPoolAbi.getEvent(
    "RelayerActionRegistered",
  ) as any;

  let offset = 0;
  const limit = 1000;
  let stored = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const logs = await thor.logs.filterEventLogs({
      range: {
        unit: "block" as const,
        from: fromBlock,
        to: toBlock,
      },
      options: { offset, limit },
      order: "asc",
      criteriaSet: [
        {
          criteria: {
            address: mainnetConfig.relayerRewardsPoolContractAddress,
            topic0: relayerActionEvent.encodeFilterTopicsNoNull({})[0],
          },
          eventAbi: relayerActionEvent,
        },
      ],
    });

    if (logs.length === 0) break;

    type DecodedAction = {
      roundId: number;
      relayer: string;
      actionCount: number;
      weight: number;
      meta: LogMeta;
    };

    const byTx = new Map<string, DecodedAction[]>();

    for (const log of logs) {
      const decoded = relayerActionEvent.decodeEventLog({
        topics: log.topics.map((t: string) => Hex.of(t)),
        data: Hex.of(log.data),
      });

      const roundId = Number(decoded.args.roundId ?? 0);
      const relayer = normalizeAddress(decoded.args.relayer as string);
      const actionCount = Number(decoded.args.actionCount ?? 0);
      const weight = Number(decoded.args.weight ?? 0);
      // Weight-1 actions are emitted for the round being claimed, so keep them
      // on that round instead of shifting them into the next live round.
      const effectiveRoundId = getStoredActionRoundId(roundId, weight);

      const meta: LogMeta = {
        txID: log.meta?.txID,
        blockNumber: log.meta?.blockNumber,
      };

      if (!meta.txID) continue;

      const arr = byTx.get(meta.txID) ?? [];
      arr.push({
        roundId: effectiveRoundId,
        relayer,
        actionCount,
        weight,
        meta,
      });
      byTx.set(meta.txID, arr);
    }

    const insertStmt = db.prepare(
      `
      INSERT INTO relayer_actions (round_id, relayer, action_count, weight, tx_id, gas_paid_raw)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    );

    const tx = db.transaction(
      (entries: { txId: string; actions: DecodedAction[]; paidPerAction: bigint }[]) => {
        for (const { txId, actions, paidPerAction } of entries) {
          for (const a of actions) {
            insertStmt.run(
              a.roundId,
              a.relayer,
              a.actionCount,
              a.weight,
              txId,
              scaleDownWeiToDbUnits(paidPerAction),
            );
          }
        }
      },
    );

    const toInsert: {
      txId: string;
      actions: DecodedAction[];
      paidPerAction: bigint;
    }[] = [];

    for (const [txId, actions] of byTx.entries()) {
      const receipt = await thor.transactions.getTransactionReceipt(txId);
      if (!receipt) continue;
      const paid = ensureInteger(receipt.paid);
      const count = actions.length;
      if (count === 0) continue;
      const paidPerAction = paid / BigInt(count);
      toInsert.push({ txId, actions, paidPerAction });
    }

    tx(toInsert);

    stored += logs.length;

    if (logs.length < limit) break;
    offset += limit;
  }

  return stored;
}

async function fetchVotingEvents(
  db: Database.Database,
  thor: ThorClient,
  xAllocationVotingAddress: string,
  fromBlock: number,
  toBlock: number,
): Promise<number> {
  const votingAbi = ABIContract.ofAbi(XAllocationVoting__factory.abi);
  const autoVoteCastEvent = votingAbi.getEvent(
    "AllocationAutoVoteCast",
  ) as any;
  const autoVoteSkippedEvent = votingAbi.getEvent("AutoVoteSkipped") as any;

  let offset = 0;
  const limit = 1000;
  let stored = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const logs = await thor.logs.filterEventLogs({
      range: { unit: "block" as const, from: fromBlock, to: toBlock },
      options: { offset, limit },
      order: "asc",
      criteriaSet: [
        {
          criteria: {
            address: xAllocationVotingAddress,
            topic0: autoVoteCastEvent.encodeFilterTopicsNoNull({})[0],
          },
          eventAbi: autoVoteCastEvent,
        },
        {
          criteria: {
            address: xAllocationVotingAddress,
            topic0: autoVoteSkippedEvent.encodeFilterTopicsNoNull({})[0],
          },
          eventAbi: autoVoteSkippedEvent,
        },
      ],
    });

    if (logs.length === 0) break;

    const insertStmt = db.prepare(
      `
      INSERT INTO voting_events (round_id, voter, skipped, tx_id)
      VALUES (?, ?, ?, ?)
    `,
    );

    const tx = db.transaction((batchLogs: any[]) => {
      for (const log of batchLogs) {
        const isSkipped =
          log.topics[0] ===
          autoVoteSkippedEvent.encodeFilterTopicsNoNull({})[0];
        const eventAbi = isSkipped ? autoVoteSkippedEvent : autoVoteCastEvent;

        const decoded = eventAbi.decodeEventLog({
          topics: log.topics.map((t: string) => Hex.of(t)),
          data: Hex.of(log.data),
        });

        const roundId = Number(decoded.args.roundId ?? 0);
        const voterTopic = log.topics?.[1];
        const voter =
          voterTopic && voterTopic.length === 66
            ? normalizeAddress("0x" + voterTopic.slice(26))
            : normalizeAddress(decoded.args.voter as string);

        const meta: LogMeta = {
          txID: log.meta?.txID,
          blockNumber: log.meta?.blockNumber,
        };

        if (meta.txID) {
          insertStmt.run(roundId, voter, isSkipped ? 1 : 0, meta.txID);
        }
      }
    });

    tx(logs);

    for (const log of logs) {
      const meta: LogMeta = {
        txID: log.meta?.txID,
        blockNumber: log.meta?.blockNumber,
      };
      if (meta.txID) {
        await fetchAndStoreReceipt(db, thor, meta.txID, meta);
      }
    }

    stored += logs.length;

    if (logs.length < limit) break;
    offset += limit;
  }

  return stored;
}

async function fetchClaims(
  db: Database.Database,
  thor: ThorClient,
  voterRewardsAddress: string,
  fromBlock: number,
  toBlock: number,
): Promise<number> {
  const voterRewardsAbi = ABIContract.ofAbi(VoterRewards__factory.abi);
  const relayerFeeTakenEvent = voterRewardsAbi.getEvent(
    "RelayerFeeTaken",
  ) as any;

  let offset = 0;
  const limit = 1000;
  let stored = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const logs = await thor.logs.filterEventLogs({
      range: { unit: "block" as const, from: fromBlock, to: toBlock },
      options: { offset, limit },
      order: "asc",
      criteriaSet: [
        {
          criteria: {
            address: voterRewardsAddress,
            topic0: relayerFeeTakenEvent.encodeFilterTopicsNoNull({})[0],
          },
          eventAbi: relayerFeeTakenEvent,
        },
      ],
    });

    if (logs.length === 0) break;

    const insertStmt = db.prepare(
      `
      INSERT INTO claims (round_id, relayer, voter, tx_id)
      VALUES (?, ?, ?, ?)
    `,
    );

    const tx = db.transaction((batchLogs: any[]) => {
      for (const log of batchLogs) {
        const decoded = relayerFeeTakenEvent.decodeEventLog({
          topics: log.topics.map((t: string) => Hex.of(t)),
          data: Hex.of(log.data),
        });

        const claimedCycle = Number(decoded.args.cycle ?? 0);
        // The emitted cycle is the actual round whose voter rewards were claimed.
        const roundId = getStoredClaimRoundId(claimedCycle);
        const relayer = normalizeAddress(decoded.args.relayer as string);
        const voter = normalizeAddress(decoded.args.voter as string);

        const meta: LogMeta = {
          txID: log.meta?.txID,
          blockNumber: log.meta?.blockNumber,
        };

        if (meta.txID) {
          insertStmt.run(roundId, relayer, voter, meta.txID);
        }
      }
    });

    tx(logs);

    for (const log of logs) {
      const meta: LogMeta = {
        txID: log.meta?.txID,
        blockNumber: log.meta?.blockNumber,
      };
      if (meta.txID) {
        await fetchAndStoreReceipt(db, thor, meta.txID, meta);
      }
    }

    stored += logs.length;

    if (logs.length < limit) break;
    offset += limit;
  }

  return stored;
}

async function populateNewRounds(
  db: Database.Database,
  thor: ThorClient,
): Promise<void> {
  const rows = db
    .prepare(
      `
      SELECT DISTINCT round_id AS round_id FROM relayer_actions
      UNION
      SELECT DISTINCT round_id AS round_id FROM claims
    `,
    )
    .all() as { round_id: number }[];

  const knownRows = db
    .prepare(
      `
      SELECT round_id FROM rounds
    `,
    )
    .all() as { round_id: number }[];

  const known = new Set(knownRows.map((r) => r.round_id));
  const missingRounds = rows.map((r) => r.round_id).filter((r) => !known.has(r));

  if (missingRounds.length === 0) {
    return;
  }

  for (const roundId of missingRounds) {
    const snapshot = await getRoundSnapshot(
      thor,
      mainnetConfig.xAllocationVotingContractAddress,
      roundId,
    );
    const deadline = await getRoundDeadline(
      thor,
      mainnetConfig.xAllocationVotingContractAddress,
      roundId,
    );

    const setup = await getRoundSetupData(
      thor,
      mainnetConfig.relayerRewardsPoolContractAddress,
      roundId,
      snapshot,
      deadline,
    );

    const verification = await getActionVerificationData(
      thor,
      mainnetConfig.relayerRewardsPoolContractAddress,
      roundId,
    );

    const reducedUsers = await getReducedUsersCount(
      thor,
      mainnetConfig.relayerRewardsPoolContractAddress,
      roundId,
      snapshot,
      undefined,
    );

    const votedUsersRows = db
      .prepare(
        `
        SELECT DISTINCT voter FROM voting_events
        WHERE round_id = ? AND skipped = 0
      `,
      )
      .all(roundId) as { voter: string }[];
    const votedUsersSet = new Set<string>(
      votedUsersRows.map((r) => normalizeAddress(r.voter)),
    );

    const totalRelayerRewards = await getTotalRelayerRewards(
      thor,
      mainnetConfig.relayerRewardsPoolContractAddress,
      roundId,
    );
    const estimatedRelayerRewards = await estimateRelayerRewards(
      thor,
      mainnetConfig.voterRewardsContractAddress,
      roundId,
      votedUsersSet,
    );

    const autoVotingUsersCount =
      setup.contractAutoVotingUsersCount > 0
        ? setup.contractAutoVotingUsersCount
        : votedUsersSet.size;

    const ended = await isCycleEnded(
      thor,
      mainnetConfig.emissionsContractAddress,
      roundId,
    );

    db.prepare(
      `
      INSERT OR REPLACE INTO rounds (
        round_id,
        snapshot_block,
        deadline_block,
        is_round_ended,
        rewards_snapshot_finalized,
        last_rewards_snapshot_at,
        num_relayers,
        auto_voting_users_count,
        contract_auto_voting_users_count,
        reduced_users_count,
        expected_actions,
        completed_actions,
        missed_users_count,
        total_relayer_rewards_raw,
        estimated_relayer_rewards_raw
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    ).run(
      roundId,
      snapshot,
      deadline,
      ended ? 1 : 0,
      0,
      null,
      countActiveRelayersForRound(db, roundId),
      autoVotingUsersCount,
      setup.contractAutoVotingUsersCount,
      reducedUsers,
      verification.expectedActions,
      verification.completedActions,
      verification.missedUsersCount,
      scaleDownWeiToDbUnits(totalRelayerRewards),
      scaleDownWeiToDbUnits(estimatedRelayerRewards),
    );
  }
}

async function fetchRelayerRewardsClaimed(
  db: Database.Database,
  thor: ThorClient,
  fromBlock: number,
  toBlock: number,
): Promise<number> {
  const relayerPoolAbi = ABIContract.ofAbi(RelayerRewardsPool__factory.abi);
  const claimEvent = relayerPoolAbi.getEvent("RelayerRewardsClaimed") as any;

  let offset = 0;
  const limit = 1000;
  let stored = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const logs = await thor.logs.filterEventLogs({
      range: { unit: "block" as const, from: fromBlock, to: toBlock },
      options: { offset, limit },
      order: "asc",
      criteriaSet: [
        {
          criteria: {
            address: mainnetConfig.relayerRewardsPoolContractAddress,
            topic0: claimEvent.encodeFilterTopicsNoNull({})[0],
          },
          eventAbi: claimEvent,
        },
      ],
    });

    if (logs.length === 0) break;

    const insertStmt = db.prepare(
      `
      INSERT INTO relayer_rewards_claimed (round_id, relayer, amount_raw, tx_id, block_number)
      VALUES (?, ?, ?, ?, ?)
    `,
    );

    const tx = db.transaction((batchLogs: any[]) => {
      for (const log of batchLogs) {
        const decoded = claimEvent.decodeEventLog({
          topics: log.topics.map((t: string) => Hex.of(t)),
          data: Hex.of(log.data),
        });

        const roundId = Number(decoded.args.roundId ?? 0);
        const relayer = normalizeAddress(decoded.args.relayer as string);
        const amountWei = ensureInteger(decoded.args.amount);
        const txId = log.meta?.txID ?? null;
        const blockNumber = log.meta?.blockNumber ?? null;
        insertStmt.run(
          roundId,
          relayer,
          scaleDownWeiToDbUnits(amountWei),
          txId,
          blockNumber,
        );
      }
    });

    tx(logs);

    stored += logs.length;
    if (logs.length < limit) break;
    offset += limit;
  }

  return stored;
}

async function updateRelayerClaimableSnapshots(
  db: Database.Database,
  thor: ThorClient,
  fromBlock: number,
  toBlock: number,
  currentRoundId: number,
): Promise<void> {
  const relayerPoolAbi = ABIContract.ofAbi(RelayerRewardsPool__factory.abi);
  const roundsToRefresh = selectClaimableSnapshotRefreshRounds({
    firstRoundId: FIRST_AUTO_VOTING_ROUND,
    currentRoundId,
    mutableRounds: getMutableRoundIds(db),
    touchedClaimRounds: getTouchedClaimRoundsByBlockRange(db, fromBlock, toBlock),
  });

  if (roundsToRefresh.length === 0) {
    console.log("No round snapshots need refreshing.")
    return
  }

  const registeredRelayers = await thor.contracts.executeCall(
    mainnetConfig.relayerRewardsPoolContractAddress,
    relayerPoolAbi.getFunction("getRegisteredRelayers"),
    [],
  );
  const reg: string[] =
    registeredRelayers.success && Array.isArray(registeredRelayers.result?.array?.[0])
      ? (registeredRelayers.result?.array?.[0] as string[])
      : [];

  const dbRelayers = db
    .prepare(
      `
      SELECT DISTINCT relayer AS addr FROM relayer_actions
      UNION
      SELECT DISTINCT relayer AS addr FROM claims
      ORDER BY addr ASC
    `,
    )
    .all() as { addr: string }[];

  const relayers = Array.from(
    new Set([
      ...reg.map(normalizeAddress),
      ...dbRelayers.map((r) => normalizeAddress(r.addr)),
    ]),
  );

  if (relayers.length === 0) return;

  const upsert = db.prepare(
    `
    INSERT INTO relayer_claimable_snapshots (round_id, relayer, claimable_raw)
    VALUES (?, ?, ?)
    ON CONFLICT(round_id, relayer) DO UPDATE SET
      claimable_raw = excluded.claimable_raw
  `,
  );

  const updateRoundSnapshotMeta = db.prepare(
    `
    UPDATE rounds
    SET last_rewards_snapshot_at = ?, rewards_snapshot_finalized = ?
    WHERE round_id = ?
  `,
  );

  for (const roundId of roundsToRefresh) {
    // Only finalize once the pool says rewards are actually claimable.
    const claimableCheck = await thor.contracts.executeCall(
      mainnetConfig.relayerRewardsPoolContractAddress,
      relayerPoolAbi.getFunction("isRewardClaimable"),
      [roundId],
    );
    const isRewardClaimableOnChain =
      claimableCheck.success && claimableCheck.result?.array?.[0]
        ? Boolean(claimableCheck.result.array[0])
        : false;

    // Keep updating snapshots until rewards are claimable; then take one final snapshot and finalize.
    for (const relayer of relayers) {
      const res = await thor.contracts.executeCall(
        mainnetConfig.relayerRewardsPoolContractAddress,
        relayerPoolAbi.getFunction("claimableRewards"),
        [relayer, roundId],
      );
      const claimableWei =
        res.success && res.result?.array?.[0]
          ? ensureInteger(res.result.array[0] as any)
          : BigInt(0);
      upsert.run(roundId, relayer, scaleDownWeiToDbUnits(claimableWei));
    }

    updateRoundSnapshotMeta.run(
      new Date().toISOString(),
      isRewardClaimableOnChain ? 1 : 0,
      roundId,
    );
  }
}

async function main(): Promise<void> {
  console.log("Auto-Voting Fetch");
  console.log("==================");

  const db = openDatabase();
  const thor = ThorClient.at(getMainnetNodeUrl(), { isPollingEnabled: false });

  const lastProcessedBlockStr = getMeta(db, "last_processed_block");
  const lastProcessedBlock = lastProcessedBlockStr
    ? Number(lastProcessedBlockStr)
    : 0;

  const latestBlock = await getLatestBlock(thor);
  const targetBlock = Math.max(0, latestBlock - FINALITY_MARGIN);

  console.log(`Last processed block: ${lastProcessedBlock}`);
  console.log(`Latest block:         ${latestBlock}`);
  console.log(`Target block:         ${targetBlock}`);

  if (targetBlock <= lastProcessedBlock) {
    console.log("No new blocks to process.");
    return;
  }

  const fromBlock = lastProcessedBlock + 1;
  const toBlock = targetBlock;

  console.log(`Processing blocks ${fromBlock} to ${toBlock}...`);

  const xAllocationVotingAddress =
    "0x89A00Bb0947a30FF95BEeF77a66AEdE3842Fe5B7";
  const voterRewardsAddress = "0x838A33AF756a6366f93e201423E1425f67eC0Fa7";
  const currentRoundId = await getCurrentRoundId(thor, xAllocationVotingAddress);

  const relayerActionsCount = await fetchRelayerActions(
    db,
    thor,
    fromBlock,
    toBlock,
  );
  console.log(`Stored ${relayerActionsCount} relayer action logs.`);

  const votingEventsCount = await fetchVotingEvents(
    db,
    thor,
    xAllocationVotingAddress,
    fromBlock,
    toBlock,
  );
  console.log(`Stored ${votingEventsCount} voting logs.`);

  const claimsCount = await fetchClaims(
    db,
    thor,
    voterRewardsAddress,
    fromBlock,
    toBlock,
  );
  console.log(`Stored ${claimsCount} claim logs.`);

  const relayerRewardsClaimedCount = await fetchRelayerRewardsClaimed(
    db,
    thor,
    fromBlock,
    toBlock,
  );
  console.log(`Stored ${relayerRewardsClaimedCount} relayer reward claim logs.`);

  await populateNewRounds(db, thor);
  await updateRelayerClaimableSnapshots(
    db,
    thor,
    fromBlock,
    toBlock,
    currentRoundId,
  );

  setMeta(db, "last_processed_block", String(toBlock));
  console.log(`Updated last_processed_block to ${toBlock}.`);
}

main().catch((error) => {
  console.error("Fetch script failed:", error);
  process.exit(1);
});
