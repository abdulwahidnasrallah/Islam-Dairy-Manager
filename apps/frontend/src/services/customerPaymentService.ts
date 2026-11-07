import type { CustomerPayment } from "@idm/shared-types";
import type { CreateCustomerPaymentInput } from "@idm/shared-validation";
import { apiClient } from "./apiClient";

export const customerPaymentService = {
  list: (customerId?: string) =>
    apiClient.get<CustomerPayment[]>(
      customerId ? `/customer-payments?customerId=${customerId}` : "/customer-payments",
    ),

  create: (input: CreateCustomerPaymentInput) =>
    apiClient.post<CustomerPayment>("/customer-payments", input),
};
