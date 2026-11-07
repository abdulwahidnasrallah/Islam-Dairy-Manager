import type { SupplierPayment } from "@idm/shared-types";
import type { CreateSupplierPaymentInput } from "@idm/shared-validation";
import { apiClient } from "./apiClient";

export const supplierPaymentService = {
  list: (supplierId?: string) =>
    apiClient.get<SupplierPayment[]>(
      supplierId ? `/supplier-payments?supplierId=${supplierId}` : "/supplier-payments",
    ),

  create: (input: CreateSupplierPaymentInput) =>
    apiClient.post<SupplierPayment>("/supplier-payments", input),
};
