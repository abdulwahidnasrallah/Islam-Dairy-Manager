import type { Expense } from "@idm/shared-types";
import type { CreateExpenseInput, UpdateExpenseInput } from "@idm/shared-validation";
import { apiClient } from "./apiClient";

export const expenseService = {
  list: (category?: string) =>
    apiClient.get<Expense[]>(category ? `/expenses?category=${category}` : "/expenses"),

  create: (input: CreateExpenseInput) => apiClient.post<Expense>("/expenses", input),

  update: (id: string, input: UpdateExpenseInput) => apiClient.put<Expense>(`/expenses/${id}`, input),

  remove: (id: string) => apiClient.delete<null>(`/expenses/${id}`),
};
