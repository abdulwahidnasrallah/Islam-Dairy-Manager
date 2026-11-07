import type { AuthenticatedUser } from "@idm/shared-types";
import type { LoginInput } from "@idm/shared-validation";
import { apiClient } from "./apiClient";

export const authService = {
  login: (input: LoginInput) => apiClient.post<AuthenticatedUser>("/auth/login", input),
  logout: () => apiClient.post<null>("/auth/logout"),
  me: () => apiClient.get<AuthenticatedUser>("/auth/me"),
};
