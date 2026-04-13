import type { RoundAnalytics } from "./types"

export type RoundStatusKey =
  | "na"
  | "rewardsLocked"
  | "votingInProgress"
  | "votingComplete"
  | "claimingInProgress"
  | "actionsCompleted"

export interface RoundStatus {
  key: RoundStatusKey
  label: string
  colorPalette: string
}

export interface RoundProgress {
  pct: number
  label: string
  hint: string
  colorPalette: string
}

function getEligibleUsers(round: RoundAnalytics): number {
  return Math.max(0, round.autoVotingUsersCount - round.reducedUsersCount)
}

/**
 * Determines the status of a round.
 *
 * Lifecycle:
 *   Active round  → relayers can only VOTE (claims happen after round ends)
 *   Ended round   → relayers can CLAIM rewards for users from this round
 *   Once all votes + claims are done → pool unlocks and relayers get paid
 *   If any user was missed (vote or claim) → pool stays locked permanently
 *
 * @param currentRoundId – the live current round. Used to distinguish
 *   "claiming in progress" (round N-1 while current is N) from
 *   "rewards locked" (round is 2+ rounds behind → relayers ran out of time).
 */
export function parseRoundStatus(round: RoundAnalytics, currentRoundId?: number): RoundStatus {
  if (round.autoVotingUsersCount === 0 || round.actionStatus === "N/A") {
    return { key: "na", label: "N/A", colorPalette: "gray" }
  }

  const eligible = getEligibleUsers(round)
  const votingDone = eligible === 0 || round.votedForCount >= eligible

  if (!round.isRoundEnded) {
    return votingDone
      ? { key: "votingComplete", label: "Voting complete", colorPalette: "blue" }
      : { key: "votingInProgress", label: "Voting in progress", colorPalette: "yellow" }
  }

  const allDone =
    round.allActionsOk ||
    (round.expectedActions > 0 && round.completedActions >= round.expectedActions)

  if (allDone) {
    return { key: "actionsCompleted", label: "Actions completed", colorPalette: "green" }
  }

  if (!votingDone) {
    return { key: "rewardsLocked", label: "Rewards Locked", colorPalette: "red" }
  }

  // Votes done but claims pending.
  // Only the immediately previous round can still be claiming;
  // anything older means relayers ran out of time.
  const isRecentEnough =
    currentRoundId != null && round.roundId >= currentRoundId - 1

  if (isRecentEnough) {
    return { key: "claimingInProgress", label: "Claiming in progress", colorPalette: "purple" }
  }

  return { key: "rewardsLocked", label: "Rewards Locked", colorPalette: "red" }
}

/**
 * Returns contextual progress info for the round's current phase.
 * Tells the relayer exactly what's happening and what to do next.
 */
export function computeRoundProgress(round: RoundAnalytics, currentRoundId?: number): RoundProgress {
  const status = parseRoundStatus(round, currentRoundId)
  const eligible = getEligibleUsers(round)

  switch (status.key) {
    case "na":
      return { pct: 0, label: "Round Progress", hint: "roundProgressHintNA", colorPalette: "gray" }

    case "votingInProgress": {
      const pct = eligible > 0 ? Math.min(100, Math.round((round.votedForCount / eligible) * 100)) : 0
      return { pct, label: "Voting Progress", hint: "roundProgressHintVoting", colorPalette: "blue" }
    }

    case "votingComplete":
      return { pct: 100, label: "Voting Progress", hint: "roundProgressHintVotingComplete", colorPalette: "blue" }

    case "claimingInProgress": {
      const pct = eligible > 0 ? Math.min(100, Math.round((round.rewardsClaimedCount / eligible) * 100)) : 0
      return { pct, label: "Claiming Progress", hint: "roundProgressHintClaiming", colorPalette: "purple" }
    }

    case "actionsCompleted":
      return { pct: 100, label: "Round Progress", hint: "roundProgressHintComplete", colorPalette: "green" }

    case "rewardsLocked": {
      const pct = round.expectedActions > 0 ? Math.round((round.completedActions / round.expectedActions) * 100) : 0
      return { pct, label: "Round Progress", hint: "roundProgressHintLocked", colorPalette: "red" }
    }
  }
}

/** Whether a round's reward pool is locked (missed votes/claims, or too much time passed). */
export function isRoundRewardsLocked(round: RoundAnalytics, currentRoundId?: number): boolean {
  return parseRoundStatus(round, currentRoundId).key === "rewardsLocked"
}
