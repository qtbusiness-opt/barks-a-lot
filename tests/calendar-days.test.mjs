// Calendar-day rules behind scheduled pickup and the events list
// (src/lib/calendar-days.js): which days and time slots can be booked, how store time
// maps to a calendar day, and how events group into months.
//
// The process runs in the store's own zone on purpose. Every rule here is
// meant to work on UTC day keys only, so any accidental local-time getter
// (getDay instead of getUTCDay) shifts a day and fails a test below.
process.env.TZ = "America/Boise";

import { test } from "node:test";
import assert from "node:assert/strict";

const {
  PICKUP_DAY_COUNT,
  SLOT_MINUTES,
  SLOT_CAPACITY,
  DEFAULT_PICKUP_HOURS,
  pickupSlots,
  slotEnd,
  pickupHours,
  isSlotTime,
  storeDayKey,
  storeDayStartUtc,
  toDayKey,
  dayKeyToUtcDate,
  addDays,
  isPickupWeekday,
  monthKeyOf,
  parseClosedDays,
  pruneClosedDays,
  pickupDays,
  isPickupDay,
  groupEventsByMonth,
  defaultOpenMonth,
} = await import("../src/lib/calendar-days.js");

const BOISE = "America/Boise";

// Nov 2026: Sun 1, Mon 2, Tue 3, Fri 6, Sat 7, Sun 8, Mon 9, Fri 20,
// Thu 26 (Thanksgiving), Fri 27, Mon 30. US DST ends Sun Nov 1 at 08:00Z.

test("addDays crosses month, year and leap-day boundaries", () => {
  assert.equal(addDays("2026-11-30", 1), "2026-12-01");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2028-02-28", 1), "2028-02-29");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
});

test("pickup runs Monday through Saturday — Sunday is the only day off", () => {
  for (const day of ["02", "03", "04", "05", "06", "07"]) {
    assert.equal(isPickupWeekday(`2026-11-${day}`), true, day);
  }
  assert.equal(isPickupWeekday("2026-11-08"), false, "Sunday");
  // Midnight UTC Monday is still Sunday evening in Boise — a local getter
  // would call this a Sunday.
  assert.equal(isPickupWeekday("2026-11-09"), true);
});

test("the window is the next 10 open days, starting the day after today", () => {
  assert.equal(PICKUP_DAY_COUNT, 10);
  assert.deepEqual(pickupDays("2026-11-03"), [
    "2026-11-04",
    "2026-11-05",
    "2026-11-06",
    "2026-11-07",
    "2026-11-09",
    "2026-11-10",
    "2026-11-11",
    "2026-11-12",
    "2026-11-13",
    "2026-11-14",
  ]);
});

test("Sunday is skipped wherever the window starts", () => {
  const fromSaturday = pickupDays("2026-11-07");
  assert.equal(fromSaturday.length, 10);
  assert.equal(fromSaturday[0], "2026-11-09");
  assert.equal(fromSaturday[9], "2026-11-19");
  // Friday → Saturday is tomorrow, and Saturday is a pickup day.
  assert.equal(pickupDays("2026-11-06")[0], "2026-11-07");
  assert.equal(pickupDays("2026-11-08")[0], "2026-11-09");
});

test("the window rolls across year ends and leap days", () => {
  assert.equal(pickupDays("2026-12-31")[0], "2027-01-01");
  assert.equal(pickupDays("2026-12-31")[1], "2027-01-02");
  assert.equal(pickupDays("2026-12-31")[2], "2027-01-04");
  assert.equal(pickupDays("2028-02-28")[0], "2028-02-29");
});

test("the window length can be set", () => {
  const five = pickupDays("2026-11-03", [], 5);
  assert.equal(five.length, 5);
  assert.equal(five[4], "2026-11-09");
});

test("blocked days (closed, or holding an event) are skipped; 10 days remain", () => {
  assert.deepEqual(pickupDays("2026-11-20", ["2026-11-26", "2026-11-27"]), [
    "2026-11-21",
    "2026-11-23",
    "2026-11-24",
    "2026-11-25",
    "2026-11-28",
    "2026-11-30",
    "2026-12-01",
    "2026-12-02",
    "2026-12-03",
    "2026-12-04",
  ]);
  // Blocking a Sunday changes nothing — it was never bookable.
  assert.deepEqual(
    pickupDays("2026-11-03", ["2026-11-08"]),
    pickupDays("2026-11-03")
  );
});

test("every window is 10 ascending non-Sundays strictly after its start", () => {
  for (let i = 0; i < 14; i++) {
    const start = addDays("2026-11-01", i);
    const days = pickupDays(start);
    assert.equal(days.length, 10, start);
    days.forEach((day, j) => {
      assert.ok(day > start, `${day} after ${start}`);
      assert.ok(isPickupWeekday(day), `${day} is not a Sunday`);
      if (j > 0) assert.ok(day > days[j - 1], "ascending");
    });
  }
});

test("isPickupDay accepts only days inside the window", () => {
  const today = "2026-11-03";
  assert.equal(isPickupDay("2026-11-04", today), true);
  assert.equal(isPickupDay("2026-11-07", today), true, "Saturday");
  assert.equal(isPickupDay("2026-11-14", today), true, "10th day");
  assert.equal(isPickupDay("2026-11-03", today), false, "same day");
  assert.equal(isPickupDay("2026-11-02", today), false, "past");
  assert.equal(isPickupDay("2026-11-08", today), false, "Sunday");
  assert.equal(isPickupDay("2026-11-16", today), false, "11th day");
  assert.equal(isPickupDay("2026-02-30", today), false, "not a day");
  assert.equal(isPickupDay(20261104, today), false, "not a string");
  assert.equal(
    isPickupDay("2026-11-26", "2026-11-20", ["2026-11-26"]),
    false,
    "blocked"
  );
  assert.equal(
    isPickupDay("2026-12-04", "2026-11-20", ["2026-11-26", "2026-11-27"]),
    true,
    "window extends past blocked days"
  );
});

test("pickup slots are 30 minutes long, from opening up to closing", () => {
  assert.equal(SLOT_MINUTES, 30);
  assert.equal(SLOT_CAPACITY, 5);
  assert.deepEqual(DEFAULT_PICKUP_HOURS, { start: "15:00", end: "18:00" });
  assert.deepEqual(pickupSlots("15:00", "18:00"), [
    "15:00",
    "15:30",
    "16:00",
    "16:30",
    "17:00",
    "17:30",
  ]);
  assert.deepEqual(pickupSlots("09:30", "10:30"), ["09:30", "10:00"]);
  assert.equal(slotEnd("15:30"), "16:00");
  assert.equal(slotEnd("09:00"), "09:30");
});

test("pickup hours fall back to the default when unset or nonsensical", () => {
  assert.deepEqual(pickupHours("10:00", "12:30"), {
    start: "10:00",
    end: "12:30",
  });
  for (const [start, end] of [
    [undefined, undefined],
    ["15:00", undefined],
    ["18:00", "15:00"],
    ["15:00", "15:00"],
    ["15:10", "18:00"],
    ["25:00", "26:00"],
    ["junk", "18:00"],
  ]) {
    assert.deepEqual(pickupHours(start, end), DEFAULT_PICKUP_HOURS);
  }
  assert.equal(isSlotTime("15:30"), true);
  assert.equal(isSlotTime("15:15"), false);
  assert.equal(isSlotTime("24:00"), false);
  assert.equal(isSlotTime(1530), false);
});

test("parseClosedDays reads the stored list tolerantly", () => {
  assert.deepEqual(
    parseClosedDays(" 2026-11-27,2026-11-26 ,junk,2026-11-26,"),
    ["2026-11-26", "2026-11-27"]
  );
  assert.deepEqual(parseClosedDays(""), []);
  assert.deepEqual(parseClosedDays(undefined), []);
});

test("pruneClosedDays drops today and the past", () => {
  assert.deepEqual(
    pruneClosedDays(["2026-11-02", "2026-11-03", "2026-11-04"], "2026-11-03"),
    ["2026-11-04"]
  );
});

test("storeDayKey is the calendar day in the store's zone, across DST", () => {
  const at = (iso) => storeDayKey(new Date(iso), BOISE);
  assert.equal(at("2026-11-04T03:00:00Z"), "2026-11-03");
  assert.equal(at("2026-11-04T06:59:59Z"), "2026-11-03");
  assert.equal(at("2026-11-04T07:00:00Z"), "2026-11-04");
  // Still daylight time (UTC-6) until 08:00Z on Nov 1.
  assert.equal(at("2026-11-01T05:59:59Z"), "2026-10-31");
  assert.equal(at("2026-11-01T06:00:00Z"), "2026-11-01");
});

test("storeDayStartUtc is midnight UTC of the store's today", () => {
  // 8 PM Boise on Nov 3 is already Nov 4 in UTC. The upcoming-events
  // cutoff used to take the UTC date and drop that evening's events.
  assert.equal(
    storeDayStartUtc(new Date("2026-11-04T03:00:00Z"), BOISE).toISOString(),
    "2026-11-03T00:00:00.000Z"
  );
});

test("the pickup window turns over at store midnight, not UTC midnight", () => {
  const windowAt = (iso) => pickupDays(storeDayKey(new Date(iso), BOISE));
  // 11:59:59 PM Thursday Boise: Friday is still bookable.
  assert.equal(windowAt("2026-11-06T06:59:59Z")[0], "2026-11-06");
  // Midnight Friday Boise: Friday is now same-day; Saturday is next.
  assert.equal(windowAt("2026-11-06T07:00:00Z")[0], "2026-11-07");
});

test("day keys round-trip through stored dates", () => {
  assert.equal(toDayKey(new Date("2026-11-04T00:00:00.000Z")), "2026-11-04");
  assert.equal(toDayKey("2026-11-04T00:00:00.000Z"), "2026-11-04");
  assert.equal(
    dayKeyToUtcDate("2026-11-04").toISOString(),
    "2026-11-04T00:00:00.000Z"
  );
  assert.equal(monthKeyOf("2026-11-04"), "2026-11");
});

test("groupEventsByMonth groups in month order, skipping empty months", () => {
  const events = [
    { id: "feb", date: "2027-02-14T00:00:00.000Z" },
    { id: "nov-a", date: new Date("2026-11-04T00:00:00.000Z") },
    { id: "dec", date: "2026-12-01T00:00:00.000Z" },
    { id: "nov-b", date: "2026-11-04T00:00:00.000Z" },
  ];
  const groups = groupEventsByMonth(events);
  assert.deepEqual(
    groups.map((g) => g.monthKey),
    ["2026-11", "2026-12", "2027-02"]
  );
  assert.deepEqual(
    groups[0].events.map((e) => e.id),
    ["nov-a", "nov-b"],
    "same-day events keep their order"
  );
  assert.equal(groups[0].year, 2026);
  assert.equal(groups[0].monthIndex, 10);
  // Midnight UTC Dec 1 is Nov 30 in Boise — must still group as December.
  assert.equal(
    groupEventsByMonth([{ date: new Date("2026-12-01T00:00:00Z") }])[0]
      .monthKey,
    "2026-12"
  );
  assert.deepEqual(groupEventsByMonth([]), []);
});

test("defaultOpenMonth opens this month, else the nearest later one", () => {
  const groups = (...keys) => keys.map((monthKey) => ({ monthKey }));
  assert.equal(
    defaultOpenMonth(groups("2026-11", "2026-12"), "2026-11"),
    "2026-11"
  );
  assert.equal(
    defaultOpenMonth(groups("2026-12", "2027-02"), "2026-11"),
    "2026-12"
  );
  assert.equal(
    defaultOpenMonth(groups("2026-10", "2026-12"), "2026-11"),
    "2026-12"
  );
  assert.equal(defaultOpenMonth(groups("2026-09"), "2026-11"), null);
  assert.equal(defaultOpenMonth([], "2026-11"), null);
});
