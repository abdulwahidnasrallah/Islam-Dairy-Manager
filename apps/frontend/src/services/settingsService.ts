import type { AppSettings } from "@idm/shared-types";
import type { UpdateSettingsInput } from "@idm/shared-validation";
import { apiClient } from "./apiClient";

export const settingsService = {
  getAll: () => apiClient.get<AppSettings>("/settings"),
  update: (input: UpdateSettingsInput) => apiClient.put<AppSettings>("/settings", input),
};
