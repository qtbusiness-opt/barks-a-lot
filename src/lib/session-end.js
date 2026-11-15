// What to do when the session stops resolving. Kept import-free so it can
// be unit tested (tests/session-end.test.mjs); AuthContext acts on it.
//
// Two facts decide it:
// - sawSession: this tab, since it loaded, has actually seen the user
//   signed in. Only then did someone here have a session to lose.
// - flagged: the localStorage marker saying this browser was signed in.
//   It outlives the session whenever nobody pressed Log out — a closed
//   tab whose admin window lapsed, a customer cookie that aged out, a
//   rebuild with a new AUTH_SECRET.
//
// Treating the marker alone as "your session just timed out" was the
// bug: a visitor opening the site days later was bounced to the login
// page with a timeout notice, though nobody was signed in on that visit.
//
// Returns:
//   "expire" — the session ended under someone using this tab: sign out
//              and say why on the login page.
//   "follow" — this tab was signed in, but another tab already ended it
//              (the marker is gone): follow quietly, no timeout notice.
//   "clear"  — a leftover marker from an earlier visit: tidy up in
//              place, no redirect, no notice.
//   null     — an ordinary signed-out visit; nothing to do.
export function sessionEndAction({ sawSession, flagged }) {
  if (sawSession) return flagged ? "expire" : "follow";
  return flagged ? "clear" : null;
}
