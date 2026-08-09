"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";

// How long before the session ends the warning appears.
const WARN_SECONDS = 2 * 60;

const mmss = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

// Warns before an idle session runs out and offers to keep it alive.
// Doing nothing is a real choice: the countdown reaching zero signs the
// user out, which is the point of a short admin session — an unattended
// browser shouldn't stay logged in.
export default function SessionTimeoutModal() {
  const { user, expiresAt, extendSession, expireSession, logout } = useAuth();
  // Epoch seconds, ticked once a second. 0 until the first tick so the
  // server and first client render agree.
  const [now, setNow] = useState(0);
  const [extending, setExtending] = useState(false);
  const stayRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    const tick = () => setNow(Math.floor(Date.now() / 1000));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Derived from the absolute deadline rather than counting down a local
  // number, so a tab that was asleep shows the truth when it wakes.
  const remaining =
    user && expiresAt && now > 0 ? Math.max(0, expiresAt - now) : null;
  const open = remaining !== null && remaining <= WARN_SECONDS;

  const stay = useCallback(async () => {
    setExtending(true);
    try {
      await extendSession();
    } finally {
      setExtending(false);
    }
  }, [extendSession]);

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
