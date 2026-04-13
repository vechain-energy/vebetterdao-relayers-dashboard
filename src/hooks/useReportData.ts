"use client";

import { useQuery } from "@tanstack/react-query";

import { withBasePath } from "@/config/basePath";
import type { AnalyticsReport } from "@/lib/types";

const REPORT_URL = withBasePath("/data/report.json");

async function fetchReport(): Promise<AnalyticsReport> {
  const res = await fetch(REPORT_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load report");
  return res.json() as Promise<AnalyticsReport>;
}

export function useReportData() {
  return useQuery({
    queryKey: ["relayer-report"],
    queryFn: fetchReport,
    staleTime: 5 * 60 * 1000,
  });
}
