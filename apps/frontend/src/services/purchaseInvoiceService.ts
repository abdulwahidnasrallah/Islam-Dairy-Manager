import type { PurchaseInvoice, PurchaseInvoiceDetail } from "@idm/shared-types";
import type { CreatePurchaseInvoiceInput } from "@idm/shared-validation";
import { apiClient } from "./apiClient";

export const purchaseInvoiceService = {
  list: (supplierId?: string) =>
    apiClient.get<PurchaseInvoice[]>(
      supplierId ? `/purchase-invoices?supplierId=${supplierId}` : "/purchase-invoices",
    ),

  getById: (id: string) => apiClient.get<PurchaseInvoiceDetail>(`/purchase-invoices/${id}`),

  create: (input: CreatePurchaseInvoiceInput) =>
    apiClient.post<PurchaseInvoice>("/purchase-invoices", input),

  cancel: (id: string) => apiClient.post<PurchaseInvoice>(`/purchase-invoices/${id}/cancel`, {}),
};
