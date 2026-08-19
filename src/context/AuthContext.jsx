"use client";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  SessionProvider,
  useSession,
  getSession,
  signIn,
  signOut,
} from "next-auth/react";
import api, { setUnauthorizedHandler } from "@/lib/api";
import { CART_KEY } from "@/lib/cart-storage";

const AuthContext = createContext(undefined);

// The session cookie is httpOnly, so the browser can't see whether a
// stale one is still being sent. This marker records "we were signed in"
// in a place client code CAN read, which is what lets a page loaded with
// an expired token tell itself apart from an ordinary signed-out visit.
const SESSION_FLAG = "barks-signed-in";

function hadSession() {
  try {
    return localStorage.getItem(SESSION_FLAG) === "1";
  } catch {
    return false;
  }
}

// The cart lives in localStorage, and CartProvider is mounted *inside*
// this provider, so read it from storage directly (the same way logout
// has always cleared it).
function readCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_KEY) ?? "[]");
    if (!Array.isArray(saved)) return [];
    return saved.filter((i) => i?.name && i.quantity > 0);
  } catch {
    return [];
  }
}

// Abandoned carts are business analytics, so record what was in the cart
// before it's cleared. Best-effort: logging must never block or fail a
// logout, and it runs before signOut so the session still identifies the
// customer.
async function reportAbandonedCart(reason) {
  const items = readCart();
  if (items.length === 0) return;
  try {
    await api.post("/cart/abandoned", {
      reason,
      items: items.slice(0, 50).map((i) => ({
        name: String(i.name).slice(0, 120),
        quantity: Number(i.quantity) || 1,
        price: Number(i.price) || 0,
      })),
    });
  } catch {
    // Analytics is never worth interrupting a logout for.
  }
}

function AuthState({ children }) {
  const { data: session, status, update } = useSession();

  // Guards against running the logout sequence twice — signOut() flips
  // status to "unauthenticated", which would otherwise look like an
  // expiry and re-trigger it.
  const loggingOut = useRef(false);

  // Renewing the session puts it back into "loading" with no data for a
  // moment. Without these two, every renewal blanked whatever page the
  // user was on (role-gated pages fell back to their "Loading..." state)
  // and then refilled a beat later.
  //
  // They're state rather than refs because `user` and `loading` are read
  // during render and handed to consumers. A ref read during render can
  // hold a value React never re-rendered for, so the screen and the ref
  // silently disagree; state keeps the two in step by construction.
  const [settled, setSettled] = useState(false);
  const [held, setHeld] = useState(null);

  // Memoised because this object *is* the `user` every consumer reads.
  // Keyed on the four fields rather than on `session`: the session is
  // refetched every minute and comes back as a new object each time,
  // almost always describing the same person. Keying on the values means
  // an unchanged user stays the same object, and consumers sit still.
  const { id, email, name, role } = session?.user ?? {};
  const liveUser = useMemo(
    () => (id ? { id, email, name, role } : null),
    [id, email, name, role]
  );
  // Epoch seconds; together these give the idle deadline and the length
  // of the window, which drive the expiry warning.
  const liveExpiresAt = session?.user?.expiresAt ?? null;
  const liveIssuedAt = session?.user?.issuedAt ?? null;

  // Set during render, not in an effect: the held values have to be
  // correct in the very render that drops the live ones, or the page
  // blanks for a frame before the effect catches up. Both are guarded, so
  // they settle immediately instead of looping.
  if (
    liveUser &&
    (held?.user !== liveUser ||
      held.expiresAt !== liveExpiresAt ||
      held.issuedAt !== liveIssuedAt)
  ) {
    setHeld({
      user: liveUser,
      expiresAt: liveExpiresAt,
      issuedAt: liveIssuedAt,
    });
  }
  if (status !== "loading" && !settled) setSettled(true);

  // Hold the last known session across a refresh so the UI doesn't flap.
  // The deadline is held for the same reason the identity is: mid-refetch
  // there's no session to read one from, and a countdown that blinks to
  // "no deadline" every minute is its own bug.
  // A real sign-out reports "unauthenticated", which drops it properly.
  const refreshing = status === "loading" && settled;
  const user = liveUser ?? (refreshing ? (held?.user ?? null) : null);
  const expiresAt =
    liveExpiresAt ?? (refreshing ? (held?.expiresAt ?? null) : null);
  const issuedAt =
    liveIssuedAt ?? (refreshing ? (held?.issuedAt ?? null) : null);
  // Only the very first resolution counts as loading; a background
  // refresh must never blank a page that already rendered.
  const loading = status === "loading" && !settled;

  // Returns the signed-in user so callers can route by role (admins land
  // on the dashboard).
  const login = useCallback(async (email, password) => {
    const res = await signIn("credentials", {
      redirect: false,
      email,
      password,
    });
    if (res?.error) {
      const err = new Error(
        res.code === "email-unverified"
          ? "Please verify your email before logging in."
          : "Invalid credentials"
      );
      err.code = res.code;
      throw err;
    }
    const fresh = await getSession();
    return fresh?.user ?? null;
  }, []);

  // New accounts must verify their email before they can sign in, so
  // registration doesn't auto-login; it returns the API response
  // (message + dev verification link when no mailer is configured).
  const register = useCallback(async (name, email, password) => {
    const res = await api.post("/auth/register", { name, email, password });
    return res.data;
  }, []);

  // Send everyone (admin or customer) away from wherever they were on
  // logout so they never land stranded on a page that now requires a
  // session. Navigate client-side rather than via Auth.js's redirectTo:
  // the server builds that URL from the host it's bound to, which is
  // 0.0.0.0 inside Docker — the browser's own origin is always right.
  const endSession = useCallback(async (reason, destination) => {
    if (loggingOut.current) return;
    loggingOut.current = true;

    await reportAbandonedCart(reason);
    // Clears the cookie too, so a stale token can't keep waving us
    // through the /admin gate on the next navigation.
    await signOut({ redirect: false });
    // The cart belongs to the person, not the browser — clear it so the
    // next user of this device doesn't inherit it. The full-page
    // navigation below re-initializes CartProvider from the (now empty)
    // storage.
    localStorage.removeItem(CART_KEY);
    localStorage.removeItem(SESSION_FLAG);
    window.location.assign(destination);
  }, []);

  const logout = useCallback(() => endSession("signed_out", "/"), [endSession]);

  // An expired session leaves the UI looking signed in while every
  // request fails, so sign out for real and say why on the login page.
  const expireSession = useCallback(
    () => endSession("session_expired", "/login?expired=1"),
    [endSession]
  );

  // Answering "Stay signed in" on the expiry warning. The server decides
  // whether the session is still extendable; a token that already ran
  // out comes back unauthenticated and the usual sign-out kicks in.
  //
  // next-auth hands back a fresh `update` on every session refetch, so
  // depending on it directly would rebuild this callback — and with it
  // the whole context value — once a minute for no reason. Reading it
  // from a ref keeps the callback fixed while still calling the current
  // one.
  const updateRef = useRef(update);
  useEffect(() => {
    updateRef.current = update;
  });
  const extendSession = useCallback(
    () => updateRef.current({ extend: true }),
    []
  );

  useEffect(() => {
    if (status === "authenticated") localStorage.setItem(SESSION_FLAG, "1");
  }, [status]);

  // The session stopped resolving while we still believe we're signed in
  // — either the refetch below noticed it in an open tab, or the page was
  // just loaded with an expired token still in the cookie jar. Either way
  // the UI would otherwise render a signed-in shell whose every request
  // fails, so end the session for real.
  useEffect(() => {
    if (status === "unauthenticated" && hadSession()) expireSession();
  }, [status, expireSession]);

  // The impatient path: a request just failed with 401/403. Confirm the
  // session is genuinely gone (rather than a real permission error)
  // before ending it.
  useEffect(() => {
    setUnauthorizedHandler(async () => {
      if (!hadSession() || loggingOut.current) return;
      const fresh = await getSession();
      if (!fresh?.user) expireSession();
    });
    return () => setUnauthorizedHandler(null);
  }, [expireSession]);

  // Built inline, this object was new on every render, so the navbar,
  // the cart badge, the expiry warning and every role-gated page all
  // re-rendered on each of the session refetches that run every minute.
  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      expiresAt,
      issuedAt,
      extendSession,
      expireSession,
    }),
    [
      user,
      loading,
      login,
      register,
      logout,
      expiresAt,
      issuedAt,
      extendSession,
      expireSession,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AuthProvider({ children }) {
  return (
    // Revalidate the session every minute (and whenever the tab regains
    // focus) so an expired one is noticed on its own — admin sessions are
    // deliberately short, and without this the UI keeps showing a signed-in
    // shell whose requests all fail.
    <SessionProvider refetchInterval={60} refetchOnWindowFocus>
      <AuthState>{children}</AuthState>
    </SessionProvider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
