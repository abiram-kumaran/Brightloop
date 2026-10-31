import React, { createContext, useContext, useEffect, useState } from "react";
import { AuthUser, LoginInput, RegisterInput } from "@brightloop/shared";
import { fetchApi } from "../api/client.js";

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (input: LoginInput, isCompany?: boolean) => Promise<string>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const data = await fetchApi<{ user: AuthUser }>("/auth/me");
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (input: LoginInput, isCompany = false): Promise<string> => {
    const data = await fetchApi<{ user: AuthUser; redirectTo: string }>(
      `/auth/login?isCompany=${isCompany}`,
      {
        method: "POST",
        body: JSON.stringify(input),
      }
    );
    setUser(data.user);
    return data.redirectTo;
  };

  const register = async (input: RegisterInput): Promise<void> => {
    const data = await fetchApi<{ user: AuthUser }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    });
    setUser(data.user);
  };

  const logout = async (): Promise<void> => {
    try {
      await fetchApi("/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
