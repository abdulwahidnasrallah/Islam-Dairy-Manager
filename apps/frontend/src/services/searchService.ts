import type { SearchResult } from "@idm/shared-types";
import { apiClient } from "./apiClient";

export const searchService = {
  search: (query: string) => apiClient.get<SearchResult[]>(`/search?q=${encodeURIComponent(query)}`),
};
