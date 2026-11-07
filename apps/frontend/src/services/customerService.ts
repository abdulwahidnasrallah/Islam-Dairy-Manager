import type { Customer, CustomerProfile, CustomerWithBalance } from "@idm/shared-types";
import type { CreateCustomerInput, UpdateCustomerInput } from "@idm/shared-validation";
import { apiClient } from "./apiClient";

export const customerService = {
  list: (search?: string) =>
    apiClient.get<CustomerWithBalance[]>(
      search ? `/customers?search=${encodeURIComponent(search)}` : "/customers",
    ),

  listWithDebt: () => apiClient.get<CustomerWithBalance[]>("/customers?owingOnly=true"),

  getProfile: (id: string) => apiClient.get<CustomerProfile>(`/customers/${id}`),

  create: (input: CreateCustomerInput) => apiClient.post<Customer>("/customers", input),

  update: (id: string, input: UpdateCustomerInput) =>
    apiClient.put<Customer>(`/customers/${id}`, input),

  remove: (id: string) => apiClient.delete<null>(`/customers/${id}`),
};
