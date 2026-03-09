"use client"

import { Badge, HStack, Heading, Text, VStack } from "@chakra-ui/react"

import { BaseModal } from "../Base/BaseModal"

interface StatusLegendModalProps {
  isOpen: boolean
  onClose: () => void
}

const statuses = [
  {
    label: "All voted",
    colorPalette: "green",
    description: "Every eligible auto-voting user was successfully voted for during this round.",
  },
  {
    label: "Missed votes",
    colorPalette: "orange",
    description:
      "Some eligible users were not voted for. This can happen if a relayer goes offline or encounters errors during the voting window.",
  },
  {
    label: "N/A",
    colorPalette: "gray",
    description: "No auto-voting users were registered for this round, so no actions were expected.",
  },
]

export function StatusLegendModal({ isOpen, onClose }: StatusLegendModalProps) {
  return (
    <BaseModal isOpen={isOpen} onClose={onClose} showCloseButton isCloseable>
      <VStack gap={5} align="stretch">
        <Heading size="lg" fontWeight="bold">
          {"Round Statuses"}
        </Heading>
        <Text textStyle="sm" color="text.subtle">
          {"Each voting round is assigned a status based on whether all eligible users were voted for by the relayers."}
        </Text>
        <VStack gap={4} align="stretch">
          {statuses.map(s => (
            <HStack key={s.label} gap={3} align="start">
              <Badge size="sm" variant="solid" colorPalette={s.colorPalette} flexShrink={0} mt="1">
                {s.label}
              </Badge>
              <Text textStyle="sm" color="text.subtle">
                {s.description}
              </Text>
            </HStack>
          ))}
        </VStack>
      </VStack>
    </BaseModal>
  )
}
