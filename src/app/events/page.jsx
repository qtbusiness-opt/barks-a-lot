import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { dayKeyOf, storeTodayStartUtc } from "@/lib/pickup-window";
import {
  groupEventsByMonth,
  defaultOpenMonth,
  monthKeyOf,
} from "@/lib/calendar-days";
import AddEventButton from "@/components/AddEventButton";
import EventsCalendar from "@/components/EventsCalendar";
import EventsMonthList from "@/components/EventsMonthList";

// "Today" and the open month are store time at request time — never
// frozen at build time.
export const dynamic = "force-dynamic";

// Upcoming events as a month-by-month list by default; ?view=calendar
// shows the month grid. The view lives in the URL so refresh, Back and a
// shared link all keep it.
export default async function EventsPage({ searchParams }) {
  const { view } = await searchParams;
  const showCalendar = view === "calendar";

  let groups = [];
  let openMonth = null;
  if (!showCalendar) {
    const events = await prisma.event.findMany({
      where: { date: { gte: storeTodayStartUtc() } },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });
    groups = groupEventsByMonth(events);
    openMonth = defaultOpenMonth(groups, monthKeyOf(dayKeyOf()));
  }

  return (
    <div className="max-w-7xl mx-auto safe-x py-6 sm:py-10">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#2A4A52]">
          Events
        </h1>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href={showCalendar ? "/events" : "/events?view=calendar"}
            className="inline-flex items-center min-h-11 px-4 rounded-lg border border-[#4A7C8A] text-[#4A7C8A] font-semibold hover:bg-[#4A7C8A] hover:text-white active:bg-[#3A6270] transition"
          >
            {showCalendar ? "List view" : "Calendar view"}
          </Link>
          <AddEventButton />
        </div>
      </div>

      {showCalendar ? (
        <EventsCalendar />
      ) : (
        <EventsMonthList groups={groups} openMonth={openMonth} />
      )}
    </div>
  );
}
