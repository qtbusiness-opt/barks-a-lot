import { prisma } from "@/lib/prisma";
import { parseClosedDays } from "@/lib/calendar-days";
import {
  WEEKDAY_PICKUP_ENABLED,
  WEEKDAY_PICKUP_DETAILS,
  WEEKDAY_PICKUP_CLOSED_DAYS,
} from "@/lib/setting-keys";

// Re-export the client-safe constants so server code has one import site.
export { ABOUT_IMAGE_KEYS } from "@/lib/about-images";
export {
  ALLOWED_SETTING_KEYS,
  WEEKDAY_PICKUP_ENABLED,
  WEEKDAY_PICKUP_DETAILS,
  WEEKDAY_PICKUP_CLOSED_DAYS,
} from "@/lib/setting-keys";

// Returns a { key: value } map for the requested keys (missing → absent).
export async function getSettings(keys) {
  const rows = await prisma.siteSetting.findMany({
    where: { key: { in: keys } },
  });
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

// Weekday pickup as the owner set it in Admin → Weekday Pickup. Off,
// with no details and no closed days, until they change it.
export async function getWeekdayPickupSettings() {
  const s = await getSettings([
    WEEKDAY_PICKUP_ENABLED,
    WEEKDAY_PICKUP_DETAILS,
    WEEKDAY_PICKUP_CLOSED_DAYS,
  ]);
  return {
    enabled: s[WEEKDAY_PICKUP_ENABLED] === "true",
    details: s[WEEKDAY_PICKUP_DETAILS] ?? "",
    closedDays: parseClosedDays(s[WEEKDAY_PICKUP_CLOSED_DAYS]),
  };
}
