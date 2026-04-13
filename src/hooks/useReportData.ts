"use client";

import { useQuery } from "@tanstack/react-query";

import { reportUrl } from "@/config/reportUrl";
import type { AnalyticsReport } from "@/lib/types";

async function fetchReport(): Promise<AnalyticsReport> {
  const res = await fetch(reportUrl, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(
      `Failed to load the relayer report from ${reportUrl}. You need to verify NEXT_PUBLIC_REPORT_URL or ensure /data/report.json is available in the deployed app.`,
    );
  }

  return res.json() as Promise<AnalyticsReport>;
}

export function useReportData() {
  return useQuery({
    queryKey: ["relayer-report", reportUrl],
    queryFn: fetchReport,
    staleTime: 5 * 60 * 1000,
  });
}
