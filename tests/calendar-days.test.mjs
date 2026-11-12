// Calendar-day rules behind weekday pickup and the events list
// (src/lib/calendar-days.js): which weekdays can be booked, how store time
// maps to a calendar day, and how events group into months.
//
// The process runs in the store's own zone on purpose. Every rule here is
// meant to work on UTC day keys only, so any accidental local-time getter
// (getDay instead of getUTCDay) shifts a day and fails a test below.
process.env.TZ = "America/Boise";

import { test } from "node:test";
import assert from "node:assert/strict";

const {
  WEEKDAY_PICKUP_DAY_COUNT,
  storeDayKey,
  storeDayStartUtc,
  toDayKey,
  dayKeyToUtcDate,
  addDays,
  isWeekday,
  monthKeyOf,
  parseClosedDays,
  pruneClosedDays,
  weekdayPickupDays,
  isWeekdayPickupDay,
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

test("isWeekday is Monday through Friday on the calendar day itself", () => {
  for (const day of ["02", "03", "04", "05", "06"]) {
    assert.equal(isWeekday(`2026-11-${day}`), true, day);
  }
  assert.equal(isWeekday("2026-11-07"), false);
  assert.equal(isWeekday("2026-11-08"), false);
  // Midnight UTC Monday is still Sunday evening in Boise — a local getter
  // would call this a weekend.
  assert.equal(isWeekday("2026-11-09"), true);
});

test("the window is the next 10 weekdays, starting the day after today", () => {
  assert.equal(WEEKDAY_PICKUP_DAY_COUNT, 10);
  assert.deepEqual(weekdayPickupDays("2026-11-03"), [
    "2026-11-04",
    "2026-11-05",
    "2026-11-06",
    "2026-11-09",
    "2026-11-10",
    "2026-11-11",
    "2026-11-12",
    "2026-11-13",
    "2026-11-16",
    "2026-11-17",
  ]);
});

test("ordering on a Friday or over the weekend opens on Monday", () => {
  const fromSaturday = weekdayPickupDays("2026-11-07");
  assert.equal(fromSaturday.length, 10);
  assert.equal(fromSaturday[0], "2026-11-09");
  assert.equal(fromSaturday[9], "2026-11-20");
  assert.equal(weekdayPickupDays("2026-11-06")[0], "2026-11-09");
  // Sunday → Monday is tomorrow, which is allowed.
  assert.equal(weekdayPickupDays("2026-11-08")[0], "2026-11-09");
});

test("the window rolls across year ends and leap days", () => {
  assert.equal(weekdayPickupDays("2026-12-31")[0], "2027-01-01");
  assert.equal(weekdayPickupDays("2026-12-31")[1], "2027-01-04");
  assert.equal(weekdayPickupDays("2028-02-28")[0], "2028-02-29");
});

test("the window length can be set", () => {
  const five = weekdayPickupDays("2026-11-03", [], 5);
  assert.equal(five.length, 5);
  assert.equal(five[4], "2026-11-10");
});

test("closed days are skipped and the window still holds 10 open days", () => {
  assert.deepEqual(
    weekdayPickupDays("2026-11-20", ["2026-11-26", "2026-11-27"]),
    [
      "2026-11-23",
      "2026-11-24",
      "2026-11-25",
      "2026-11-30",
      "2026-12-01",
      "2026-12-02",
      "2026-12-03",
      "2026-12-04",
      "2026-12-07",
      "2026-12-08",
    ]
  );
  // Closing a Saturday changes nothing — it was never bookable.
  assert.deepEqual(
    weekdayPickupDays("2026-11-03", ["2026-11-07"]),
    weekdayPickupDays("2026-11-03")
  );
});

test("every window is 10 ascending weekdays strictly after its start day", () => {
  for (let i = 0; i < 14; i++) {
    const start = addDays("2026-11-01", i);
    const days = weekdayPickupDays(start);
    assert.equal(days.length, 10, start);
    days.forEach((day, j) => {
      assert.ok(day > start, `${day} after ${start}`);
      assert.ok(isWeekday(day), `${day} is a weekday`);
      if (j > 0) assert.ok(day > days[j - 1], "ascending");
    });
  }
});

test("isWeekdayPickupDay accepts only days inside the window", () => {
  const today = "2026-11-03";
  assert.equal(isWeekdayPickupDay("2026-11-04", today), true);
  assert.equal(isWeekdayPickupDay("2026-11-17", today), true, "10th day");
  assert.equal(isWeekdayPickupDay("2026-11-03", today), false, "same day");
  assert.equal(isWeekdayPickupDay("2026-11-02", today), false, "past");
  assert.equal(isWeekdayPickupDay("2026-11-07", today), false, "Saturday");
  assert.equal(isWeekdayPickupDay("2026-11-18", today), false, "11th day");
  assert.equal(isWeekdayPickupDay("2026-02-30", today), false, "not a day");
  assert.equal(isWeekdayPickupDay(20261104, today), false, "not a string");
  assert.equal(
    isWeekdayPickupDay("2026-11-26", "2026-11-20", ["2026-11-26"]),
    false,
    "closed"
  );
  assert.equal(
    isWeekdayPickupDay("2026-12-08", "2026-11-20", [
      "2026-11-26",
      "2026-11-27",
    ]),
    true,
    "window extends past closed days"
  );
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
  const windowAt = (iso) =>
    weekdayPickupDays(storeDayKey(new Date(iso), BOISE));
  // 11:59:59 PM Thursday Boise: Friday is still bookable.
  assert.equal(windowAt("2026-11-06T06:59:59Z")[0], "2026-11-06");
  // Midnight Friday Boise: Friday is now same-day; Monday is next.
  assert.equal(windowAt("2026-11-06T07:00:00Z")[0], "2026-11-09");
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
