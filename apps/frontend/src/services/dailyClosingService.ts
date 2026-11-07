import type { DailyClosing } from "@idm/shared-types";
import { apiClient } from "./apiClient";

export const dailyClosingService = {
  getStatus: () => apiClient.get<{ isClosedToday: boolean; todaySince: string }>("/daily-closing/status"),
  listHistory: () => apiClient.get<DailyClosing[]>("/daily-closing/history"),
  close: () => apiClient.post<DailyClosing>("/daily-closing/close"),
};
