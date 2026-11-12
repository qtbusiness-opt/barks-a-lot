import { NextResponse } from "next/server";
import { getWeekdayPickupSettings } from "@/lib/site-settings";
import { weekdayPickupDaysAt } from "@/lib/pickup-window";

// The bookable days change at store midnight, so never cache this.
export const dynamic = "force-dynamic";

// Public, read-only. What checkout may offer for weekday pickup: whether
// it's on, the owner's pickup details, and the bookable days. The details
// come back even when it's off — My Orders still shows them on orders
// already placed. Closed days are folded into `days`, never listed.
export async function GET() {
  const { enabled, details, closedDays } = await getWeekdayPickupSettings();
  return NextResponse.json(
    { enabled, details, days: enabled ? weekdayPickupDaysAt(closedDays) : [] },
    { headers: { "Cache-Control": "no-store" } }
  );
}
