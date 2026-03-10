import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { apiRequest } from "./queryClient";
import { usePushNotifications } from "@/hooks/use-push-notifications";

interface AuthUser {
  id: number;
  username: string;
  fullName: string;
  role: string;
  groupId: number | null;
  email: string | null;
  permissions: string[];
  guardTabVisible: boolean | null;
  lateTabVisible: boolean | null;
  dutyTabVisible: boolean | null;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then(res => {
        if (res.ok) return res.json();
        return null;
      })
      .then(data => {
        if (data && data.id) setUser(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const login = async (username: string, password: string) => {
    const res = await apiRequest("POST", "/api/auth/login", { username, password });
    const data = await res.json();
    setUser(data);
  };

  const logout = async () => {
    await apiRequest("POST", "/api/auth/logout");
    sessionStorage.removeItem("safeexit_view_mode");
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (data && data.id) setUser(data);
      }
    } catch {}
  };

  usePushNotifications(!!user, user?.id ?? null);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
