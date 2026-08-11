"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";

// How long before the session ends the warning appears, at most. Short
// windows (ADMIN_SESSION_SECONDS) get a proportionally shorter lead
// time — a two-minute warning on a two-minute window would be on screen
// permanently. The full two minutes applies from a six-minute window up.
const MAX_WARN_SECONDS = 2 * 60;
const warnSecondsFor = (windowSeconds) =>
  windowSeconds > 0
    ? Math.max(15, Math.min(MAX_WARN_SECONDS, Math.floor(windowSeconds / 3)))
    : MAX_WARN_SECONDS;

// The session renews on real activity, but not on every twitch. Also
// scaled to the window, which keeps the guarantee that matters: while
// someone is working, the remaining time never falls below
// window - renewEvery, and that stays comfortably above the warning
// threshold at every window size. Without the scaling, a short window
// could dip into the warning band mid-work.
const MAX_RENEW_EVERY_SECONDS = 60;
const renewEverySecondsFor = (windowSeconds) =>
  windowSeconds > 0
    ? Math.max(
        10,
        Math.min(MAX_RENEW_EVERY_SECONDS, Math.floor(windowSeconds / 4))
      )
    : MAX_RENEW_EVERY_SECONDS;

// Deliberately only things a person does. Nothing here fires on its own,
// so a parked tab genuinely goes idle.
const ACTIVITY_EVENTS = [
  "pointerdown",
  "keydown",
  "wheel",
  "touchstart",
  "scroll",
  "mousemove",
];

const mmss = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

// Sliding idle session: while the user is doing anything, the session
// keeps renewing itself, so the warning below never interrupts someone
// mid-task. It only shows up after real inactivity — and doing nothing
// about it is a valid answer, since an unattended browser shouldn't stay
// signed in.
export default function SessionTimeoutModal() {
  const { user, expiresAt, issuedAt, extendSession, expireSession, logout } =
    useAuth();
  // Epoch seconds, ticked once a second. 0 until the first tick so the
  // server and first client render agree.
  const [now, setNow] = useState(0);
  const [extending, setExtending] = useState(false);
  const stayRef = useRef(null);
  const dialogRef = useRef(null);
  // Refs, not state: activity fires constantly and must never re-render.
  const lastActivity = useRef(0);
  const lastRenewal = useRef(0);

  useEffect(() => {
    const tick = () => setNow(Math.floor(Date.now() / 1000));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const seconds = Math.floor(Date.now() / 1000);
    // Left at 0: only a real event counts as activity, so a page nobody
    // touches is idle from the moment it loads.
    // Start the throttle now so a fresh session isn't renewed instantly.
    lastRenewal.current = seconds;

    const mark = () => {
      lastActivity.current = Math.floor(Date.now() / 1000);
    };
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, mark, { passive: true });
    }
    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, mark);
      }
    };
  }, []);

  // Derived from the absolute deadline rather than counting down a local
  // number, so a tab that was asleep shows the truth when it wakes.
  const remaining =
    user && expiresAt && now > 0 ? Math.max(0, expiresAt - now) : null;
  const open =
    remaining !== null && remaining <= warnSecondsFor(expiresAt - issuedAt);

  const stay = useCallback(async () => {
    setExtending(true);
    try {
      await extendSession();
    } finally {
      setExtending(false);
    }
  }, [extendSession]);

  // Slide the deadline forward while the user is active. Skipped once the
  // warning is up: at that point they've been idle, and a stray mouse
  // nudge shouldn't answer the question on their behalf — the whole point
  // is to find out whether anyone is still there.
  useEffect(() => {
    if (!user || !expiresAt || now === 0 || open) return;
    // Anything done since the last renewal counts, not just this instant.
    // Requiring activity *right now* meant a normal working rhythm —
    // acting during the throttle, then pausing — could go a whole window
    // without renewing, and the warning would interrupt someone who had
    // been using the app the entire time.
    const activeSinceRenewal = lastActivity.current > lastRenewal.current;
    const throttled =
      now - lastRenewal.current < renewEverySecondsFor(expiresAt - issuedAt);
    if (!activeSinceRenewal || throttled) return;

    lastRenewal.current = now;
    // A session that already lapsed can't be renewed — the server says
    // so, and the usual unauthenticated handling takes it from there.
    Promise.resolve(extendSession()).catch(() => {});
  }, [now, user, expiresAt, open, extendSession]);

  // Out of time — end it here rather than waiting for the next session
  // refetch, so the sign-out lands when the countdown says it will.
  useEffect(() => {
    if (remaining === 0) expireSession();
  }, [remaining, expireSession]);

  // Move focus into the dialog when it opens and keep Tab inside it.
  useEffect(() => {
    if (!open) return undefined;
    stayRef.current?.focus();

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        // Escape shouldn't strand a keyboard user in an undismissable
        // dialog; treat it as the safe, non-destructive choice.
        e.preventDefault();
        stay();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll("button");
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, stay]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-timeout-title"
      aria-describedby="session-timeout-copy"
    >
      <div
        ref={dialogRef}
        className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 text-center"
      >
        <h2
          id="session-timeout-title"
          className="text-xl font-semibold text-[#2A4A52]"
        >
          Still there?
        </h2>
        <p id="session-timeout-copy" className="text-sm text-gray-600 mt-2">
          You&rsquo;ll be signed out automatically when the timer runs out.
        </p>

        {/* The digits tick every second, which would make a screen reader
            unbearable — announce once a minute instead. */}
        <p
          aria-hidden="true"
          className="text-4xl font-bold text-[#C8722A] tabular-nums mt-4"
        >
          {mmss(remaining)}
        </p>
        <p className="sr-only" aria-live="polite">
          {remaining > 60
            ? `Your session ends in ${Math.ceil(remaining / 60)} minutes.`
            : "Your session ends in less than a minute."}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 mt-6">
          <button
            ref={stayRef}
            type="button"
            onClick={stay}
            disabled={extending}
            className="sm:flex-[2] min-h-11 bg-[#4A7C8A] hover:bg-[#3A6270] active:bg-[#2A4A52] text-white py-3 rounded-lg font-semibold transition disabled:opacity-50"
          >
            {extending ? "Staying signed in…" : "Stay signed in"}
          </button>
          {/* Chosen deliberately, so this is an ordinary sign-out (home
              page, no "you timed out" notice) — only the timer running
              out counts as an expiry. */}
          <button
            type="button"
            onClick={logout}
            className="sm:flex-1 min-h-11 border-2 border-[#4A7C8A] text-[#4A7C8A] py-3 rounded-lg font-semibold hover:bg-[#4A7C8A] hover:text-white transition"
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
