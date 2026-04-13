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
})

describe("claim round attribution", () => {
  it("attributes weight-1 actions to the claimed round", () => {
    expect(getStoredActionRoundId(93, 1)).toBe(94)
    expect(getStoredActionRoundId(93, 3)).toBe(93)
  })

  it("attributes claim events to the claimed round", () => {
    expect(getStoredClaimRoundId(93)).toBe(94)
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
