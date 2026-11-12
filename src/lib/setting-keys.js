// Client-safe site-setting keys (no server imports), shared by the admin
// pages and the server. Whitelisted so an arbitrary settings key can
// never be written through the generic admin settings route.
import { ABOUT_IMAGE_KEYS } from "@/lib/about-images";

// Scheduled pickup settings. The stored key names still say "weekday"
// from when pickup was Monday–Friday only; renaming them would orphan
// whatever the owner has already saved, so only the constants moved on.
//
// Pickup is on only when this holds the string "true"; absent (the
// default) means off.
export const PICKUP_ENABLED = "weekday_pickup_enabled";
// Free text telling customers where to collect.
export const PICKUP_DETAILS = "weekday_pickup_details";
// Days the owner is unavailable, as comma-separated YYYY-MM-DD keys.
export const PICKUP_CLOSED_DAYS = "weekday_pickup_closed_days";
// Opening and closing time for pickup slots, "HH:MM" on the half hour,
// the same Monday through Saturday. Unset means the default hours.
export const PICKUP_HOURS_START = "pickup_hours_start";
export const PICKUP_HOURS_END = "pickup_hours_end";

// The settings route caps a value at 500 characters; 45 keys and their
// commas fit inside that.
export const MAX_CLOSED_DAYS = 45;

export const ALLOWED_SETTING_KEYS = new Set([
  ...ABOUT_IMAGE_KEYS.map((k) => k.key),
  PICKUP_ENABLED,
  PICKUP_DETAILS,
  PICKUP_CLOSED_DAYS,
  PICKUP_HOURS_START,
  PICKUP_HOURS_END,
]);
