import type { InventoryMovement, ProductWithStock } from "@idm/shared-types";
import type { CreateInventoryAdjustmentInput } from "@idm/shared-validation";
import { apiClient } from "./apiClient";

export const inventoryService = {
  listStock: () => apiClient.get<ProductWithStock[]>("/inventory"),

  listMovements: (productId?: string) =>
    apiClient.get<InventoryMovement[]>(
      productId ? `/inventory/movements?productId=${productId}` : "/inventory/movements",
    ),

  adjust: (input: CreateInventoryAdjustmentInput) =>
    apiClient.post<InventoryMovement>("/inventory/adjustments", input),
};
