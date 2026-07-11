"use client";

import { createContext, useContext } from "react";
import {
  SessionProvider,
  useSession,
  getSession,
  signIn,
  signOut,
} from "next-auth/react";
import api from "@/lib/api";

const AuthContext = createContext(undefined);

function AuthState({ children }) {
  const { data: session, status } = useSession();

  const user = session?.user
    ? {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: session.user.role,
      }
    : null;

  // Returns the signed-in user so callers can route by role (admins land
  // on the dashboard).
  const login = async (email, password) => {
    const res = await signIn("credentials", { redirect: false, email, password });
    if (res?.error) throw new Error("Invalid credentials");
    const fresh = await getSession();
    return fresh?.user ?? null;
  };

  const register = async (name, email, password) => {
    await api.post("/auth/register", { name, email, password });
    await login(email, password);
  };

  // Send everyone (admin or customer) back to the homepage on logout so
  // they never land stranded on a page that now requires a session.
  // Navigate client-side rather than via Auth.js's redirectTo: the server
  // builds that URL from the host it's bound to, which is 0.0.0.0 inside
  // Docker — the browser's own origin is always right.
  const logout = async () => {
    await signOut({ redirect: false });
    // The cart belongs to the person, not the browser — clear it so the
    // next user of this device doesn't inherit it. The full-page
    // navigation below re-initializes CartProvider from the (now empty)
    // storage.
    localStorage.removeItem("barks-cart");
    window.location.assign("/");
  };

  return (
    <AuthContext.Provider
      value={{ user, loading: status === "loading", login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }) {
  return (
    <SessionProvider>
      <AuthState>{children}</AuthState>
    </SessionProvider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
