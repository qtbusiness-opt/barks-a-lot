"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Runs an async click/submit handler at most once at a time.
 *
 * Disabling a button with a state flag looks like it closes the door, but
 * state only takes effect on the next render — a double-click inside the
 * same frame gets through and fires the request twice. That means two
 * verification emails, two categories, two of whatever the handler
 * writes. The `running` ref below is checked and set synchronously, so
 * the second click has nothing to slip through.
 *
 * @param action  the async work to run
 * @returns [run, busy] — `run` for the handler, `busy` for the UI
 */
export function useAsyncAction(action) {
  // Kept in a ref so `run` stays stable while always calling the latest
  // closure (props/state the handler reads are current).
  const actionRef = useRef(action);
  useEffect(() => {
    actionRef.current = action;
  });

  const running = useRef(false);
  const [busy, setBusy] = useState(false);

  const run = useCallback(async (...args) => {
    // On a form, a blocked second submit must still be prevented — the
    // early return below would otherwise let the browser navigate away
    // and do a real page POST.
    const event = args[0];
    if (event && typeof event.preventDefault === "function") {
      event.preventDefault();
    }

    if (running.current) return undefined;
    running.current = true;
    setBusy(true);
    try {
      return await actionRef.current(...args);
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, []);

  return [run, busy];
}
