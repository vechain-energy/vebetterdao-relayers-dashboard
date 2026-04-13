import { describe, expect, it } from "vitest"

import { normalizeBasePath, toAppUrl, withBasePath } from "./basePath"

describe("normalizeBasePath", () => {
  it("normalizes empty and slash-only values to an empty base path", () => {
    expect(normalizeBasePath(undefined)).toBe("")
    expect(normalizeBasePath("")).toBe("")
    expect(normalizeBasePath("/")).toBe("")
  })

  it("adds a leading slash and removes trailing slashes", () => {
    expect(normalizeBasePath("vebetterdao-relayers-dashboard")).toBe(
      "/vebetterdao-relayers-dashboard",
    )
    expect(normalizeBasePath("/vebetterdao-relayers-dashboard/")).toBe(
      "/vebetterdao-relayers-dashboard",
    )
  })
})

describe("withBasePath", () => {
  it("returns root-relative paths when the base path is empty", () => {
    expect(withBasePath("/relayers", "")).toBe("/relayers")
    expect(withBasePath("/assets/vb.svg", "")).toBe("/assets/vb.svg")
  })

  it("prefixes routes and assets exactly once for repo-subpath builds", () => {
    const repoBasePath = "/vebetterdao-relayers-dashboard"

    expect(withBasePath("/relayers", repoBasePath)).toBe(
      "/vebetterdao-relayers-dashboard/relayers",
    )
    expect(withBasePath("/assets/vb.svg", repoBasePath)).toBe(
      "/vebetterdao-relayers-dashboard/assets/vb.svg",
    )
    expect(
      withBasePath(
        "/vebetterdao-relayers-dashboard/assets/vb.svg",
        repoBasePath,
      ),
    ).toBe("/vebetterdao-relayers-dashboard/assets/vb.svg")
  })
})

describe("toAppUrl", () => {
  it("preserves existing query strings and appends search params without double slashes", () => {
    const url = toAppUrl(
      "/relayer?tab=overview",
      { address: "0x1234" },
      {
        basePath: "/vebetterdao-relayers-dashboard",
        origin: "https://example.com",
      },
    )

    expect(url).toBe(
      "https://example.com/vebetterdao-relayers-dashboard/relayer?tab=overview&address=0x1234",
    )
  })

  it("returns app-relative URLs when no origin is provided", () => {
    expect(
      toAppUrl("/round", "roundId=94", {
        basePath: "/vebetterdao-relayers-dashboard",
      }),
    ).toBe("/vebetterdao-relayers-dashboard/round?roundId=94")
  })
})
