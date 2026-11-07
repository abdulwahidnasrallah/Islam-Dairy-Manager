import type { ProductionBatch } from "@idm/shared-types";
import type { CreateProductionBatchInput } from "@idm/shared-validation";
import { apiClient } from "./apiClient";

export const productionService = {
  list: (productId?: string) =>
    apiClient.get<ProductionBatch[]>(
      productId ? `/production?productId=${productId}` : "/production",
    ),

  create: (input: CreateProductionBatchInput) =>
    apiClient.post<ProductionBatch>("/production", input),
};
