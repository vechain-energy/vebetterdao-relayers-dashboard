"use client"

import { Heading, Text, VStack } from "@chakra-ui/react"
import { useTranslation } from "react-i18next"

import { BaseModal } from "../Base/BaseModal"

interface InvalidUsersModalProps {
  isOpen: boolean
  onClose: () => void
}

export function InvalidUsersModal({ isOpen, onClose }: InvalidUsersModalProps) {
  const { t } = useTranslation()
  return (
    <BaseModal isOpen={isOpen} onClose={onClose} showCloseButton isCloseable>
      <VStack gap={4} align="stretch">
        <Heading size="lg" fontWeight="bold">
          {t("Invalid users")}
        </Heading>
        <Text textStyle="sm" color="text.subtle">
          {t("invalidUsersDescription")}
        </Text>
        <Text textStyle="sm" color="text.subtle">
          {t("invalidUsersImpact")}
        </Text>
      </VStack>
    </BaseModal>
  )
}
