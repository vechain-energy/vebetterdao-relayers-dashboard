"use client";

import {
  Badge,
  Box,
  Button,
  Card,
  Grid,
  HStack,
  IconButton,
  SimpleGrid,
  Text,
  VStack,
} from "@chakra-ui/react";
import NextLink from "next/link";
import { type ReactNode, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaAngleRight } from "react-icons/fa6";
import { LuChevronDown, LuCoins, LuFlame, LuTarget } from "react-icons/lu";

import { useB3trToVthoRate } from "@/hooks/useB3trToVthoRate";
import { formatNumber, formatToken } from "@/lib/format";
import {
  computeRelayerROI,
  computeRelayerRoundB3tr,
  computeRelayerSummary,
  type RelayerSummary,
  type RoundRewardsContextEntry,
} from "@/lib/relayer-utils";
import { parseRoundStatus } from "@/lib/round-utils";
import type { RelayerAnalytics, RoundAnalytics } from "@/lib/types";

function SectionHeader({ title, icon }: { title: string; icon?: ReactNode }) {
  return (
    <HStack justify="space-between" w="full">
      <Text
        textStyle="xs"
        fontWeight="bold"
        letterSpacing="wider"
        textTransform="uppercase"
        color="text.subtle"
      >
        {title}
      </Text>
      {icon && (
        <Box as="span" color="text.subtle" fontSize="20px" lineHeight="1">
          {icon}
        </Box>
      )}
    </HStack>
  );
}

function MetricCell({
  label,
  value,
  unit,
  valueColor,
}: {
  label: string;
  value: string | number;
  unit?: string;
  valueColor?: string;
}) {
  return (
    <VStack gap="1" align="start">
      <Text textStyle="xs" color="text.subtle" fontWeight="semibold">
        {label}
      </Text>
      <HStack gap="1" align="baseline">
        <Text
          textStyle={{ base: "xl", md: "2xl" }}
          fontWeight="bold"
          color={valueColor}
        >
          {value}
        </Text>
        {unit && (
          <Text textStyle="sm" color="text.subtle">
            {unit}
          </Text>
        )}
      </HStack>
    </VStack>
  );
}

function StatPill({
  label,
  value,
  unit,
  valueColor,
}: {
  label: string;
  value?: string | number;
  unit?: string;
  valueColor?: string;
}) {
  return (
    <VStack gap="0" align="start" minW="0" justifyContent="center">
      <Text textStyle="xxs" color="text.subtle" lineClamp={1}>
        {label}
      </Text>
      {value != null && (
        <HStack gap="1" align="baseline">
          <Text
            textStyle="sm"
            fontWeight="semibold"
            lineClamp={1}
            color={valueColor}
          >
            {value}
          </Text>
          {unit && (
            <Text textStyle="xxs" color="text.subtle">
              {unit}
            </Text>
          )}
        </HStack>
      )}
    </VStack>
  );
}

function RoundRow({
  rd,
  claimedFor,
  b3trRaw,
  b3trToVtho,
  totalWeighted,
  roundAnalytics,
  currentRound,
  t,
}: {
  rd: RelayerAnalytics["rounds"][number];
  claimedFor: number;
  b3trRaw: string;
  b3trToVtho: number | undefined;
  totalWeighted?: number;
  roundAnalytics?: RoundAnalytics;
  currentRound: number;
  t: (key: string) => string;
}) {
  const vthoSpentRaw = (
    BigInt(rd.vthoSpentOnVotingRaw) + BigInt(rd.vthoSpentOnClaimingRaw)
  ).toString();
  const roi = computeRelayerROI(b3trRaw, vthoSpentRaw, b3trToVtho);
  const isActive = rd.roundId === currentRound;

  const weightPct =
    totalWeighted && totalWeighted > 0
      ? (rd.weightedActions / totalWeighted) * 100
      : null;

  const status = roundAnalytics
    ? parseRoundStatus(roundAnalytics, currentRound)
    : null;

  const stats = (
    <>
      <StatPill
        label={t("Voted for")}
        value={rd.votedForCount}
        unit={t("users")}
      />
      <StatPill label={t("Claimed for")} value={claimedFor} unit={t("users")} />
      <StatPill
        label={t("Weight")}
        value={
          weightPct != null
            ? `${formatNumber(parseFloat(weightPct.toFixed(2)))}%`
            : "\u2014"
        }
      />
      <StatPill
        label={isActive ? t("Projected B3TR rewards") : t("B3TR earned")}
        value={formatToken(b3trRaw)}
        unit="B3TR"
      />
      <StatPill
        label={t("VTHO spent")}
        value={formatToken(vthoSpentRaw)}
        unit="VTHO"
      />
      <StatPill
        label={isActive ? t("Projected ROI") : t("ROI")}
        value={roi != null ? `${formatNumber(Math.round(roi))}%` : "\u2014"}
        valueColor={roi != null ? "status.positive.primary" : undefined}
      />
    </>
  );

  return (
    <NextLink
      href={`/round?roundId=${rd.roundId}`}
      style={{ textDecoration: "none", color: "inherit" }}
    >
      <Card.Root variant="action">
        <Card.Body>
          {/* Desktop */}
          <Box hideBelow="md">
            <HStack justify="space-between" w="full" gap="2">
              <SimpleGrid columns={8} gap="4" w="full" alignItems="center">
                <VStack gap="0" align="start" minW="0" justifyContent="center">
                  <Text textStyle="xxs" color="text.subtle" lineClamp={1}>
                    {t("Round")}
                  </Text>
                  <Text fontWeight="bold" textStyle="sm">
                    {"#"}
                    {rd.roundId}
                  </Text>
                </VStack>
                {stats}
                {status && (
                  <VStack gap="0" align="start" minW="0" justifyContent="center">
                    <Text textStyle="xxs" color="text.subtle" lineClamp={1}>
                      {t("Status")}
                    </Text>
                    <Badge
                      size="sm"
                      variant="solid"
                      colorPalette={status.colorPalette}
                    >
                      {t(status.label)}
                    </Badge>
                  </VStack>
                )}
              </SimpleGrid>
              <IconButton
                aria-label={t("Go to round")}
                variant="ghost"
                size="sm"
              >
                <FaAngleRight />
              </IconButton>
            </HStack>
          </Box>

          {/* Mobile */}
          <Box hideFrom="md">
            <VStack gap="2" align="stretch" w="full">
              <HStack justify="space-between" w="full">
                <HStack gap="2">
                  <Text fontWeight="bold" textStyle="sm">
                    {"#"}
                    {rd.roundId}
                  </Text>
                  {status && (
                    <Badge
                      size="sm"
                      variant="solid"
                      colorPalette={status.colorPalette}
                    >
                      {t(status.label)}
                    </Badge>
                  )}
                </HStack>
                <IconButton
                  aria-label={t("Go to round")}
                  variant="ghost"
                  size="sm"
                >
                  <FaAngleRight />
                </IconButton>
              </HStack>
              <SimpleGrid columns={{ base: 2, sm: 3 }} gap="2">
                {stats}
              </SimpleGrid>
            </VStack>
          </Box>
        </Card.Body>
      </Card.Root>
    </NextLink>
  );
}

const ROUNDS_PAGE_SIZE = 3;

interface RelayerDetailContentProps {
  relayer: RelayerAnalytics;
  currentRound: number;
  reportRounds?: RoundAnalytics[];
  roundCtx?: Map<number, RoundRewardsContextEntry>;
  /** When provided, used instead of computing (ensures consistency with list/top relayers). */
  summary?: RelayerSummary;
}

export function RelayerDetailContent({
  relayer,
  currentRound,
  reportRounds,
  roundCtx,
  summary: summaryProp,
}: RelayerDetailContentProps) {
  const { t } = useTranslation();
  const b3trToVtho = useB3trToVthoRate();
  const summary =
    summaryProp ?? computeRelayerSummary(relayer, roundCtx, currentRound);
  const roi = computeRelayerROI(
    summary.totalB3trEarnedRaw,
    summary.totalVthoSpentRaw,
    b3trToVtho,
  );
  const [visibleCount, setVisibleCount] = useState(ROUNDS_PAGE_SIZE);

  const roundAnalyticsMap = useMemo(() => {
    const map = new Map<number, RoundAnalytics>();
    for (const r of reportRounds ?? []) map.set(r.roundId, r);
    return map;
  }, [reportRounds]);

  const roundsDesc = [...relayer.rounds].sort((a, b) => b.roundId - a.roundId);
  const visibleRounds = roundsDesc.slice(0, visibleCount);
  const hasMore = visibleCount < roundsDesc.length;

  return (
    <VStack gap="6" align="stretch">
      <Grid templateColumns={{ base: "1fr", lg: "1fr 1fr" }} gap="4">
        <Card.Root variant="primary">
          <Card.Body>
            <VStack gap="4" align="stretch">
              <SectionHeader
                title={t("Performance Overview")}
                icon={<LuTarget />}
              />
              <SimpleGrid columns={2} gap="4">
                <MetricCell
                  label={t("Voted for")}
                  value={formatNumber(summary.totalVotedFor)}
                  unit={t("users")}
                />
                <MetricCell
                  label={t("Claimed rewards for")}
                  value={formatNumber(summary.totalRewardsClaimed)}
                  unit={t("users")}
                />
                <MetricCell
                  label={t("Participated in")}
                  value={formatNumber(summary.activeRoundsCount)}
                  unit={t("rounds")}
                />
              </SimpleGrid>
            </VStack>
          </Card.Body>
        </Card.Root>

        <Card.Root variant="primary">
          <Card.Body>
            <VStack gap="4" align="stretch">
              <SectionHeader title={t("Financials")} icon={<LuCoins />} />
              <SimpleGrid columns={2} gap="4">
                <MetricCell
                  label={t("B3TR earned")}
                  value={formatToken(summary.totalB3trEarnedRaw)}
                  unit="B3TR"
                />
                <MetricCell
                  label={t("VTHO spent")}
                  value={formatToken(summary.totalVthoSpentRaw)}
                  unit="VTHO"
                />
                <MetricCell
                  label={t("ROI")}
                  value={
                    roi != null ? `${formatNumber(Math.round(roi))}%` : "\u2014"
                  }
                  valueColor={
                    roi != null ? "status.positive.primary" : undefined
                  }
                />
                <MetricCell
                  label={t("Average per action")}
                  value={
                    summary.totalActions > 0
                      ? formatToken(
                          (
                            BigInt(summary.totalVthoSpentRaw) /
                            BigInt(summary.totalActions)
                          ).toString(),
                        )
                      : "\u2014"
                  }
                  unit="VTHO"
                />
              </SimpleGrid>
            </VStack>
          </Card.Body>
        </Card.Root>
      </Grid>

      <VStack gap="4" align="stretch">
        <SectionHeader title={t("Activity")} icon={<LuFlame />} />
        {roundsDesc.length === 0 ? (
          <Text textStyle="sm" color="text.subtle">
            {t("No round data available.")}
          </Text>
        ) : (
          <VStack gap="3" align="stretch">
            {visibleRounds.map((rd) => {
              const ctx = roundCtx?.get(rd.roundId);
              const isActiveRound = rd.roundId === currentRound;
              const effectiveCtx =
                isActiveRound && ctx
                  ? {
                      poolRaw: ctx.estimatedPoolRaw,
                      totalWeighted: ctx.totalWeighted,
                    }
                  : ctx;
              return (
                <RoundRow
                  key={rd.roundId}
                  rd={rd}
                  claimedFor={rd.rewardsClaimedCount}
                  roundAnalytics={roundAnalyticsMap.get(rd.roundId)}
                  currentRound={currentRound}
                  b3trToVtho={b3trToVtho}
                  totalWeighted={ctx?.totalWeighted}
                  b3trRaw={
                    roundCtx
                      ? computeRelayerRoundB3tr(
                          rd.weightedActions,
                          effectiveCtx,
                        ).toString()
                      : rd.claimableRewardsRaw
                  }
                  t={t}
                />
              );
            })}
            {hasMore && (
              <Button
                variant="ghost"
                size="sm"
                alignSelf="center"
                onClick={() =>
                  setVisibleCount((prev) => prev + ROUNDS_PAGE_SIZE)
                }
              >
                <LuChevronDown />
                {t("Load more")}
              </Button>
            )}
          </VStack>
        )}
      </VStack>
    </VStack>
  );
}
