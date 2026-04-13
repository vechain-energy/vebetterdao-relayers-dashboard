import { afterEach, describe, expect, it } from "vitest"

import {
  DEFAULT_MAINNET_NODE_URL,
  DEFAULT_TESTNET_NODE_URL,
  getMainnetNodeUrl,
  getNodePoolForEnv,
  getTestnetNodeUrl,
} from "./nodeUrls"

const ORIGINAL_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe("node URL resolution", () => {
  it("prefers explicit server-side mainnet configuration", () => {
    process.env.MAINNET_NODE_URL = "https://rpc.internal.example"
    process.env.NEXT_PUBLIC_MAINNET_NODE_URL = "https://rpc.public.example"

    expect(getMainnetNodeUrl()).toBe("https://rpc.internal.example")
  })

  it("falls back to public browser configuration when no server-side mainnet override exists", () => {
    delete process.env.MAINNET_NODE_URL
    process.env.NEXT_PUBLIC_MAINNET_NODE_URL = "https://rpc.public.example"

    expect(getMainnetNodeUrl()).toBe("https://rpc.public.example")
  })

  it("uses the default URLs when no overrides are configured", () => {
    delete process.env.MAINNET_NODE_URL
    delete process.env.NEXT_PUBLIC_MAINNET_NODE_URL
    delete process.env.TESTNET_NODE_URL
    delete process.env.NEXT_PUBLIC_TESTNET_NODE_URL

    expect(getMainnetNodeUrl()).toBe(DEFAULT_MAINNET_NODE_URL)
    expect(getTestnetNodeUrl()).toBe(DEFAULT_TESTNET_NODE_URL)
  })

  it("places the configured mainnet node at the front of the browser runner pool", () => {
    process.env.NEXT_PUBLIC_MAINNET_NODE_URL = "https://mainnet.vecha.in"

    expect(getNodePoolForEnv("mainnet")).toEqual([
      "https://mainnet.vecha.in",
      "https://mainnet.vechain.org",
      "https://vethor-node.vechain.com",
      "https://node-mainnet.vechain.energy",
    ])
  })

  it("builds the testnet browser runner pool from the configured override", () => {
    process.env.NEXT_PUBLIC_TESTNET_NODE_URL = "https://testnet.custom.example"

    expect(getNodePoolForEnv("testnet-staging")).toEqual([
      "https://testnet.custom.example",
      DEFAULT_TESTNET_NODE_URL,
    ])
  })
})
