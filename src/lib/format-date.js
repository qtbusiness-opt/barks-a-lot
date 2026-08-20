// Every date shown in the UI is formatted here, with the locale and time
// zone stated explicitly.
//
// Left implicit, `toLocaleDateString()` uses whatever locale and time
// zone the machine running it has. The server renders the page with the
// container's settings, the browser re-renders it with the visitor's,
// the two strings disagree, and React throws away the server markup for
// that subtree (a hydration mismatch). Naming both makes the two agree
// by construction.

export const STORE_LOCALE = "en-US";
// The shop is one place, so timestamps read in shop time no matter where
// the customer is. Keep this in step with the TZ env var (.env.example).
export const STORE_TIME_ZONE = "America/Boise";

// Built once: constructing an Intl formatter is the expensive part.
const dateOnly = new Intl.DateTimeFormat(STORE_LOCALE, {
  timeZone: STORE_TIME_ZONE,
});
const dateAndTime = new Intl.DateTimeFormat(STORE_LOCALE, {
  timeZone: STORE_TIME_ZONE,
  dateStyle: "short",
  timeStyle: "medium",
});

/** A moment in time as a date — "8/11/2026". */
export const formatDate = (value) => dateOnly.format(new Date(value));

/** A moment in time in full — "8/11/2026, 4:35:52 AM". */
export const formatDateTime = (value) => dateAndTime.format(new Date(value));

/**
 * A calendar day (an event's date) rather than a moment in time.
 *
 * These are stored as midnight UTC and mean "this square on the
 * calendar", so they're read back in UTC. Parsing them as local midnight
 * instead would slide the market a day earlier for anyone far enough
 * east — a customer in Tokyo would be told to collect on the wrong day.
 *
 * @param {string|Date} day  a YYYY-MM-DD string, or anything Date-like
 */
export function formatCalendarDay(day, options) {
  const ymd = String(day instanceof Date ? day.toISOString() : day).slice(
    0,
    10
  );
  return new Intl.DateTimeFormat(STORE_LOCALE, {
    timeZone: "UTC",
    ...options,
  }).format(new Date(`${ymd}T00:00:00Z`));
}

/** "August 2026" for a calendar heading. */
export function formatMonth(year, month) {
  return new Intl.DateTimeFormat(STORE_LOCALE, {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month, 1)));
}
