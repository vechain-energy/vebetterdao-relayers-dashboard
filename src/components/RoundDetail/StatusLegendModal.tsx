"use client"

import { Badge, HStack, Heading, Text, VStack } from "@chakra-ui/react"
import { useTranslation } from "react-i18next"

import { BaseModal } from "../Base/BaseModal"

interface StatusLegendModalProps {
  isOpen: boolean
  onClose: () => void
}

const statuses = [
  { labelKey: "All voted", descKey: "All voted desc", colorPalette: "green" },
  { labelKey: "Claims missing", descKey: "Claims missing desc", colorPalette: "red" },
  { labelKey: "Missed votes", descKey: "Missed votes desc", colorPalette: "orange" },
  { labelKey: "N/A", descKey: "N/A desc", colorPalette: "gray" },
]

export function StatusLegendModal({ isOpen, onClose }: StatusLegendModalProps) {
  const { t } = useTranslation()
  return (
    <BaseModal isOpen={isOpen} onClose={onClose} showCloseButton isCloseable>
      <VStack gap={5} align="stretch">
        <Heading size="lg" fontWeight="bold">
          {t("Round Statuses")}
        </Heading>
        <Text textStyle="sm" color="text.subtle">
          {t("Round status legend intro")}
        </Text>
        <VStack gap={4} align="stretch">
          {statuses.map(s => (
            <HStack key={s.labelKey} gap={3} align="start">
              <Badge size="sm" variant="solid" colorPalette={s.colorPalette} flexShrink={0} mt="1">
                {t(s.labelKey)}
              </Badge>
              <Text textStyle="sm" color="text.subtle">
                {t(s.descKey)}
              </Text>
            </HStack>
          ))}
        </VStack>
      </VStack>
    </BaseModal>
  )
}
