import * as fs from "fs";
import * as path from "path";

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
  getFullRoundRange,
  selectRoundsToBuild,
  shouldRefreshRoundCache,
  writeMirroredAggregateReport,
} from "../src/lib/reporting/pipeline";

import { openDatabase } from "./reportDb";

const FIRST_AUTO_VOTING_ROUND = 69;
const AMOUNT_SCALE = BigInt(1_000_000_000); // must match reportDb/reportFetch

function scaleUpDbUnitsToWei(amountDbUnits: bigint): bigint {
  return amountDbUnits * AMOUNT_SCALE;
}

function coerceDbInt(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.trunc(value));
  if (typeof value === "string") return BigInt(value);
  if (value === null || value === undefined) return BigInt(0);
  return BigInt(String(value));
}

function coerceDbNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") return Number(value);
  if (value === null || value === undefined) return 0;
  return Number(value);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 1000,
): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === retries) throw error;
      await sleep(delayMs * Math.pow(2, attempt));
    }
  }
  throw new Error("unreachable");
}

interface RoundRow {
  round_id: number;
  snapshot_block: number | null;
  deadline_block: number | null;
  is_round_ended: number | null;
  num_relayers: number | null;
  auto_voting_users_count: number | null;
  contract_auto_voting_users_count: number | null;
  reduced_users_count: number | null;
  expected_actions: number | null;
  completed_actions: number | null;
  missed_users_count: number | null;
  total_relayer_rewards_raw: number | null;
  estimated_relayer_rewards_raw: number | null;
}

interface RoundAnalytics {
  roundId: number;
  autoVotingUsersCount: number;
  votedForCount: number;
  rewardsClaimedCount: number;
  totalRelayerRewards: string;
  totalRelayerRewardsRaw: string;
  estimatedRelayerRewards: string;
  estimatedRelayerRewardsRaw: string;
  numRelayers: number;
  vthoSpentOnVoting: string;
  vthoSpentOnVotingRaw: string;
  vthoSpentOnClaiming: string;
  vthoSpentOnClaimingRaw: string;
  vthoSpentTotal: string;
  vthoSpentTotalRaw: string;
  expectedActions: number;
  completedActions: number;
  reducedUsersCount: number;
  missedUsersCount: number;
  allActionsOk: boolean;
  actionStatus: string;
  isRoundEnded: boolean;
}

interface RelayerRoundBreakdown {
  roundId: number;
  votedForCount: number;
  rewardsClaimedCount: number;
  weightedActions: number;
  actions: number;
  claimableRewardsRaw: string;
  relayerRewardsClaimedRaw: string;
  vthoSpentOnVotingRaw: string;
  vthoSpentOnClaimingRaw: string;
}

interface RelayerAnalytics {
  address: string;
  rounds: RelayerRoundBreakdown[];
}

interface AnalyticsReport {
  generatedAt: string;
  network: string;
  firstRound: number;
  currentRound: number;
  rounds: RoundAnalytics[];
  relayers: RelayerAnalytics[];
}

interface RoundReport {
  generatedAt: string;
  network: string;
  roundId: number;
  round: RoundAnalytics;
  relayers: Array<{
    address: string;
    round: RelayerRoundBreakdown;
  }>;
}

function normalizeAddress(addr: string): string {
  return addr.toLowerCase();
}

function formatTokenAmount(amountWei: bigint, symbol: string): string {
  const decimals = 18;
  const divisor = BigInt(10 ** decimals);
  const integerPart = amountWei / divisor;
  const fractionalPart = amountWei % divisor;
  const fractionalStr = fractionalPart
    .toString()
    .padStart(decimals, "0")
    .slice(0, 2);
  return `${integerPart}.${fractionalStr} ${symbol}`;
}

function formatB3TR(amountWei: bigint): string {
  return formatTokenAmount(amountWei, "B3TR");
}

function formatVTHO(amountWei: bigint): string {
  return formatTokenAmount(amountWei, "VTHO");
}

async function getCurrentRoundId(
  thor: ThorClient,
  contractAddress: string,
): Promise<number> {
  const xAllocationVotingContract = ABIContract.ofAbi(
    XAllocationVoting__factory.abi,
  );
  const result = await withRetry(() =>
    thor.contracts.executeCall(
      contractAddress,
      xAllocationVotingContract.getFunction("currentRoundId"),
      [],
    ),
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
  const result = await withRetry(() =>
    thor.contracts.executeCall(
      contractAddress,
      xAllocationVotingContract.getFunction("roundSnapshot"),
      [roundId],
    ),
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
  const result = await withRetry(() =>
    thor.contracts.executeCall(
      contractAddress,
      xAllocationVotingContract.getFunction("roundDeadline"),
      [roundId],
    ),
  );
  if (!result.success) {
    throw new Error(`Failed to get round deadline for round ${roundId}`);
  }
  return Number(result.result?.array?.[0] ?? 0);
}

async function isCycleEnded(
  thor: ThorClient,
  emissionsAddress: string,
  roundId: number,
): Promise<boolean> {
  const emissionsContract = ABIContract.ofAbi(Emissions__factory.abi);
  const result = await withRetry(() =>
    thor.contracts.executeCall(
      emissionsAddress,
      emissionsContract.getFunction("isCycleEnded"),
      [roundId],
    ),
  );
  return result.success ? (result.result?.array?.[0] as boolean) : false;
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
    .get(roundId) as { cnt: unknown };

  return coerceDbNumber(row?.cnt);
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

  const totalWeightedResult = await withRetry(() =>
    thor.contracts.executeCall(
      contractAddress,
      relayerPoolContract.getFunction("totalWeightedActions"),
      [roundId],
    ),
  );
  const expectedActions = totalWeightedResult.success
    ? Number(totalWeightedResult.result?.array?.[0] ?? 0)
    : 0;

  const completedWeightedResult = await withRetry(() =>
    thor.contracts.executeCall(
      contractAddress,
      relayerPoolContract.getFunction("completedWeightedActions"),
      [roundId],
    ),
  );
  const completedActions = completedWeightedResult.success
    ? Number(completedWeightedResult.result?.array?.[0] ?? 0)
    : 0;

  const missedResult = await withRetry(() =>
    thor.contracts.executeCall(
      contractAddress,
      relayerPoolContract.getFunction("getMissedAutoVotingUsersCount"),
      [roundId],
    ),
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

  const rewardsResult = await withRetry(() =>
    thor.contracts.executeCall(
      contractAddress,
      relayerPoolContract.getFunction("getTotalRewards"),
      [roundId],
    ),
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
      const result = await withRetry(() =>
        thor.contracts.executeCall(
          voterRewardsAddress,
          voterRewardsContract.getFunction("getRelayerFee"),
          [roundId, user],
        ),
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

function _getDistinctRounds(db: Database.Database): number[] {
  const rows = db
    .prepare(
      `
      SELECT DISTINCT round_id AS round_id FROM relayer_actions
      UNION
      SELECT DISTINCT round_id AS round_id FROM voting_events
      UNION
      SELECT DISTINCT round_id AS round_id FROM claims
      ORDER BY round_id ASC
    `,
    )
    .all() as { round_id: number }[];
  return rows.map((r) => Number(r.round_id));
}

function getCachedRoundRow(
  db: Database.Database,
  roundId: number,
): RoundRow | null {
  const row = db
    .prepare<unknown[]>(
      `
      SELECT * FROM rounds WHERE round_id = ?
    `,
    )
    .get(roundId) as RoundRow | undefined;
  return row ?? null;
}

function upsertRoundRow(db: Database.Database, round: RoundRow): void {
  db.prepare(
    `
    INSERT INTO rounds (
      round_id,
      snapshot_block,
      deadline_block,
      is_round_ended,
      num_relayers,
      auto_voting_users_count,
      contract_auto_voting_users_count,
      reduced_users_count,
      expected_actions,
      completed_actions,
      missed_users_count,
      total_relayer_rewards_raw,
      estimated_relayer_rewards_raw
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(round_id) DO UPDATE SET
      snapshot_block = excluded.snapshot_block,
      deadline_block = excluded.deadline_block,
      is_round_ended = excluded.is_round_ended,
      num_relayers = excluded.num_relayers,
      auto_voting_users_count = excluded.auto_voting_users_count,
      contract_auto_voting_users_count = excluded.contract_auto_voting_users_count,
      reduced_users_count = excluded.reduced_users_count,
      expected_actions = excluded.expected_actions,
      completed_actions = excluded.completed_actions,
      missed_users_count = excluded.missed_users_count,
      total_relayer_rewards_raw = excluded.total_relayer_rewards_raw,
      estimated_relayer_rewards_raw = excluded.estimated_relayer_rewards_raw
  `,
  ).run(
    round.round_id,
    round.snapshot_block,
    round.deadline_block,
    round.is_round_ended,
    round.num_relayers,
    round.auto_voting_users_count,
    round.contract_auto_voting_users_count,
    round.reduced_users_count,
    round.expected_actions,
    round.completed_actions,
    round.missed_users_count,
    round.total_relayer_rewards_raw,
    round.estimated_relayer_rewards_raw,
  );
}

async function ensureRoundCached(
  db: Database.Database,
  thor: ThorClient,
  roundId: number,
  forceRefresh = false,
): Promise<RoundRow> {
  const existing = getCachedRoundRow(db, roundId);
  const needsRefresh = shouldRefreshRoundCache(
    existing
      ? {
          snapshotBlock: existing.snapshot_block,
          deadlineBlock: existing.deadline_block,
          isRoundEnded: existing.is_round_ended,
          numRelayers: existing.num_relayers,
          autoVotingUsersCount: existing.auto_voting_users_count,
          contractAutoVotingUsersCount: existing.contract_auto_voting_users_count,
          reducedUsersCount: existing.reduced_users_count,
          expectedActions: existing.expected_actions,
          completedActions: existing.completed_actions,
          missedUsersCount: existing.missed_users_count,
          totalRelayerRewardsRaw: existing.total_relayer_rewards_raw,
          estimatedRelayerRewardsRaw: existing.estimated_relayer_rewards_raw,
        }
      : null,
    forceRefresh,
  );
  if (!needsRefresh && existing) return existing;

  const xAllocationVotingAddress =
    "0x89A00Bb0947a30FF95BEeF77a66AEdE3842Fe5B7";
  const relayerRewardsPoolAddress =
    "0x34b56f892c9e977b9ba2e43ba64c27d368ab3c86";
  const voterRewardsAddress = "0x838A33AF756a6366f93e201423E1425f67eC0Fa7";
  const emissionsContractAddress = "0xDf94739bd169C84fe6478D8420Bb807F1f47b135";

  const snapshot = await getRoundSnapshot(
    thor,
    xAllocationVotingAddress,
    roundId,
  );
  const deadline = await getRoundDeadline(
    thor,
    xAllocationVotingAddress,
    roundId,
  );

  const setup = await getRoundSetupData(
    thor,
    relayerRewardsPoolAddress,
    roundId,
    snapshot,
    deadline,
  );

  const verification = await getActionVerificationData(
    thor,
    relayerRewardsPoolAddress,
    roundId,
  );

  const reducedUsers = await getReducedUsersCount(
    thor,
    relayerRewardsPoolAddress,
    roundId,
    snapshot,
    undefined,
  );

  const isEnded = await isCycleEnded(
    thor,
    emissionsContractAddress,
    roundId,
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
    relayerRewardsPoolAddress,
    roundId,
  );
  const estimatedRelayerRewards = await estimateRelayerRewards(
    thor,
    voterRewardsAddress,
    roundId,
    votedUsersSet,
  );

  const autoVotingUsersCount =
    setup.contractAutoVotingUsersCount > 0
      ? setup.contractAutoVotingUsersCount
      : votedUsersSet.size;

  const row: RoundRow = {
    round_id: roundId,
    snapshot_block: snapshot,
    deadline_block: deadline,
    is_round_ended: isEnded ? 1 : 0,
    num_relayers: countActiveRelayersForRound(db, roundId),
    auto_voting_users_count: autoVotingUsersCount,
    contract_auto_voting_users_count: setup.contractAutoVotingUsersCount,
    reduced_users_count: reducedUsers,
    expected_actions: verification.expectedActions,
    completed_actions: verification.completedActions,
    missed_users_count: verification.missedUsersCount,
    total_relayer_rewards_raw: Number(
      totalRelayerRewards / AMOUNT_SCALE,
    ),
    estimated_relayer_rewards_raw: Number(
      estimatedRelayerRewards / AMOUNT_SCALE,
    ),
  };

  upsertRoundRow(db, row);
  return getCachedRoundRow(db, roundId) ?? row;
}

function buildRoundAnalytics(
  db: Database.Database,
  roundRow: RoundRow,
): RoundAnalytics {
  const roundId = Number(roundRow.round_id);

  const votedForCountRow = db
    .prepare(
      `
      SELECT COUNT(DISTINCT voter) AS cnt
      FROM voting_events
      WHERE round_id = ? AND skipped = 0
    `,
    )
    .get(roundId) as { cnt: unknown };
  const votedForCount = coerceDbNumber(votedForCountRow?.cnt);

  const rewardsClaimedCountRow = db
    .prepare(
      `
      SELECT COUNT(DISTINCT voter) AS cnt
      FROM claims
      WHERE round_id = ?
    `,
    )
    .get(roundId) as { cnt: unknown };
  const rewardsClaimedCount = coerceDbNumber(rewardsClaimedCountRow?.cnt);

  const votingVthoRow = db
    .prepare(
      `
      SELECT COALESCE(SUM(gas_paid_raw), 0) AS total
      FROM relayer_actions
      WHERE round_id = ? AND weight = 3
    `,
    )
    .get(roundId) as { total: bigint };
  const vthoSpentOnVotingRaw = scaleUpDbUnitsToWei(
    coerceDbInt(votingVthoRow?.total),
  );

  const claimingVthoRow = db
    .prepare(
      `
      SELECT COALESCE(SUM(gas_paid_raw), 0) AS total
      FROM relayer_actions
      WHERE round_id = ? AND weight = 1
    `,
    )
    .get(roundId) as { total: bigint };
  const vthoSpentOnClaimingRaw = scaleUpDbUnitsToWei(
    coerceDbInt(claimingVthoRow?.total),
  );

  const vthoSpentTotalRaw = vthoSpentOnVotingRaw + vthoSpentOnClaimingRaw;

  const autoVotingUsersCount = coerceDbNumber(roundRow.auto_voting_users_count);
  const reducedUsersCount = coerceDbNumber(roundRow.reduced_users_count);
  const expectedActions = coerceDbNumber(roundRow.expected_actions);
  const completedActions = coerceDbNumber(roundRow.completed_actions);
  const missedUsersCount = coerceDbNumber(roundRow.missed_users_count);
  const isRoundEnded = coerceDbNumber(roundRow.is_round_ended) === 1;

  const expectedToVote = autoVotingUsersCount - reducedUsersCount;
  const votingComplete = votedForCount >= expectedToVote;
  const missedVotes = expectedToVote - votedForCount;

  const allActionsOk = isRoundEnded
    ? completedActions >= expectedActions
    : votingComplete;

  let actionStatus: string;
  if (autoVotingUsersCount === 0) {
    actionStatus = "N/A";
  } else if (votingComplete) {
    if (isRoundEnded && !allActionsOk) {
      const missedClaims = Math.max(0, expectedToVote - rewardsClaimedCount);
      actionStatus = `⚠ ${missedClaims} claims missing`;
    } else if (reducedUsersCount === 0) {
      actionStatus = "✓ All voted";
    } else {
      actionStatus = `✓ OK (${reducedUsersCount} skips)`;
    }
  } else {
    actionStatus = `⚠ ${missedVotes} not voted`;
  }

  const totalRelayerRewardsRaw = scaleUpDbUnitsToWei(
    coerceDbInt(roundRow.total_relayer_rewards_raw),
  );
  const estimatedRelayerRewardsRaw = scaleUpDbUnitsToWei(
    coerceDbInt(roundRow.estimated_relayer_rewards_raw),
  );

  return {
    roundId,
    autoVotingUsersCount,
    votedForCount,
    rewardsClaimedCount,
    totalRelayerRewards: formatB3TR(totalRelayerRewardsRaw),
    totalRelayerRewardsRaw: totalRelayerRewardsRaw.toString(),
    estimatedRelayerRewards: formatB3TR(estimatedRelayerRewardsRaw),
    estimatedRelayerRewardsRaw: estimatedRelayerRewardsRaw.toString(),
    numRelayers: countActiveRelayersForRound(db, roundId),
    vthoSpentOnVoting: formatVTHO(vthoSpentOnVotingRaw),
    vthoSpentOnVotingRaw: vthoSpentOnVotingRaw.toString(),
    vthoSpentOnClaiming: formatVTHO(vthoSpentOnClaimingRaw),
    vthoSpentOnClaimingRaw: vthoSpentOnClaimingRaw.toString(),
    vthoSpentTotal: formatVTHO(vthoSpentTotalRaw),
    vthoSpentTotalRaw: vthoSpentTotalRaw.toString(),
    expectedActions,
    completedActions,
    reducedUsersCount,
    missedUsersCount,
    allActionsOk,
    actionStatus,
    isRoundEnded,
  };
}

function _getAllRelayers(db: Database.Database): string[] {
  const rows = db
    .prepare(
      `
      SELECT DISTINCT relayer AS addr FROM relayer_actions
      UNION
      SELECT DISTINCT relayer AS addr FROM claims
      UNION
      SELECT DISTINCT relayer AS addr FROM relayer_rewards_claimed
      ORDER BY addr ASC
    `,
    )
    .all() as { addr: string }[];
  return rows.map((r) => normalizeAddress(r.addr));
}

function getAffectedRoundsByBlockRange(
  db: Database.Database,
  fromBlock: number,
  toBlock: number,
): number[] {
  if (toBlock <= fromBlock) return [];
  const rows = db
    .prepare(
      `
      SELECT DISTINCT ra.round_id AS round_id
      FROM relayer_actions ra
      JOIN transactions t ON t.tx_id = ra.tx_id
      WHERE t.block_number > ? AND t.block_number <= ?
      UNION
      SELECT DISTINCT ve.round_id AS round_id
      FROM voting_events ve
      JOIN transactions t ON t.tx_id = ve.tx_id
      WHERE t.block_number > ? AND t.block_number <= ?
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
    .all(fromBlock, toBlock, fromBlock, toBlock, fromBlock, toBlock, fromBlock, toBlock) as {
    round_id: unknown;
  }[];
  return rows.map((r) => Number(r.round_id));
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
    .all(FIRST_AUTO_VOTING_ROUND) as { round_id: unknown }[]

  return rows.map((row) => Number(row.round_id))
}

function buildRoundRelayers(
  db: Database.Database,
  roundId: number,
): Array<{ address: string; round: RelayerRoundBreakdown }> {
  const relayerRows = db
    .prepare(
      `
      SELECT DISTINCT relayer AS addr FROM relayer_actions WHERE round_id = ?
      UNION
      SELECT DISTINCT relayer AS addr FROM relayer_rewards_claimed WHERE round_id = ?
      UNION
      SELECT DISTINCT relayer AS addr FROM relayer_claimable_snapshots
        WHERE round_id = ? AND claimable_raw > 0
      ORDER BY addr ASC
    `,
    )
    .all(roundId, roundId, roundId) as { addr: string }[];

  const out: Array<{ address: string; round: RelayerRoundBreakdown }> = [];

  const actionAggRows = db
    .prepare(
      `
      SELECT
        relayer,
        MAX(action_count) AS actions,
        SUM(weight) AS weighted_actions,
        SUM(CASE WHEN weight = 3 THEN 1 ELSE 0 END) AS voted_for_count,
        SUM(CASE WHEN weight = 1 THEN 1 ELSE 0 END) AS rewards_claimed_count
      FROM relayer_actions
      WHERE round_id = ?
      GROUP BY relayer
    `,
    )
    .all(roundId) as {
    relayer: string;
    actions: unknown;
    weighted_actions: unknown;
    voted_for_count: unknown;
    rewards_claimed_count: unknown;
  }[];
  const actionAggByRelayer = new Map<string, typeof actionAggRows[number]>();
  for (const r of actionAggRows) {
    actionAggByRelayer.set(normalizeAddress(r.relayer), r);
  }

  const claimableStmt = db.prepare(
    `
    SELECT claimable_raw AS claimable_raw
    FROM relayer_claimable_snapshots
    WHERE round_id = ? AND relayer = ?
  `,
  );
  const claimedStmt = db.prepare(
    `
    SELECT COALESCE(SUM(amount_raw), 0) AS amount
    FROM relayer_rewards_claimed
    WHERE round_id = ? AND relayer = ?
  `,
  );
  const votingGasStmt = db.prepare(
    `
    SELECT COALESCE(SUM(gas_paid_raw), 0) AS total
    FROM relayer_actions
    WHERE round_id = ? AND relayer = ? AND weight = 3
  `,
  );
  const claimingGasStmt = db.prepare(
    `
    SELECT COALESCE(SUM(gas_paid_raw), 0) AS total
    FROM relayer_actions
    WHERE round_id = ? AND relayer = ? AND weight = 1
  `,
  );

  for (const rr of relayerRows) {
    const address = normalizeAddress(rr.addr);
    const agg = actionAggByRelayer.get(address);

    const claimableRow = claimableStmt.get(roundId, address) as
      | { claimable_raw: unknown }
      | undefined;
    const claimedRow = claimedStmt.get(roundId, address) as { amount: unknown };
    const votingGasRow = votingGasStmt.get(roundId, address) as { total: unknown };
    const claimingGasRow = claimingGasStmt.get(roundId, address) as { total: unknown };

    const breakdown: RelayerRoundBreakdown = {
      roundId,
      votedForCount: agg ? coerceDbNumber(agg.voted_for_count) : 0,
      rewardsClaimedCount: agg ? coerceDbNumber(agg.rewards_claimed_count) : 0,
      weightedActions: agg ? coerceDbNumber(agg.weighted_actions) : 0,
      actions: agg ? coerceDbNumber(agg.actions) : 0,
      claimableRewardsRaw: scaleUpDbUnitsToWei(
        coerceDbInt(claimableRow?.claimable_raw),
      ).toString(),
      relayerRewardsClaimedRaw: scaleUpDbUnitsToWei(
        coerceDbInt(claimedRow?.amount),
      ).toString(),
      vthoSpentOnVotingRaw: scaleUpDbUnitsToWei(
        coerceDbInt(votingGasRow?.total),
      ).toString(),
      vthoSpentOnClaimingRaw: scaleUpDbUnitsToWei(
        coerceDbInt(claimingGasRow?.total),
      ).toString(),
    };

    if (
      breakdown.actions > 0 ||
      breakdown.weightedActions > 0 ||
      BigInt(breakdown.claimableRewardsRaw) > BigInt(0) ||
      BigInt(breakdown.relayerRewardsClaimedRaw) > BigInt(0)
    ) {
      out.push({ address, round: breakdown });
    }
  }

  out.sort((a, b) => a.address.localeCompare(b.address));
  return out;
}

function _buildRelayerAnalytics(
  db: Database.Database,
  relayer: string,
): RelayerAnalytics {
  const roundIdRows = db
    .prepare(
      `
      SELECT DISTINCT round_id AS round_id FROM relayer_actions WHERE relayer = ?
      UNION
      SELECT DISTINCT round_id AS round_id FROM relayer_rewards_claimed WHERE relayer = ?
      UNION
      SELECT DISTINCT round_id AS round_id FROM relayer_claimable_snapshots
        WHERE relayer = ? AND claimable_raw > 0
      ORDER BY round_id ASC
    `,
    )
    .all(relayer, relayer, relayer) as { round_id: unknown }[];

  const roundIds = roundIdRows.map((r) => Number(r.round_id));

  const actionsByRound = new Map<
    number,
    {
      actions: number;
      weightedActions: number;
      votedForCount: number;
      rewardsClaimedCount: number;
    }
  >();
  const perRoundActionAgg = db
    .prepare(
      `
      SELECT
        ra.round_id AS round_id,
        MAX(ra.action_count) AS actions,
        SUM(ra.weight) AS weighted_actions,
        SUM(CASE WHEN ra.weight = 3 THEN 1 ELSE 0 END) AS voted_for_count,
        SUM(CASE WHEN ra.weight = 1 THEN 1 ELSE 0 END) AS rewards_claimed_count
      FROM relayer_actions ra
      WHERE ra.relayer = ?
      GROUP BY ra.round_id
    `,
    )
    .all(relayer) as {
    round_id: unknown;
    actions: unknown;
    weighted_actions: unknown;
    voted_for_count: unknown;
    rewards_claimed_count: unknown;
  }[];
  for (const row of perRoundActionAgg) {
    const roundId = Number(row.round_id);
    actionsByRound.set(roundId, {
      actions: coerceDbNumber(row.actions),
      weightedActions: coerceDbNumber(row.weighted_actions),
      votedForCount: coerceDbNumber(row.voted_for_count),
      rewardsClaimedCount: coerceDbNumber(row.rewards_claimed_count),
    });
  }

  const result: RelayerRoundBreakdown[] = [];

  for (const roundId of roundIds) {
    const actionAgg = actionsByRound.get(roundId) ?? {
      actions: 0,
      weightedActions: 0,
      votedForCount: 0,
      rewardsClaimedCount: 0,
    };

    const claimableRow = db
      .prepare(
        `
        SELECT claimable_raw AS claimable_raw
        FROM relayer_claimable_snapshots
        WHERE round_id = ? AND relayer = ?
      `,
      )
      .get(roundId, relayer) as { claimable_raw: bigint } | undefined;

    const claimedRow = db
      .prepare(
        `
        SELECT COALESCE(SUM(amount_raw), 0) AS amount
        FROM relayer_rewards_claimed
        WHERE round_id = ? AND relayer = ?
      `,
      )
      .get(roundId, relayer) as { amount: number };

    const votingVthoRow = db
      .prepare(
        `
        SELECT COALESCE(SUM(gas_paid_raw), 0) AS total
        FROM relayer_actions
        WHERE relayer = ? AND round_id = ? AND weight = 3
      `,
      )
      .get(relayer, roundId) as { total: number };

    const claimingVthoRow = db
      .prepare(
        `
        SELECT COALESCE(SUM(gas_paid_raw), 0) AS total
        FROM relayer_actions
        WHERE relayer = ? AND round_id = ? AND weight = 1
      `,
      )
      .get(relayer, roundId) as { total: number };

    const entry: RelayerRoundBreakdown = {
      roundId,
      votedForCount: actionAgg.votedForCount,
      rewardsClaimedCount: actionAgg.rewardsClaimedCount,
      weightedActions: actionAgg.weightedActions,
      actions: actionAgg.actions,
      claimableRewardsRaw: scaleUpDbUnitsToWei(
        coerceDbInt(claimableRow?.claimable_raw),
      ).toString(),
      relayerRewardsClaimedRaw: scaleUpDbUnitsToWei(
        coerceDbInt(claimedRow?.amount),
      ).toString(),
      vthoSpentOnVotingRaw: scaleUpDbUnitsToWei(
        coerceDbInt(votingVthoRow?.total),
      ).toString(),
      vthoSpentOnClaimingRaw: scaleUpDbUnitsToWei(
        coerceDbInt(claimingVthoRow?.total),
      ).toString(),
    };

    if (
      entry.actions > 0 ||
      entry.weightedActions > 0 ||
      BigInt(entry.claimableRewardsRaw) > BigInt(0) ||
      BigInt(entry.relayerRewardsClaimedRaw) > BigInt(0)
    ) {
      result.push(entry);
    }
  }

  result.sort((a, b) => a.roundId - b.roundId);
  return { address: relayer, rounds: result };
}

function saveReport(report: AnalyticsReport): void {
  const outputPaths = writeMirroredAggregateReport(process.cwd(), report)
  for (const outputPath of outputPaths) {
    // eslint-disable-next-line no-console
    console.log(`Report written to ${outputPath}`)
  }
}

function saveRoundReport(roundReport: RoundReport): void {
  const outputPath = path.join(
    process.cwd(),
    "public",
    "data",
    `report.${roundReport.roundId}.json`,
  );
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(outputPath, JSON.stringify(roundReport, null, 2));
}

async function main(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log("Auto-Voting Report Update");
  // eslint-disable-next-line no-console
  console.log("==========================");

  const db = openDatabase();
  const thor = ThorClient.at(getMainnetNodeUrl(), { isPollingEnabled: false });

  const xAllocationVotingAddress =
    "0x89A00Bb0947a30FF95BEeF77a66AEdE3842Fe5B7";

  const currentRoundId = await getCurrentRoundId(
    thor,
    xAllocationVotingAddress,
  );

  const lastProcessedBlock = Number(
    (db
      .prepare("SELECT value FROM meta WHERE key = 'last_processed_block'")
      .get() as { value?: string } | undefined)?.value ?? "0",
  );
  const lastReportedBlock = Number(
    (db
      .prepare("SELECT value FROM meta WHERE key = 'last_report_update_block'")
      .get() as { value?: string } | undefined)?.value ?? "0",
  );

  const fullRounds = getFullRoundRange(FIRST_AUTO_VOTING_ROUND, currentRoundId)

  const affectedRounds =
    lastProcessedBlock > lastReportedBlock
      ? getAffectedRoundsByBlockRange(db, lastReportedBlock, lastProcessedBlock)
      : []
  const roundsToBuild = selectRoundsToBuild({
    firstRoundId: FIRST_AUTO_VOTING_ROUND,
    currentRoundId,
    lastReportedBlock,
    affectedRounds,
    mutableRounds: getMutableRoundIds(db),
  })

  // Write per-round files (only affected rounds after first build).
  const generatedAt = new Date().toISOString();
  for (const roundId of roundsToBuild) {
    // eslint-disable-next-line no-console
    console.log(`Building analytics for round ${roundId}...`);
    const cached = await ensureRoundCached(db, thor, roundId, true);
    const round = buildRoundAnalytics(db, cached);
    const relayersForRound = buildRoundRelayers(db, roundId);
    const rr: RoundReport = {
      generatedAt,
      network: "mainnet",
      roundId,
      round,
      relayers: relayersForRound,
    };
    saveRoundReport(rr);
  }
  // eslint-disable-next-line no-console
  console.log(`Wrote ${roundsToBuild.length} per-round report files.`);

  // Rebuild all-time report.json from per-round files (no DB scans / chain calls).
  const rounds: RoundAnalytics[] = [];
  const relayerMap = new Map<string, RelayerRoundBreakdown[]>();

  for (const roundId of fullRounds) {
    const roundPath = path.join(
      process.cwd(),
      "public",
      "data",
      `report.${roundId}.json`,
    );
    if (!fs.existsSync(roundPath)) continue;
    const parsed = JSON.parse(fs.readFileSync(roundPath, "utf-8")) as RoundReport;
    rounds.push(parsed.round);
    for (const rr of parsed.relayers) {
      const list = relayerMap.get(rr.address) ?? [];
      list.push(rr.round);
      relayerMap.set(rr.address, list);
    }
  }
  rounds.sort((a, b) => a.roundId - b.roundId);

  const relayers: RelayerAnalytics[] = Array.from(relayerMap.entries())
    .map(([address, rds]) => ({
      address,
      rounds: rds.sort((a, b) => a.roundId - b.roundId),
    }))
    .sort((a, b) => a.address.localeCompare(b.address));

  const report: AnalyticsReport = {
    generatedAt,
    network: "mainnet",
    firstRound: FIRST_AUTO_VOTING_ROUND,
    currentRound: currentRoundId,
    rounds,
    relayers,
  };

  saveReport(report);

  db.prepare(
    "INSERT OR REPLACE INTO meta (key, value) VALUES ('last_report_update_block', ?)",
  ).run(String(lastProcessedBlock));
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Report update script failed:", error);
  process.exit(1);
});
