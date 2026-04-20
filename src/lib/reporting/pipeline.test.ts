import * as fs from "fs"
import * as os from "os"
import * as path from "path"

import { afterEach, describe, expect, it } from "vitest"

import {
  getAggregateReportOutputPaths,
  getStoredActionRoundId,
  getStoredClaimRoundId,
  selectClaimableSnapshotRefreshRounds,
  selectRoundsToBuild,
  shouldRefreshRoundCache,
  writeMirroredAggregateReport,
} from "./pipeline"

const tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe("selectRoundsToBuild", () => {
  it("builds the full range on bootstrap", () => {
    expect(
      selectRoundsToBuild({
        firstRoundId: 69,
        currentRoundId: 72,
        lastReportedBlock: 0,
        affectedRounds: [71],
        mutableRounds: [72],
      }),
    ).toEqual([69, 70, 71, 72])
  })

  it("builds only affected, mutable, and current rounds after bootstrap", () => {
    expect(
      selectRoundsToBuild({
        firstRoundId: 69,
        currentRoundId: 95,
        lastReportedBlock: 123,
        affectedRounds: [90, 92, 92],
        mutableRounds: [94, 95],
      }),
    ).toEqual([90, 92, 94, 95])
  })

  it("does not rebuild untouched finalized rounds", () => {
    expect(
      selectRoundsToBuild({
        firstRoundId: 69,
        currentRoundId: 95,
        lastReportedBlock: 456,
        affectedRounds: [],
        mutableRounds: [95],
      }),
    ).toEqual([95])
  })

  it("rebuilds the previous round when late claims land in the next round", () => {
    expect(
      selectRoundsToBuild({
        firstRoundId: 69,
        currentRoundId: 95,
        lastReportedBlock: 789,
        affectedRounds: [94],
        mutableRounds: [95],
      }),
    ).toEqual([94, 95])
  })
})

describe("claim round attribution", () => {
  it("attributes weight-1 actions to the claimed round", () => {
    expect(getStoredActionRoundId(93, 1)).toBe(93)
    expect(getStoredActionRoundId(93, 3)).toBe(93)
  })

  it("attributes claim events to the claimed round", () => {
    expect(getStoredClaimRoundId(93)).toBe(93)
  })

  it("refreshes mutable rounds and touched claimed rounds only", () => {
    expect(
      selectClaimableSnapshotRefreshRounds({
        firstRoundId: 69,
        currentRoundId: 95,
        mutableRounds: [94, 95],
        touchedClaimRounds: [90, 94],
      }),
    ).toEqual([90, 94, 95])
  })
})

describe("shouldRefreshRoundCache", () => {
  const completeRound = {
    snapshotBlock: 1,
    deadlineBlock: 2,
    isRoundEnded: 1,
    numRelayers: 3,
    autoVotingUsersCount: 4,
    contractAutoVotingUsersCount: 4,
    reducedUsersCount: 0,
    expectedActions: 12,
    completedActions: 12,
    missedUsersCount: 0,
    totalRelayerRewardsRaw: 100,
    estimatedRelayerRewardsRaw: 100,
  }

  it("refreshes stale rows when forced even if every field is populated", () => {
    expect(shouldRefreshRoundCache(completeRound, true)).toBe(true)
  })

  it("keeps complete cached rows when refresh is not forced", () => {
    expect(shouldRefreshRoundCache(completeRound)).toBe(false)
  })

  it("refreshes incomplete cached rows", () => {
    expect(
      shouldRefreshRoundCache({
        ...completeRound,
        isRoundEnded: null,
      }),
    ).toBe(true)
  })
})

describe("writeMirroredAggregateReport", () => {
  it("writes identical aggregate report JSON to the primary and legacy paths", () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "report-pipeline-"))
    tempDirs.push(rootDir)

    const report = {
      currentRound: 95,
      rounds: [{ roundId: 95 }],
    }

    const outputPaths = writeMirroredAggregateReport(rootDir, report)
    expect(outputPaths).toEqual(getAggregateReportOutputPaths(rootDir))

    const primaryPath = outputPaths[0]!
    const legacyPath = outputPaths[1]!
    expect(fs.readFileSync(primaryPath, "utf8")).toBe(
      fs.readFileSync(legacyPath, "utf8"),
    )
  })
})
