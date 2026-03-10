"use client"

import { useCallClause } from "@vechain/vechain-kit"

import { xAllocationAbi, xAllocationAddress } from "./contracts"

export function useTotalVoters(roundId: number | undefined) {
  return useCallClause({
    abi: xAllocationAbi,
    address: xAllocationAddress,
    method: "totalVoters",
    args: [BigInt(roundId ?? 0)],
    queryOptions: {
      enabled: roundId != null,
      select: (data) => (data[0] != null ? Number(data[0]) : undefined),
    },
  })
}
