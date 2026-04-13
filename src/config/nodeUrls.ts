export const DEFAULT_MAINNET_NODE_URL = "https://mainnet.vechain.org"
export const DEFAULT_TESTNET_NODE_URL = "https://testnet.vechain.org"
export const DEFAULT_MAINNET_NODE_URLS = [
  DEFAULT_MAINNET_NODE_URL,
  "https://vethor-node.vechain.com",
  "https://node-mainnet.vechain.energy",
  "https://mainnet.vecha.in",
]
export const DEFAULT_TESTNET_NODE_URLS = [DEFAULT_TESTNET_NODE_URL]

function readConfiguredUrl(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim()
    if (value) return value
  }

  return undefined
}

export function getMainnetNodeUrl(): string {
  return (
    readConfiguredUrl("MAINNET_NODE_URL", "NEXT_PUBLIC_MAINNET_NODE_URL") ||
    DEFAULT_MAINNET_NODE_URL
  )
}

export function getTestnetNodeUrl(): string {
  return (
    readConfiguredUrl("TESTNET_NODE_URL", "NEXT_PUBLIC_TESTNET_NODE_URL") ||
    DEFAULT_TESTNET_NODE_URL
  )
}

export function withPreferredNodeUrl(
  urls: string[],
  preferredUrl: string,
): string[] {
  return [preferredUrl, ...urls.filter((url) => url !== preferredUrl)]
}

export function getNodePoolForEnv(
  env: "mainnet" | "testnet-staging",
): string[] {
  if (env === "mainnet") {
    return withPreferredNodeUrl(DEFAULT_MAINNET_NODE_URLS, getMainnetNodeUrl())
  }

  return withPreferredNodeUrl(DEFAULT_TESTNET_NODE_URLS, getTestnetNodeUrl())
}
