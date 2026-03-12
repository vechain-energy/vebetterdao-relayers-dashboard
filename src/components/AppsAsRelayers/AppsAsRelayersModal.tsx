"use client";

import {
  Box,
  Button,
  Card,
  Heading,
  HStack,
  SimpleGrid,
  Text,
  VStack,
} from "@chakra-ui/react";
import NextLink from "next/link";
import { useTranslation } from "react-i18next";
import {
  LuLayoutGrid,
  LuServer,
  LuUsers,
  LuScale,
  LuCoins,
  LuZap,
} from "react-icons/lu";

import { BaseModal } from "../Base/BaseModal";

interface AppsAsRelayersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AppsAsRelayersModal({
  isOpen,
  onClose,
}: AppsAsRelayersModalProps) {
  const { t } = useTranslation();
  return (
    <BaseModal isOpen={isOpen} onClose={onClose} showCloseButton isCloseable>
      <VStack gap={5} align="stretch">
        <Heading size="lg" fontWeight="bold">
          {t("Autovoting as a Service")}
        </Heading>

        <VStack gap={2} align="start">
          <Text color="text.subtle">
            {t(
              "Relayers are services that cast votes and claim rewards for users who enabled auto-voting. Anyone can run one — apps, community members, developers. You earn a share of rewards for the work you do.",
            )}
          </Text>

          <HStack gap={4} align="start">
            <Box as="span" color="text.subtle" mt={1} flexShrink={0}>
              <LuZap />
            </Box>
            <VStack gap={1} align="start">
              <Text fontWeight="semibold">{t("What You Do")}</Text>
              <Text textStyle="sm" color="text.subtle">
                {t(
                  "You run a relayer node that watches the blockchain. When a new round starts, it sees who has auto-voting enabled, submits their votes, and claims their rewards in batches.",
                )}
              </Text>
            </VStack>
          </HStack>

          <HStack gap={4} align="start">
            <Box as="span" color="text.subtle" mt={1} flexShrink={0}>
              <LuCoins />
            </Box>
            <VStack gap={1} align="start">
              <Text fontWeight="semibold">{t("How You Earn")}</Text>
              <Text textStyle="sm" color="text.subtle">
                {t(
                  "Each user you serve pays 10% of their weekly rewards (max 100 B3TR) into a shared pool. At the end of the week, the pool is split among relayers based on work done.",
                )}
              </Text>
            </VStack>
          </HStack>

          <HStack gap={4} align="start">
            <Box as="span" color="text.subtle" mt={1} flexShrink={0}>
              <LuServer />
            </Box>
            <VStack gap={1} align="start">
              <Text fontWeight="semibold">{t("What You Need")}</Text>
              <Text textStyle="sm" color="text.subtle">
                {t(
                  "A wallet with some VTHO for gas, the relayer node software, and a connection to a VeChain Thor node.",
                )}
              </Text>
            </VStack>
          </HStack>

          <HStack gap={4} align="start">
            <Box as="span" color="text.subtle" mt={1} flexShrink={0}>
              <LuScale />
            </Box>
            <VStack gap={1} align="start">
              <Text fontWeight="semibold">{t("The Rules")}</Text>
              <Text textStyle="sm" color="text.subtle">
                {t(
                  "Every user must be served. If even one gets missed, nobody gets paid — the whole pool stays locked.",
                )}
              </Text>
            </VStack>
          </HStack>
        </VStack>
        <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
          <Card.Root variant="outline" p={5}>
            <VStack align="stretch" gap={3} justify="space-between" h="full">
              <Box as="span" color="blue.solid" fontSize="24px" lineHeight="1">
                <LuUsers />
              </Box>
              <Text fontWeight="semibold">
                {t("For Community Navigators \uD83C\uDF1F")}
              </Text>
              <Text textStyle="sm" color="text.subtle">
                {t(
                  "This is your chance to make an impact! \uD83D\uDE80 As a respected community member, run a relayer node to help decentralize the voting process and earn B3TR rewards for every vote you handle. Be the backbone of VeBetterDAO \uD83D\uDCAA",
                )}
              </Text>

              <NextLink href="/new-relayer" onClick={onClose}>
                <Button variant="primary" size="sm" rounded="full">
                  {t("Register as a Relayer")}
                </Button>
              </NextLink>
            </VStack>
          </Card.Root>

          <Card.Root variant="outline" p={5}>
            <VStack align="start" gap={3}>
              <Box as="span" color="blue.solid" fontSize="24px" lineHeight="1">
                <LuLayoutGrid />
              </Box>
              <Text fontWeight="semibold">{t("For X2Earn Apps")}</Text>
              <Text textStyle="sm" color="text.subtle">
                {t(
                  "As an app on VeBetterDAO, running your own relayer is a powerful economic opportunity. Your users set you as a preference, you execute their votes (directed to your app), and you earn relayer fees — all without anyone transferring funds or giving up custody of their tokens.",
                )}
              </Text>

              <Button variant="solid" size="sm" rounded="full" disabled>
                {t("SDK Coming Soon")}
              </Button>
            </VStack>
          </Card.Root>
        </SimpleGrid>
      </VStack>
    </BaseModal>
  );
}
