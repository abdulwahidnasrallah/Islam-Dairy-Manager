import type { DataCleanupResult } from "@idm/shared-types";
import { apiClient } from "./apiClient";

export const dataCleanupService = {
  cleanupOperationalData: (confirmation: string, password: string) =>
    apiClient.post<DataCleanupResult>("/data-management/cleanup-operational-data", {
      confirmation,
      password,
    }),
};
