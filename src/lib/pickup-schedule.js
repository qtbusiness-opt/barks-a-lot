import { prisma } from "@/lib/prisma";
import { getPickupSettings } from "@/lib/site-settings";
import { dayKeyOf, storeTodayStartUtc } from "@/lib/pickup-window";
import {
  pickupDays,
  pickupSlots,
  toDayKey,
  dayKeyToUtcDate,
  SLOT_CAPACITY,
} from "@/lib/calendar-days";

// What can be booked for pickup right now: the owner's settings plus the
// bookable days and the slot times within a day. One function, shared by
// the public endpoint and the orders API, so checkout can never offer
// something the server would refuse (or the other way round).
//
// Events take priority over pickup: any day with an event on it is
// blocked exactly like a day the owner closed.
export async function getPickupSchedule(now = new Date()) {
  const settings = await getPickupSettings();
  const slots = pickupSlots(settings.hours.start, settings.hours.end);
  if (!settings.enabled) return { ...settings, days: [], slots };

  const events = await prisma.event.findMany({
    where: { date: { gte: storeTodayStartUtc(now) } },
    select: { date: true },
  });
  const blocked = [
    ...settings.closedDays,
    ...events.map((e) => toDayKey(e.date)),
  ];
  return { ...settings, days: pickupDays(dayKeyOf(now), blocked), slots };
}

// Orders that hold a place in a slot. A cancelled order gives its place
// back.
const holdsSlot = { fulfillmentType: "pickup", status: { not: "cancelled" } };

// How many orders are booked into each slot of the given days, as a Map
// keyed "YYYY-MM-DD HH:MM". Slots nobody has booked are absent.
export async function slotBookings(days, db = prisma) {
  if (days.length === 0) return new Map();
  const rows = await db.order.groupBy({
    by: ["pickupDate", "pickupTime"],
    where: { ...holdsSlot, pickupDate: { in: days.map(dayKeyToUtcDate) } },
    _count: { _all: true },
  });
  return new Map(
    rows.map((r) => [
      `${toDayKey(r.pickupDate)} ${r.pickupTime}`,
      r._count._all,
    ])
  );
}

// Takes a place in a slot inside the order transaction, or returns false
// when it's full. The advisory lock makes two checkouts for the same slot
// queue up, so the sixth can't slip in while the fifth is being written;
// it is released when the transaction ends.
export async function claimSlot(tx, day, time) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pickup-slot ${day} ${time}`}))`;
  const taken = await tx.order.count({
    where: { ...holdsSlot, pickupDate: dayKeyToUtcDate(day), pickupTime: time },
  });
  return taken < SLOT_CAPACITY;
}

export const isSlotFull = (bookings, day, time) =>
  (bookings.get(`${day} ${time}`) ?? 0) >= SLOT_CAPACITY;
