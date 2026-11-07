import type {
  Supplier,
  SupplierWithBalance,
  SupplierProfile,
} from "@idm/shared-types";
import type { CreateSupplierInput, UpdateSupplierInput } from "@idm/shared-validation";
import { apiClient } from "./apiClient";

export const supplierService = {
  list: (search?: string) =>
    apiClient.get<SupplierWithBalance[]>(
      search ? `/suppliers?search=${encodeURIComponent(search)}` : "/suppliers",
    ),

  getProfile: (id: string) => apiClient.get<SupplierProfile>(`/suppliers/${id}`),

  create: (input: CreateSupplierInput) => apiClient.post<Supplier>("/suppliers", input),

  update: (id: string, input: UpdateSupplierInput) =>
    apiClient.put<Supplier>(`/suppliers/${id}`, input),

  remove: (id: string) => apiClient.delete<null>(`/suppliers/${id}`),
};
