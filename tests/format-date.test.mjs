// Pickup-day wording (src/lib/format-date.js).
//
// Runs far east of the store on purpose: a calendar day stored as
// midnight UTC must read as the same day everywhere. Parsed as local
// time it would slide, and a customer would be told the wrong pickup day.
process.env.TZ = "Asia/Tokyo";

import { test } from "node:test";
import assert from "node:assert/strict";

const { formatPickupDay, formatPickupDayWithYear } =
  await import("../src/lib/format-date.js");

test("formatPickupDay reads the same from a key, a JSON date, or a Date", () => {
  assert.equal(formatPickupDay("2026-11-04"), "Wednesday, Nov 4");
  assert.equal(formatPickupDay("2026-11-04T00:00:00.000Z"), "Wednesday, Nov 4");
  assert.equal(
    formatPickupDay(new Date("2026-11-04T00:00:00.000Z")),
    "Wednesday, Nov 4"
  );
});

test("formatPickupDayWithYear keeps the year for order history", () => {
  assert.equal(formatPickupDayWithYear("2026-11-04"), "Wed, 11/4/2026");
});
