// What a tab does when the session stops resolving
// (src/lib/session-end.js, acted on by src/context/AuthContext.jsx).
import { test } from "node:test";
import assert from "node:assert/strict";

const { sessionEndAction } = await import("../src/lib/session-end.js");

test("a session that ends under someone using the tab is a timeout", () => {
  assert.equal(
    sessionEndAction({ sawSession: true, flagged: true }),
    "expire"
  );
});

test("a leftover marker on a fresh visit is not a timeout", () => {
  // The reported bug: a visitor opening the site long after an earlier
  // session lapsed (tab closed, cookie aged out) was sent to the login
  // page with "Your session timed out", though nobody was signed in.
  assert.equal(sessionEndAction({ sawSession: false, flagged: true }), "clear");
});

test("another tab signing out is followed quietly", () => {
  // The marker is shared across tabs; gone means a sibling tab already
  // ended the session on purpose, so no timeout notice here either.
  assert.equal(
    sessionEndAction({ sawSession: true, flagged: false }),
    "follow"
  );
});

test("an ordinary signed-out visit does nothing", () => {
  assert.equal(sessionEndAction({ sawSession: false, flagged: false }), null);
});
