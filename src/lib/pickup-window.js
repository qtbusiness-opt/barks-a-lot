// Shared by the orders API and the checkout UI so the pickup rules can't
// drift apart. Event times are wall-clock strings ("HH:MM") in the
// store's timezone — set TZ (e.g. America/Boise) in production so the
// server's local clock matches the events'.

export const PICKUP_CUTOFF_MS = 2 * 60 * 60 * 1000;

// event.date is a Date object straight from Prisma on the server and an
// ISO string after JSON on the client — handle both. Events are stored
// at midnight UTC, so the UTC slice IS the calendar day.
export const eventDayKey = (event) =>
  event.date instanceof Date
    ? event.date.toISOString().slice(0, 10)
    : String(event.date).slice(0, 10);

const pad = (n) => String(n).padStart(2, "0");

export function dayKeyOf(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// An event can be chosen for pickup (manually or via "Next Event") on
// any future day, and on the event day itself until two hours before it
// wraps up. Events without an end time keep the older behaviour: the
// whole event day counts.
export function isPickupSelectable(event, now = new Date()) {
  const day = eventDayKey(event);
  const today = dayKeyOf(now);
  if (day > today) return true;
  if (day < today) return false;
  if (!event.endTime) return true;
  // Parsed without a zone suffix → local wall-clock time.
  const end = new Date(`${day}T${event.endTime}:00`);
  return now.getTime() <= end.getTime() - PICKUP_CUTOFF_MS;
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
