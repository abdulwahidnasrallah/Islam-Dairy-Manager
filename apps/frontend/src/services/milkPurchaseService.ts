import type { MilkPurchase } from "@idm/shared-types";
import type { CreateMilkPurchaseInput } from "@idm/shared-validation";
import { apiClient } from "./apiClient";

export const milkPurchaseService = {
  list: (supplierId?: string) =>
    apiClient.get<MilkPurchase[]>(
      supplierId ? `/milk-purchases?supplierId=${supplierId}` : "/milk-purchases",
    ),

  create: (input: CreateMilkPurchaseInput) =>
    apiClient.post<MilkPurchase>("/milk-purchases", input),
};
