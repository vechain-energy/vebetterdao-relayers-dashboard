import * as fs from "fs"
import * as path from "path"

const PRIMARY_REPORT_PATH = path.join("public", "data", "report.json")
const LEGACY_REPORT_PATH = path.join(
  "apps",
  "relayer-dashboard",
  "public",
  "data",
  "report.json",
)

export interface RoundBuildSelectionInput {
  firstRoundId: number
  currentRoundId: number
  lastReportedBlock: number
  affectedRounds: number[]
  mutableRounds: number[]
}

export interface SnapshotRefreshSelectionInput {
  firstRoundId: number
  currentRoundId: number
  mutableRounds: number[]
  touchedClaimRounds: number[]
}

function normalizeRoundIds(
  roundIds: Iterable<number>,
  firstRoundId: number,
  currentRoundId: number,
): number[] {
  return Array.from(new Set(roundIds))
    .filter((roundId) => roundId >= firstRoundId && roundId <= currentRoundId)
    .sort((a, b) => a - b)
}

export function getFullRoundRange(
  firstRoundId: number,
  currentRoundId: number,
): number[] {
  if (currentRoundId < firstRoundId) return []

  return Array.from(
    { length: currentRoundId - firstRoundId + 1 },
    (_, index) => firstRoundId + index,
  )
}

export function getStoredActionRoundId(
  roundId: number,
  weight: number,
): number {
  return weight === 1 ? roundId + 1 : roundId
}

export function getStoredClaimRoundId(claimedCycle: number): number {
  return claimedCycle + 1
}

export function selectClaimableSnapshotRefreshRounds(
  input: SnapshotRefreshSelectionInput,
): number[] {
  const { firstRoundId, currentRoundId, mutableRounds, touchedClaimRounds } =
    input

  return normalizeRoundIds(
    [...mutableRounds, ...touchedClaimRounds],
    firstRoundId,
    currentRoundId,
  )
}

export function selectRoundsToBuild(
  input: RoundBuildSelectionInput,
): number[] {
  const {
    firstRoundId,
    currentRoundId,
    lastReportedBlock,
    affectedRounds,
    mutableRounds,
  } = input

  if (lastReportedBlock === 0) {
    return getFullRoundRange(firstRoundId, currentRoundId)
  }

  return normalizeRoundIds(
    [...affectedRounds, ...mutableRounds, currentRoundId],
    firstRoundId,
    currentRoundId,
  )
}

export function getAggregateReportOutputPaths(rootDir: string): string[] {
  return [
    path.join(rootDir, PRIMARY_REPORT_PATH),
    path.join(rootDir, LEGACY_REPORT_PATH),
  ]
}

export function writeMirroredAggregateReport(
  rootDir: string,
  report: unknown,
): string[] {
  const output = JSON.stringify(report, null, 2)
  const outputPaths = getAggregateReportOutputPaths(rootDir)

  for (const outputPath of outputPaths) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    fs.writeFileSync(outputPath, output)
  }

  return outputPaths
}
