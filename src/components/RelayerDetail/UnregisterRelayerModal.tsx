"use client"

import { Button, Heading, HStack, Text, VStack } from "@chakra-ui/react"
import { useQueryClient } from "@tanstack/react-query"
import { useSendTransaction, useWallet } from "@vechain/vechain-kit"
import { useTranslation } from "react-i18next"
import { LuTriangleAlert } from "react-icons/lu"
import { encodeFunctionData } from "viem"

import { relayerPoolAbi, relayerPoolAddress } from "@/hooks/contracts"

import { BaseModal } from "../Base/BaseModal"

interface UnregisterRelayerModalProps {
  isOpen: boolean
  onClose: () => void
  relayerAddress: string
}

export function UnregisterRelayerModal({
  isOpen,
  onClose,
  relayerAddress,
}: UnregisterRelayerModalProps) {
  const { t } = useTranslation()
  const { account } = useWallet()
  const queryClient = useQueryClient()

  const { sendTransaction, isTransactionPending, resetStatus } =
    useSendTransaction({
      signerAccountAddress: account?.address ?? "",
      onTxConfirmed: () => {
        queryClient.invalidateQueries()
        onClose()
      },
    })

  const handleUnregister = async () => {
    resetStatus()

    await sendTransaction([
      {
        to: relayerPoolAddress,
        value: "0x0",
        data: encodeFunctionData({
          abi: relayerPoolAbi,
          functionName: "unregisterRelayer",
          args: [relayerAddress as `0x${string}`],
        }),
        comment: "Unregister relayer",
      },
    ])
  }

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} showCloseButton isCloseable>
      <VStack gap={5} align="stretch">
        <HStack gap="3" color="fg.error">
          <LuTriangleAlert size={24} />
          <Heading size="md" fontWeight="bold">
            {t("Unregister relayer")}
          </Heading>
        </HStack>

        <Text color="text.subtle" textStyle="sm">
          {t(
            "This will remove your address from the registered relayers list. You will no longer be able to vote or claim rewards on behalf of users, and you will stop earning relayer fees.",
          )}
        </Text>

        <Text color="text.subtle" textStyle="sm">
          {t("You can re-register at any time, but any in-progress round work will be lost.")}
        </Text>

        <HStack gap="3" pt="2">
          <Button
            colorPalette="red"
            variant="solid"
            size="md"
            rounded="full"
            onClick={handleUnregister}
            loading={isTransactionPending}
            loadingText={t("Unregistering...")}
          >
            <LuTriangleAlert />
            {t("Unregister")}
          </Button>
          <Button variant="ghost" size="md" rounded="full" onClick={onClose}>
            {t("Cancel")}
          </Button>
        </HStack>
      </VStack>
    </BaseModal>
  )
}
