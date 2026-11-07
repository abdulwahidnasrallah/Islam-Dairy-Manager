import type { ReportsSummary } from "@idm/shared-types";
import { apiClient } from "./apiClient";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

function buildQuery(from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export const reportsService = {
  getSummary: (from?: string, to?: string) =>
    apiClient.get<ReportsSummary>(`/reports/summary${buildQuery(from, to)}`),

  exportUrl: (kind: "sales" | "purchases" | "top-debts", from?: string, to?: string) =>
    `${BASE_URL}/reports/export/${kind}.csv${buildQuery(from, to)}`,
};
