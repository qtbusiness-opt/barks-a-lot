// Calendar-day arithmetic on "YYYY-MM-DD" keys, and the rules built on it:
// which weekdays can be booked for pickup, and how upcoming events group
// into months.
//
// Zero imports on purpose: `node --test` loads this file directly and
// can't resolve the "@/" alias (same reason as src/lib/options.js). It
// never reads a clock either — "now" is always passed in, which is what
// lets the store-time rules be tested at exact instants.
//
// All arithmetic is done in UTC on day keys, so a daylight-saving change
// can never shift a day. The only time zone involved is the one handed
// to storeDayKey to decide which calendar day it is right now.

// Weekday pickup offers this many open weekdays, starting the day after
// the customer orders.
export const WEEKDAY_PICKUP_DAY_COUNT = 10;

// Building an Intl formatter is the expensive part, so one per zone.
const dayFormatters = new Map();

// The calendar day it is at `now` in `timeZone`, as YYYY-MM-DD (the en-CA
// locale formats a date exactly that way).
export function storeDayKey(now, timeZone) {
  let formatter = dayFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", { timeZone });
    dayFormatters.set(timeZone, formatter);
  }
  return formatter.format(now);
}

// A stored calendar day (Event.date, Order.pickupDate) is midnight UTC of
// that day. A Date reads back through toISOString; a JSON string already
// starts with the key.
export function toDayKey(value) {
  return value instanceof Date
    ? value.toISOString().slice(0, 10)
    : String(value).slice(0, 10);
}

export function dayKeyToUtcDate(dayKey) {
  return new Date(`${dayKey}T00:00:00.000Z`);
}

// Midnight UTC of the store's today — the lower bound for "from today on"
// event queries, since events are stored at midnight UTC of their day.
export function storeDayStartUtc(now, timeZone) {
  return dayKeyToUtcDate(storeDayKey(now, timeZone));
}

export function addDays(dayKey, n) {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function isWeekday(dayKey) {
  const day = dayKeyToUtcDate(dayKey).getUTCDay();
  return day >= 1 && day <= 5;
}

export function monthKeyOf(dayKey) {
  return dayKey.slice(0, 7);
}

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

// Closed days are stored as one comma-separated setting. Read tolerantly:
// blanks, junk and duplicates drop out, and the result is sorted.
export function parseClosedDays(value) {
  const keys = String(value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => DAY_KEY.test(s));
  return [...new Set(keys)].sort();
}

// Today and earlier can never be booked, so closing them means nothing.
export function pruneClosedDays(days, todayKey) {
  return days.filter((day) => day > todayKey);
}

// The bookable pickup days: the next `count` weekdays strictly after
// today that aren't closed. Never same-day — every pickup has at least
// until store midnight to be prepared. Closed days push the window out
// rather than shrink it, so the customer always has `count` to choose.
export function weekdayPickupDays(
  todayKey,
  closedDays = [],
  count = WEEKDAY_PICKUP_DAY_COUNT
) {
  const closed = new Set(closedDays);
  const days = [];
  // Bounded so a malformed closed list can never spin forever.
  for (let i = 1; days.length < count && i <= 400; i++) {
    const key = addDays(todayKey, i);
    if (isWeekday(key) && !closed.has(key)) days.push(key);
  }
  return days;
}

// Membership in the window is the whole rule, so the server can't accept
// a day the checkout wouldn't have offered — and anything that isn't a
// real calendar day simply isn't in the list.
export function isWeekdayPickupDay(
  dayKey,
  todayKey,
  closedDays = [],
  count = WEEKDAY_PICKUP_DAY_COUNT
) {
  return weekdayPickupDays(todayKey, closedDays, count).includes(dayKey);
}

// Events grouped by calendar month, months in order, events kept in the
// order given within each month. Months with no events don't appear.
export function groupEventsByMonth(events) {
  const byMonth = new Map();
  for (const event of events) {
    const monthKey = monthKeyOf(toDayKey(event.date));
    if (!byMonth.has(monthKey)) byMonth.set(monthKey, []);
    byMonth.get(monthKey).push(event);
  }
  return [...byMonth.keys()].sort().map((monthKey) => ({
    monthKey,
    year: Number(monthKey.slice(0, 4)),
    monthIndex: Number(monthKey.slice(5, 7)) - 1,
    events: byMonth.get(monthKey),
  }));
}

// The month that opens on its own: this month when it has events, else
// the nearest later month that does. Groups are in month order, so the
// first one not before this month is the answer.
export function defaultOpenMonth(groups, currentMonthKey) {
  return groups.find((g) => g.monthKey >= currentMonthKey)?.monthKey ?? null;
}
