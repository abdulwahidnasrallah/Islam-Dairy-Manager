import type { DashboardSummary } from "@idm/shared-types";
import { apiClient } from "./apiClient";

export const dashboardService = {
  getSummary: () => apiClient.get<DashboardSummary>("/dashboard/summary"),
};
