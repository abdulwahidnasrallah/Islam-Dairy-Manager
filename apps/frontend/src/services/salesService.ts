import type { Invoice, InvoiceDetail } from "@idm/shared-types";
import type { CreateInvoiceInput } from "@idm/shared-validation";
import { apiClient } from "./apiClient";

export const salesService = {
  list: (customerId?: string) =>
    apiClient.get<Invoice[]>(customerId ? `/sales?customerId=${customerId}` : "/sales"),

  getById: (id: string) => apiClient.get<InvoiceDetail>(`/sales/${id}`),

  create: (input: CreateInvoiceInput) => apiClient.post<Invoice>("/sales", input),

  cancel: (id: string) => apiClient.post<Invoice>(`/sales/${id}/cancel`, {}),
};
