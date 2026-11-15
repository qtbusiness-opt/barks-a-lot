// Calendar-day arithmetic on "YYYY-MM-DD" keys, and the rules built on it:
// which days and half-hour slots can be booked for pickup, and how
// upcoming events group into months.
//
// Zero imports on purpose: `node --test` loads this file directly and
// can't resolve the "@/" alias (same reason as src/lib/options.js). It
// never reads a clock either — "now" is always passed in, which is what
// lets the store-time rules be tested at exact instants.
//
// All arithmetic is done in UTC on day keys, so a daylight-saving change
// can never shift a day. The only time zone involved is the one handed
// to storeDayKey to decide which calendar day it is right now.

// Pickup offers this many open days, starting the day after the customer
// orders.
export const PICKUP_DAY_COUNT = 10;

// Each pickup is booked into a slot this long, shared by at most this
// many orders.
export const SLOT_MINUTES = 30;
export const SLOT_CAPACITY = 5;

// Pickup hours until the owner sets their own (Admin → Pickup). The same
// hours apply Monday through Saturday.
export const DEFAULT_PICKUP_HOURS = { start: "15:00", end: "18:00" };

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

// Pickup runs Monday through Saturday; Sunday is the one day off.
export function isPickupWeekday(dayKey) {
  return dayKeyToUtcDate(dayKey).getUTCDay() !== 0;
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

// The bookable pickup days: the next `count` days strictly after today
// that aren't a Sunday and aren't blocked. Never same-day — every pickup
// has at least until store midnight to be prepared. Blocked days (ones
// the owner closed, and any day with an event on it) push the window out
// rather than shrink it, so the customer always has `count` to choose.
export function pickupDays(
  todayKey,
  blockedDays = [],
  count = PICKUP_DAY_COUNT
) {
  const blocked = new Set(blockedDays);
  const days = [];
  // Bounded so a malformed blocked list can never spin forever.
  for (let i = 1; days.length < count && i <= 400; i++) {
    const key = addDays(todayKey, i);
    if (isPickupWeekday(key) && !blocked.has(key)) days.push(key);
  }
  return days;
}

// Membership in the window is the whole rule, so the server can't accept
// a day the checkout wouldn't have offered — and anything that isn't a
// real calendar day simply isn't in the list.
export function isPickupDay(
  dayKey,
  todayKey,
  blockedDays = [],
  count = PICKUP_DAY_COUNT
) {
  return pickupDays(todayKey, blockedDays, count).includes(dayKey);
}

const SLOT_TIME = /^([01]\d|2[0-3]):(00|30)$/;

// A wall-clock "HH:MM" on a half-hour boundary — the only times a slot
// can start or the pickup hours can be set to.
export function isSlotTime(value) {
  return typeof value === "string" && SLOT_TIME.test(value);
}

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const fromMinutes = (total) =>
  `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;

// The owner's pickup hours, or the default when they're unset or don't
// make sense (off the half hour, or closing at or before opening). Bad
// stored values must never leave checkout with no slots to offer.
export function pickupHours(start, end) {
  return isSlotTime(start) && isSlotTime(end) && start < end
    ? { start, end }
    : DEFAULT_PICKUP_HOURS;
}

// Slot start times from opening up to (not including) closing.
export function pickupSlots(start, end) {
  const slots = [];
  for (let t = toMinutes(start); t < toMinutes(end); t += SLOT_MINUTES) {
    slots.push(fromMinutes(t));
  }
  return slots;
}

export function slotEnd(time) {
  return fromMinutes(toMinutes(time) + SLOT_MINUTES);
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
