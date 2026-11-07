import type { CashAdjustment, CashRegisterSummary, ProfitSummary } from "@idm/shared-types";
import type { CreateCashAdjustmentInput } from "@idm/shared-validation";
import { apiClient } from "./apiClient";

export const cashRegisterService = {
  getSummary: () => apiClient.get<CashRegisterSummary>("/cash-register"),

  getProfitSummary: () => apiClient.get<ProfitSummary>("/cash-register/profit-summary"),

  createAdjustment: (input: CreateCashAdjustmentInput) =>
    apiClient.post<CashAdjustment>("/cash-register/adjustments", input),
};
