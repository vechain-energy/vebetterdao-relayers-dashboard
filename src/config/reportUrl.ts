import { withBasePath } from "./basePath"

interface GetReportUrlOptions {
  basePathOverride?: string
  reportUrlOverride?: string
}

function normalizeReportUrl(value?: string): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export function getReportUrl(options: GetReportUrlOptions = {}): string {
  const configuredUrl = normalizeReportUrl(options.reportUrlOverride)
  if (configuredUrl) return configuredUrl

  return withBasePath("/data/report.json", options.basePathOverride)
}

export const reportUrl = getReportUrl({
  reportUrlOverride: process.env.NEXT_PUBLIC_REPORT_URL,
})
