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

const { formatCalendarDay, formatMonth } =
  await import("../src/lib/format-date.js");

test("formatMonth names the month in UTC, whatever the machine's zone", () => {
  assert.equal(formatMonth(2026, 10), "November 2026");
  assert.equal(formatMonth(2027, 0), "January 2027");
});

test("each set of options keeps its own formatter", () => {
  // Formatters are cached per options; a second, different shape must
  // not be answered by the first one's formatter.
  assert.equal(formatCalendarDay("2026-11-04", { weekday: "short" }), "Wed");
  assert.equal(formatCalendarDay("2026-11-04", { day: "numeric" }), "4");
  assert.equal(formatCalendarDay("2026-11-04", { weekday: "short" }), "Wed");
  // An overridden zone is part of the key: midnight UTC on the 4th is
  // still the evening of the 3rd in Boise.
  assert.equal(
    formatCalendarDay("2026-11-04", { timeZone: "America/Boise", day: "numeric" }),
    "3"
  );
  assert.equal(formatCalendarDay("2026-11-04", { day: "numeric" }), "4");
});
