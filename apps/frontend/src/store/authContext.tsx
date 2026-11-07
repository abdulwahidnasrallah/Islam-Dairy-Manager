import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { AuthenticatedUser } from "@idm/shared-types";
import { authService } from "@/services/authService";
import { ApiClientError } from "@/services/apiClient";

/**
 * Real authentication state, backed by the Phase 3 session-cookie API
 * (POST /api/auth/login, GET /api/auth/me, POST /api/auth/logout).
 * The session itself lives in an httpOnly cookie set by the backend —
 * this context only tracks the current user info in memory.
 */
interface AuthState {
  user: AuthenticatedUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    authService
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  async function login(username: string, password: string) {
    const authenticatedUser = await authService.login({ username, password });
    setUser(authenticatedUser);
  }

  async function logout() {
    try {
      await authService.logout();
    } catch (error) {
      // Even if the request fails (e.g. session already expired), clear
      // local state so the UI doesn't get stuck in a logged-in view.
      if (!(error instanceof ApiClientError)) throw error;
    } finally {
      setUser(null);
    }
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: user !== null, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
