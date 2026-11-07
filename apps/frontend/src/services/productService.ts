import type { Product, ProductWithStock } from "@idm/shared-types";
import type { CreateProductInput, UpdateProductInput } from "@idm/shared-validation";
import { apiClient } from "./apiClient";

export const productService = {
  list: (search?: string) =>
    apiClient.get<ProductWithStock[]>(
      search ? `/products?search=${encodeURIComponent(search)}` : "/products",
    ),

  getById: (id: string) => apiClient.get<Product>(`/products/${id}`),

  create: (input: CreateProductInput) => apiClient.post<Product>("/products", input),

  update: (id: string, input: UpdateProductInput) =>
    apiClient.put<Product>(`/products/${id}`, input),

  remove: (id: string) => apiClient.delete<null>(`/products/${id}`),
};
