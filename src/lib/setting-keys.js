// Client-safe site-setting keys (no server imports), shared by the admin
// pages and the server. Whitelisted so an arbitrary settings key can
// never be written through the generic admin settings route.
import { ABOUT_IMAGE_KEYS } from "@/lib/about-images";

// Weekday pickup is on only when this holds the string "true"; absent
// (the default) means off.
export const WEEKDAY_PICKUP_ENABLED = "weekday_pickup_enabled";
// Free text telling customers where and when to collect.
export const WEEKDAY_PICKUP_DETAILS = "weekday_pickup_details";
// Days the owner is unavailable, as comma-separated YYYY-MM-DD keys.
export const WEEKDAY_PICKUP_CLOSED_DAYS = "weekday_pickup_closed_days";

// The settings route caps a value at 500 characters; 45 keys and their
// commas fit inside that.
export const MAX_CLOSED_DAYS = 45;

export const ALLOWED_SETTING_KEYS = new Set([
  ...ABOUT_IMAGE_KEYS.map((k) => k.key),
  WEEKDAY_PICKUP_ENABLED,
  WEEKDAY_PICKUP_DETAILS,
  WEEKDAY_PICKUP_CLOSED_DAYS,
]);
