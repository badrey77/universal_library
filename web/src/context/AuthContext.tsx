import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, setApiToken } from "../api/client";
import type { Member } from "../api/types";

interface AuthContextValue {
  member: Member | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = "universal-library:token";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setApiToken(token);
    if (token) {
      localStorage.setItem(STORAGE_KEY, token);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setMember(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .get<Member>("/auth/me")
      .then((m) => {
        if (!cancelled) setMember(m);
      })
      .catch(() => {
        if (!cancelled) {
          setMember(null);
          setToken(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ token: string; member: Member }>("/auth/login", {
      email,
      password,
    });
    setToken(res.token);
    setMember(res.member);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const res = await api.post<{ token: string; member: Member }>("/auth/register", {
      name,
      email,
      password,
    });
    setToken(res.token);
    setMember(res.member);
  }, []);

  const logout = useCallback(() => {
    // Best-effort: revokes the token server-side via tokenVersion so it
    // can't be replayed even if it leaked. Still clear local state even if
    // the request fails (e.g. offline) so the user isn't stuck "logged in".
    api.post("/auth/logout").catch(() => {});
    setToken(null);
    setMember(null);
  }, []);

  const value = useMemo(
    () => ({ member, token, loading, login, register, logout }),
    [member, token, loading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
