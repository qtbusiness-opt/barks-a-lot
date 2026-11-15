import Link from "next/link";
import { badgeClass } from "@/lib/event-colors";
import { formatCalendarDay, formatMonth } from "@/lib/format-date";
import { formatTimeRange } from "@/lib/pickup-window";
import { toDayKey } from "@/lib/calendar-days";
import { CalendarIcon } from "@/components/Icons";

// Upcoming events as one collapsible section per month. Rendered on the
// server: native <details>/<summary> gives keyboard toggling (Enter or
// Space) and an expanded/collapsed state for screen readers, with no
// client JavaScript.
//
// Day keys come from toDayKey only. event-colors.js's eventDayKey
// expects a JSON string; given the Date objects Prisma returns here it
// produces "Wed Nov 04" and every link would break.
export default function EventsMonthList({ groups, openMonth }) {
  if (groups.length === 0) {
    return (
      <div className="bg-brand-paper-2 rounded-xl p-6 sm:p-8 text-center flex flex-col items-center">
        <CalendarIcon className="h-8 w-8 mb-3 text-brand-ink-2" />
        <p className="text-brand-ink-2 mb-4">
          No upcoming events yet — check back soon!
        </p>
        <Link
          href="/events?view=calendar"
          className="inline-flex items-center min-h-11 text-brand-ink-2 font-medium underline underline-offset-4 decoration-2 hover:text-brand-ink"
        >
          Browse the calendar
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <details
          key={group.monthKey}
          data-month={group.monthKey}
          open={group.monthKey === openMonth}
          className="group bg-white rounded-xl shadow-sm"
        >
          <summary className="flex items-center justify-between gap-3 px-4 sm:px-6 min-h-14 cursor-pointer list-none rounded-xl [&::-webkit-details-marker]:hidden hover:bg-[#F5F0E8]">
            <span className="text-lg font-semibold text-[#2A4A52]">
              {formatMonth(group.year, group.monthIndex)}
            </span>
            <span className="flex items-center gap-3 text-sm text-gray-600">
              {group.events.length}{" "}
              {group.events.length === 1 ? "event" : "events"}
              <span
                aria-hidden="true"
                className="inline-block transition-transform group-open:rotate-180"
              >
                ▾
              </span>
            </span>
          </summary>
          <ul className="divide-y divide-gray-100 border-t border-gray-100">
            {group.events.map((event) => {
              const day = toDayKey(event.date);
              const meta = [formatTimeRange(event), event.location]
                .filter(Boolean)
                .join(" · ");
              return (
                <li key={event.id}>
                  <Link
                    href={`/events/${day}`}
                    className="flex items-center gap-4 px-4 sm:px-6 py-3 min-h-16 hover:bg-[#F5F0E8] transition"
                  >
                    <span className="w-12 shrink-0 text-center leading-tight">
                      <span className="block text-xs font-semibold uppercase text-[#3A6270]">
                        {formatCalendarDay(day, { weekday: "short" })}
                      </span>
                      <span className="block text-xl font-bold text-[#2A4A52]">
                        {formatCalendarDay(day, { day: "numeric" })}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`inline-block max-w-full truncate rounded px-2 py-0.5 text-xs font-semibold ${badgeClass(event.color)}`}
                      >
                        {event.title}
                      </span>
                      {meta && (
                        <span className="block text-sm text-gray-600 mt-1">
                          {meta}
                        </span>
                      )}
                    </span>
                    <span aria-hidden="true" className="text-[#3A6270]">
                      →
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </details>
      ))}
    </div>
  );
}
