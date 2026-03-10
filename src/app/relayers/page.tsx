"use client";

import { VStack } from "@chakra-ui/react";
import dynamic from "next/dynamic";

const RelayersList = dynamic(
  () => import("@/components/Relayers").then((m) => m.RelayersList),
  { ssr: false },
);

export default function RelayersPage() {
  return (
    <VStack w="full" gap={{ base: 8, md: 12 }} align="stretch">
      <RelayersList />
    </VStack>
  );
}
