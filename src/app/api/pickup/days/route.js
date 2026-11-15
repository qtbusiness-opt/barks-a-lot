import { NextResponse } from "next/server";
import {
  getPickupSchedule,
  slotBookings,
  isSlotFull,
} from "@/lib/pickup-schedule";

// The bookable days change at store midnight and slots fill up as orders
// come in, so never cache this.
export const dynamic = "force-dynamic";

// Public, read-only. What checkout may offer for pickup: whether it's on,
// the owner's pickup details, and each bookable day with its half-hour
// slots and whether each still has room. The details come back even when
// pickup is off — My Orders still shows them on orders already placed.
// Closed days and event days are simply missing from `days`; booking
// counts are never exposed, only full-or-not.
export async function GET() {
  const { enabled, details, days, slots } = await getPickupSchedule();
  const bookings = await slotBookings(days);
  return NextResponse.json(
    {
      enabled,
      details,
      days: days.map((day) => ({
        day,
        slots: slots.map((time) => ({
          time,
          available: !isSlotFull(bookings, day, time),
        })),
      })),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
