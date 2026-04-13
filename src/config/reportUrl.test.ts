import { describe, expect, it } from "vitest"

import { getReportUrl } from "./reportUrl"

describe("getReportUrl", () => {
  it("falls back to the bundled report asset when no runtime override is set", () => {
    expect(getReportUrl()).toBe("/data/report.json")
    expect(
      getReportUrl({
        basePathOverride: "/vebetterdao-relayers-dashboard",
      }),
    ).toBe("/vebetterdao-relayers-dashboard/data/report.json")
  })

  it("returns the configured runtime report URL when one is provided", () => {
    expect(
      getReportUrl({
        reportUrlOverride:
          " https://raw.githubusercontent.com/org/repo/main/public/data/report.json ",
      }),
    ).toBe(
      "https://raw.githubusercontent.com/org/repo/main/public/data/report.json",
    )
  })

  it("ignores empty runtime overrides and keeps the bundled asset path", () => {
    expect(
      getReportUrl({
        reportUrlOverride: "   ",
        basePathOverride: "/vebetterdao-relayers-dashboard",
      }),
    ).toBe("/vebetterdao-relayers-dashboard/data/report.json")
  })
})
