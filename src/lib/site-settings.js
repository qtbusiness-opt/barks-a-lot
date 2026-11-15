import { prisma } from "@/lib/prisma";
import { parseClosedDays, pickupHours } from "@/lib/calendar-days";
import {
  PICKUP_ENABLED,
  PICKUP_DETAILS,
  PICKUP_CLOSED_DAYS,
  PICKUP_HOURS_START,
  PICKUP_HOURS_END,
} from "@/lib/setting-keys";

// Re-export the client-safe constants so server code has one import site.
export { ABOUT_IMAGE_KEYS } from "@/lib/about-images";
export {
  ALLOWED_SETTING_KEYS,
  PICKUP_ENABLED,
  PICKUP_DETAILS,
  PICKUP_CLOSED_DAYS,
  PICKUP_HOURS_START,
  PICKUP_HOURS_END,
} from "@/lib/setting-keys";

// Returns a { key: value } map for the requested keys (missing → absent).
export async function getSettings(keys) {
  const rows = await prisma.siteSetting.findMany({
    where: { key: { in: keys } },
  });
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

// Scheduled pickup as the owner set it in Admin → Pickup. Off, with no
// details, no closed days and the default hours, until they change it.
export async function getPickupSettings() {
  const s = await getSettings([
    PICKUP_ENABLED,
    PICKUP_DETAILS,
    PICKUP_CLOSED_DAYS,
    PICKUP_HOURS_START,
    PICKUP_HOURS_END,
  ]);
  return {
    enabled: s[PICKUP_ENABLED] === "true",
    details: s[PICKUP_DETAILS] ?? "",
    closedDays: parseClosedDays(s[PICKUP_CLOSED_DAYS]),
    hours: pickupHours(s[PICKUP_HOURS_START], s[PICKUP_HOURS_END]),
  };
}
