// Shared by the orders API and the checkout UI so the pickup rules can't
// drift apart.

import { STORE_TIME_ZONE } from "@/lib/format-date";

// event.date is a Date object straight from Prisma on the server and an
// ISO string after JSON on the client — handle both. Events are stored
// at midnight UTC, so the UTC slice IS the calendar day.
export const eventDayKey = (event) =>
  event.date instanceof Date
    ? event.date.toISOString().slice(0, 10)
    : String(event.date).slice(0, 10);

// en-CA renders as YYYY-MM-DD, directly comparable with eventDayKey.
// Computed in STORE_TIME_ZONE explicitly rather than the process's own
// clock — the container runs in UTC in production, and "today" needs to
// mean the store's today, not the server's.
const storeDayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: STORE_TIME_ZONE,
});

export function dayKeyOf(now = new Date()) {
  return storeDayFormatter.format(now);
}

const pad = (n) => String(n).padStart(2, "0");

// No same-day reservations: an event can be chosen for pickup (manually
// or via "Next Event") only on a day strictly after today, so every
// pickup has at least until midnight, store time, to be prepared for.
export function isPickupSelectable(event, now = new Date()) {
  return eventDayKey(event) > dayKeyOf(now);
}

// "14:30" -> "2:30 PM" for customer-facing display.
export function formatTime(hhmm) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${pad(m)} ${suffix}`;
}

// "9:00 AM – 2:00 PM", or just the start when no end is set.
export function formatTimeRange(event) {
  if (!event.startTime && !event.endTime) return "";
  if (event.startTime && event.endTime) {
    return `${formatTime(event.startTime)} – ${formatTime(event.endTime)}`;
  }
  return event.startTime
    ? `from ${formatTime(event.startTime)}`
    : `until ${formatTime(event.endTime)}`;
}
