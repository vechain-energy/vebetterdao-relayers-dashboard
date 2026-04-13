"use client";

import {
  Box,
  Card,
  Grid,
  Heading,
  HStack,
  Link,
  Separator,
  Tabs,
  Text,
  VStack,
} from "@chakra-ui/react";
import NextLink from "next/link";
import { useTranslation } from "react-i18next";
import {
  LuBookOpen,
  LuCode,
  LuExternalLink,
  LuFileText,
  LuGithub,
  LuHouse,
  LuPlay,
  LuRadar,
} from "react-icons/lu";

import { AiSkillBanner } from "./Banners";

function B3trIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 1578.5 1578.5" fill="currentColor" {...props}>
      <path d="M812.4,1299.5c-28.1,0-54.7-16.8-65.9-44.5-14.6-36.3,3-77.7,39.3-92.3,111.6-44.9,203.2-104.5,264.9-172.6,48.5-53.4,77-109.9,80.2-159.1,1.6-24.2-2.4-56.3-30.7-72.4-39.9-22.5-127.8-15-254.9,73.6-30.5,21.3-72.1,15.4-95.6-13.4-23.4-28.8-20.7-70.8,6.3-96.3,62.7-59.3,108.4-114,135.8-162.6,19-33.7,28.9-64.1,28.4-87.9-.4-17.1-6-30.5-16.7-39.9-20.3-17.7-64-14.4-93.5,7.2-32,23.3-56.6,64.4-75.2,125.4-37.2,121.8-132.8,434.8-132.8,434.8-9.5,31-38.4,53.2-70.9,51.6-32.2-1.5-58.9-23-65.6-54.5-3.2-10.2-34.9-101-207.1-377.2-20.7-33.3-10.6-77,22.7-97.7,33.3-20.7,77-10.6,97.7,22.7,62.9,100.9,108.3,179,141,238.7,28.3-92.7,61-199.6,79.4-259.8,27.9-91.5,69.6-156.4,127.3-198.6,37.7-27.5,84.3-43.7,131.2-45.7,53.1-2.2,102.5,14.2,139.3,46.2,40.9,35.7,64.1,86.9,65.3,144,.9,43.2-10.8,89.5-34.7,138,53.6-4.3,102.3,5.1,142.6,27.9,70,39.5,108.4,116.2,102.5,205.2-5.3,81-46.8,168.1-116.8,245.1-76.1,83.8-185.7,156-317,208.8-8.7,3.5-17.7,5.1-26.5,5.1h0c0,0,0,0,0,0Z" />
    </svg>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <VStack align="start" gap={2}>
      <Heading size="md" fontWeight="bold">
        {title}
      </Heading>
      {children}
    </VStack>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <VStack align="start" gap={1} pl={4}>
      {items.map((item) => (
        <Text key={item} textStyle="sm" color="text.subtle">
          {`\u2022 ${item}`}
        </Text>
      ))}
    </VStack>
  );
}

function VeBetterTab() {
  const { t } = useTranslation();
  return (
    <VStack gap={5} align="stretch">
      <Section title={t("What Is Auto-Voting?")}>
        <Text textStyle="sm" color="text.subtle">
          {t("Every week, VeBetterDAO runs a voting round where you vote for your favorite sustainable apps. The more votes an app gets, the more B3TR rewards it earns — and you earn rewards too just for voting.")}
        </Text>
        <Text textStyle="sm" color="text.subtle">
          {t("The problem? You have to remember to vote every single week. Miss a week, miss your rewards.")}
        </Text>
        <Text textStyle="sm" color="text.subtle">
          {t("Auto-voting fixes this. You pick your favorite apps once, flip a switch, and your votes get cast automatically every week. Your rewards get claimed automatically too. You never have to think about it again.")}
        </Text>
      </Section>

      <Separator />

      <Section title={t("Who Actually Casts My Vote?")}>
        <Text textStyle="sm" color="text.subtle">
          {t("Relayers. They're services (run by apps, community members, or anyone trusted) that watch the blockchain, see you've opted in, and submit your vote + claim your rewards for you.")}
        </Text>
        <Text textStyle="sm" color="text.subtle">
          {t("Think of them like a helpful neighbor who drops your ballot in the mailbox every week because you asked them to.")}
        </Text>
      </Section>

      <Separator />

      <Section title={t("Do I Pay For This?")}>
        <Text textStyle="sm" color="text.subtle">
          {t("Sort of — but you never reach into your pocket. A small fee (10% of your weekly rewards, max 100 B3TR) is automatically taken from your earnings to pay the relayers. If you earn 500 B3TR, 50 goes to the relayer pool. You keep 450.")}
        </Text>
        <Text textStyle="sm" color="text.subtle">
          {t("No gas costs. No transactions to sign. No tokens to send anywhere.")}
        </Text>
      </Section>

      <Separator />

      <Section title={t("Is My Money Safe?")}>
        <Text textStyle="sm" color="text.subtle">
          {t("Your tokens never leave your wallet. Unlike delegation-based approaches where you transfer your voting power to someone else, auto-voting keeps full custody with you. Relayers can only do two things: cast your vote with YOUR preferences, and send YOUR rewards to YOUR wallet. That's it.")}
        </Text>
      </Section>

      <Separator />

      <Section title={t("What Do I Need To Get Started?")}>
        <BulletList
          items={[
            t("Hold at least 1 VOT3 token"),
            t("Have completed 3 sustainable actions on any app"),
            t("Not be flagged as a bot"),
            t("Pick at least one app to vote for"),
          ]}
        />
        <Text textStyle="sm" color="text.subtle">
          {t("Go to the allocations page, choose your apps, toggle auto-voting on. It kicks in next week.")}
        </Text>
      </Section>

      <Separator />

      <Section title={t("What If I Change My Mind?")}>
        <Text textStyle="sm" color="text.subtle">
          {t("Turn it off anytime. You can also change your app preferences whenever you want — the new choices apply from the next round.")}
        </Text>
        <Text textStyle="sm" color="text.subtle">
          {t("While auto-voting is active, you can't vote manually. If the relayer hasn't claimed your rewards after 5 days, you can step in and claim them yourself.")}
        </Text>
      </Section>

      <Separator />

      <Section title={t("What If Something Goes Wrong?")}>
        <Text textStyle="sm" color="text.subtle">
          {t("Auto-voting turns itself off if:")}
        </Text>
        <BulletList
          items={[
            t("Your VOT3 balance drops below 1"),
            t("All your chosen apps become ineligible"),
            t("You stop doing sustainable actions"),
            t("You get flagged as a bot"),
          ]}
        />
        <Text textStyle="sm" color="text.subtle">
          {t("You'll just go back to voting manually until you fix whatever triggered it.")}
        </Text>
      </Section>
    </VStack>
  );
}

function RelayersTab() {
  const { t } = useTranslation();
  return (
    <VStack gap={5} align="stretch">
      <Section title={t("What Is a Relayer?")}>
        <Text textStyle="sm" color="text.subtle">
          {t("You're basically volunteering to press the \"vote\" and \"claim\" buttons for other people who turned on auto-voting. In return, you get a cut of their rewards.")}
        </Text>
      </Section>

      <Separator />

      <Section title={t("Relayer Rewards")}>
        <Text textStyle="sm" color="text.subtle">
          {t("Every user you serve pays 10% of their weekly rewards (max 100 B3TR per user) into a shared pool. At the end of the week, that pool gets split among all relayers based on how much work each one did.")}
        </Text>
        <Text textStyle="sm" color="text.subtle">
          {t("Everyone has to be served. If even one user gets missed — no vote cast, no rewards claimed — nobody gets paid. The whole pool stays locked until every single user is taken care of. This keeps relayers honest and motivated to finish the job.")}
        </Text>
        <Text textStyle="sm" color="text.subtle">
          {t("Safety net: if registered relayers don't finish within 5 days, anyone can step in and complete the remaining work.")}
        </Text>
      </Section>

      <Separator />

      <Section title={t("Weights")}>
        <Text textStyle="sm" color="text.subtle">
          {t("Weights determine how the reward pool is distributed among relayers:")}
        </Text>
        <BulletList
          items={[
            t("Voting for someone = 3 points (higher because voting is more gas-intensive)"),
            t("Claiming their rewards = 1 point"),
            t("One full user per round = 4 weighted points (1 vote + 1 claim)"),
          ]}
        />
        <Text textStyle="sm" color="text.subtle">
          {t("More points = bigger share of the pool.")}
        </Text>
        <Text textStyle="sm" color="text.subtle" fontStyle="italic">
          {t("Example: If the pool has 4 B3TR and a relayer completes 2 votes + 1 claim (2×3 + 1×1 = 7 points) out of 8 total points, they earn 3.5 B3TR.")}
        </Text>
      </Section>

      <Separator />

      <Section title={t("Who Can Be a Relayer?")}>
        <Text textStyle="sm" color="text.subtle">
          {t("The system is designed for anyone: apps, community members, developers. If the community trusts you, you can run a relayer.")}
        </Text>
      </Section>

      <Separator />

      <Section title={t("FAQ")}>
        <Text textStyle="sm" color="text.subtle" fontWeight="semibold">
          {t("Who claims the relayer payout?")}
        </Text>
        <Text textStyle="sm" color="text.subtle">
          {t("Each relayer claims their own share after the round is fully complete.")}
        </Text>

        <Text textStyle="sm" color="text.subtle" fontWeight="semibold" mt={2}>
          {t("Does it matter who you serve?")}
        </Text>
        <Text textStyle="sm" color="text.subtle">
          {t("For users — no, they get the same result regardless. For relayers — yes, you only earn credit for work you personally do. And it's first-come-first-served: if another relayer handles a user before you, you get nothing for that user (and waste gas trying).")}
        </Text>
      </Section>

      <Separator />

      <Section title={t("Why Would an App Want to Be a Relayer?")}>
        <Text textStyle="sm" color="text.subtle">
          {t("Running your own relayer is a strong economic and security opportunity for apps on VeBetterDAO. Your users set you as a preference, you execute their votes (directed to your app), and you earn relayer fees — all without anyone needing to transfer funds or give up custody of their tokens.")}
        </Text>
        <Text textStyle="sm" color="text.subtle">
          {t("Important: be transparent about it. Add your app to the user's preference list — don't replace their other choices.")}
        </Text>
      </Section>
    </VStack>
  );
}

function DevsTab() {
  const { t } = useTranslation();
  return (
    <VStack gap={5} align="stretch">
      <Section title={t("Getting Started")}>
        <Text textStyle="sm" color="text.subtle">
          {t("To integrate as a relayer:")}
        </Text>
        <BulletList
          items={[
            t("Register as a relayer by calling registerRelayer() on RelayerRewardsPool"),
            t("Read getTotalAutoVotingUsersAtRoundStart() to know how many users to serve"),
            t("Call castVoteOnBehalfOf() during early access window"),
            t("Call reward claims after round ends"),
            t("Claim your relayer rewards from RelayerRewardsPool.claimRewards()"),
          ]}
        />
      </Section>

      <Separator />

      <Section title={t("User Eligibility (at snapshot time)")}>
        <BulletList
          items={[
            t("Min 1 VOT3"),
            t("3+ sustainable actions"),
            t("Not bot-flagged by app owners"),
            t("At least 1 eligible app selected"),
          ]}
        />
      </Section>

      <Separator />

      <Section title={t("Timing & Rules")}>
        <BulletList
          items={[
            t("Enable during round N → kicks in from round N+1"),
            t("Active auto-voting blocks manual voting/claiming during the round"),
            t("If relayer hasn't processed after 5 days post-round, users can manually claim"),
            t("Auto-disable triggers: all apps ineligible, VOT3 < 1, action threshold drop, bot detection"),
          ]}
        />
      </Section>

      <Separator />

      <Section title={t("Resources")}>
        <VStack align="start" gap={2}>
          <Link
            href="https://docs.vebetterdao.org/vebetter/automation"
            target="_blank"
            textStyle="sm"
            colorPalette="blue"
          >
            {t("Docs: Auto-Voting Documentation")}
          </Link>
          <Link
            href="https://governance.vebetterdao.org/proposals/93450486232994296830196736391400835825360450263361422145364815974754963306849"
            target="_blank"
            textStyle="sm"
            colorPalette="blue"
          >
            {t("Governance proposal (full spec)")}
          </Link>
          <Link
            href="https://vechain.discourse.group/t/vebetterdao-proposal-auto-voting-for-x-allocation-with-gasless-voting-and-relayer-rewards/559"
            target="_blank"
            textStyle="sm"
            colorPalette="blue"
          >
            {t("Discourse proposal (design rationale)")}
          </Link>
          <Link
            href="https://github.com/vechain/vebetterdao-contracts"
            target="_blank"
            textStyle="sm"
            colorPalette="blue"
          >
            {t("GitHub: Contract source code")}
          </Link>
        </VStack>
      </Section>

      <Separator />

      <Section title={t("NPM Package")}>
        <Text textStyle="sm" color="text.subtle">
          {t("Install @vechain/vebetterdao-contracts via npm/yarn for ABIs and typechain types.")}
        </Text>
        <Text textStyle="sm" color="text.subtle">
          {t("Key imports used in this dashboard:")}
        </Text>
        <BulletList
          items={[
            "@vechain/vebetterdao-contracts/factories/RelayerRewardsPool__factory",
            "@vechain/vebetterdao-contracts/factories/XAllocationVoting__factory",
          ]}
        />
      </Section>

      <Separator />

      <Section title={t("Inspect On-Chain")}>
        <Text textStyle="sm" color="text.subtle">
          {t("Use VeChain Explorer (inspect.vechain.org) to inspect contracts on mainnet.")}
        </Text>
      </Section>

      <Separator />

      <AiSkillBanner />
    </VStack>
  );
}

const QUICK_ACTIONS_KEYS = [
  { labelKey: "Dashboard", href: "/", icon: LuHouse, descKey: "View live relayer stats" },
  { labelKey: "Run a Relayer", href: "/run", icon: LuPlay, descKey: "Get started as a relayer" },
  { labelKey: "Browse Relayers", href: "/relayers", icon: LuRadar, descKey: "See all registered relayers" },
];

const RESOURCES_KEYS = [
  { labelKey: "Auto-Voting Docs", href: "https://docs.vebetterdao.org/vebetter/automation", icon: LuBookOpen },
  { labelKey: "Governance Proposal", href: "https://governance.vebetterdao.org/proposals/93450486232994296830196736391400835825360450263361422145364815974754963306849", icon: LuFileText },
  { labelKey: "Contract Source", href: "https://github.com/vechain/vebetterdao-contracts", icon: LuGithub },
  { labelKey: "Relayer Node", href: "https://github.com/vechain/vebetterdao-relayer-node", icon: LuGithub },
];

function SidebarCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card.Root variant="outline" size="sm">
      <Card.Header pb={2}>
        <Text
          textStyle="xs"
          fontWeight="bold"
          textTransform="uppercase"
          color="text.subtle"
        >
          {title}
        </Text>
      </Card.Header>
      <Card.Body pt={0} gap={1}>
        {children}
      </Card.Body>
    </Card.Root>
  );
}

function Sidebar() {
  const { t } = useTranslation();
  return (
    <VStack gap={4} align="stretch" w="full">
      <SidebarCard title={t("Quick Actions sidebar")}>
        <VStack gap={1} align="stretch">
          {QUICK_ACTIONS_KEYS.map((action) => (
            <Link key={action.href} asChild _hover={{ textDecoration: "none" }}>
              <NextLink href={action.href}>
                <HStack
                  gap={3}
                  px={3}
                  py={2}
                  borderRadius="md"
                  _hover={{ bg: "bg.subtle" }}
                  transition="background 0.15s"
                >
                  <Box as="span" color="text.subtle" flexShrink={0}>
                    <action.icon size={16} />
                  </Box>
                  <VStack gap={0} align="start">
                    <Text textStyle="sm" fontWeight="medium">
                      {t(action.labelKey)}
                    </Text>
                    <Text textStyle="xs" color="text.subtle">
                      {t(action.descKey)}
                    </Text>
                  </VStack>
                </HStack>
              </NextLink>
            </Link>
          ))}
        </VStack>
      </SidebarCard>

      <SidebarCard title={t("Resources sidebar")}>
        <VStack gap={0.5} align="stretch">
          {RESOURCES_KEYS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              _hover={{ textDecoration: "none" }}
            >
              <HStack
                gap={3}
                px={3}
                py={1.5}
                borderRadius="md"
                _hover={{ bg: "bg.subtle" }}
                transition="background 0.15s"
              >
                <Box as="span" color="text.subtle" flexShrink={0}>
                  <link.icon size={14} />
                </Box>
                <Text textStyle="xs" color="text.subtle" flex={1}>
                  {t(link.labelKey)}
                </Text>
                <Box as="span" color="text.subtle" flexShrink={0}>
                  <LuExternalLink size={12} />
                </Box>
              </HStack>
            </Link>
          ))}
        </VStack>
      </SidebarCard>

      <SidebarCard title={t("Key Facts")}>
        <VStack gap={2} align="start" px={3} pb={1}>
          <VStack gap={0.5} align="start">
            <Text textStyle="xs" fontWeight="semibold">
              {t("Fee")}
            </Text>
            <Text textStyle="xs" color="text.subtle">
              {t("10% of weekly rewards (max 100 B3TR)")}
            </Text>
          </VStack>
          <VStack gap={0.5} align="start">
            <Text textStyle="xs" fontWeight="semibold">
              {t("Vote Weight")}
            </Text>
            <Text textStyle="xs" color="text.subtle">
              {t("3 pts per vote, 1 pt per claim")}
            </Text>
          </VStack>
          <VStack gap={0.5} align="start">
            <Text textStyle="xs" fontWeight="semibold">
              {t("Min Requirement")}
            </Text>
            <Text textStyle="xs" color="text.subtle">
              {t("1 VOT3 + 3 sustainable actions")}
            </Text>
          </VStack>
          <VStack gap={0.5} align="start">
            <Text textStyle="xs" fontWeight="semibold">
              {t("Grace Period")}
            </Text>
            <Text textStyle="xs" color="text.subtle">
              {t("5 days post-round for manual claims")}
            </Text>
          </VStack>
        </VStack>
      </SidebarCard>
    </VStack>
  );
}

export function InfoContent() {
  const { t } = useTranslation();
  return (
    <VStack gap={6} align="stretch">
      <Heading size="xl" fontWeight="bold">
        {t("Auto-Voting & Relayers")}
      </Heading>

      <Grid templateColumns={{ base: "1fr", md: "2fr 1fr" }} gap="4" w="full">
        <Tabs.Root defaultValue="vebetter" fitted>
          <Tabs.List position="sticky" top="60px" zIndex="2" bg="bg" py={2}>
            <Tabs.Trigger value="vebetter">
              <HStack gap={1.5}>
                <B3trIcon width={16} height={16} />
                {t("VeBetter")}
              </HStack>
            </Tabs.Trigger>
            <Tabs.Trigger value="relayers">
              <HStack gap={1.5}>
                <LuRadar size={16} />
                {t("Relayers")}
              </HStack>
            </Tabs.Trigger>
            <Tabs.Trigger value="devs">
              <HStack gap={1.5}>
                <LuCode size={16} />
                {t("For Devs")}
              </HStack>
            </Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="vebetter" pt={6}>
            <VeBetterTab />
          </Tabs.Content>
          <Tabs.Content value="relayers" pt={6}>
            <RelayersTab />
          </Tabs.Content>
          <Tabs.Content value="devs" pt={6}>
            <DevsTab />
          </Tabs.Content>
        </Tabs.Root>

        <Box
          display={{ base: "none", md: "block" }}
          position="sticky"
          top="80px"
          h="fit-content"
        >
          <Sidebar />
        </Box>
      </Grid>
    </VStack>
  );
}
