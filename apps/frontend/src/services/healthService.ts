import type { HealthStatus } from "@idm/shared-types";
import { apiClient } from "./apiClient";

export const healthService = {
  check: () => apiClient.get<HealthStatus>("/health"),
};
