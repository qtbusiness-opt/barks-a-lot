"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { badgeClass, eventDayKey } from "@/lib/event-colors";
import { formatMonth } from "@/lib/format-date";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const pad = (n) => String(n).padStart(2, "0");
const monthKey = (y, m) => `${y}-${pad(m + 1)}`;
const dayKey = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

export default function EventsCalendarPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  // The calendar opens on today's month with today highlighted.
  const today = new Date();
  const [view, setView] = useState({
    year: today.getFullYear(),
    month: today.getMonth(),
  });
  const [events, setEvents] = useState([]);

  useEffect(() => {
    api
      .get(`/events?month=${monthKey(view.year, view.month)}`)
      .then((res) => setEvents(res.data.events))
      .catch(() => setEvents([]));
  }, [view]);

  const eventsByDay = {};
  for (const event of events) {
    const key = eventDayKey(event.date);
    (eventsByDay[key] ??= []).push(event);
  }

  const firstWeekday = new Date(view.year, view.month, 1).getDay();
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const todayKey = dayKey(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  const cells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const shiftMonth = (delta) =>
    setView(({ year, month }) => {
      const d = new Date(year, month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  const monthLabel = formatMonth(view.year, view.month);

  return (
    <div className="max-w-7xl mx-auto safe-x py-6 sm:py-10">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#2A4A52]">
          Events
        </h1>
        {isAdmin && (
          <Link
            href="/admin/events/new"
            className="bg-[#C8722A] hover:bg-[#A85D1F] active:bg-[#8A4D1A] text-white px-4 py-2.5 rounded-lg font-semibold transition"
          >
            + Add Event
          </Link>
        )}
      </div>

      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => shiftMonth(-1)}
          aria-label="Previous month"
          className="flex items-center justify-center h-11 w-11 rounded-lg border border-[#4A7C8A] text-[#4A7C8A] hover:bg-[#4A7C8A] hover:text-white active:bg-[#3A6270] transition"
        >
          &larr;
        </button>
        <h2 className="text-lg sm:text-xl font-semibold text-[#2A4A52]">
          {monthLabel}
        </h2>
        <button
          onClick={() => shiftMonth(1)}
          aria-label="Next month"
          className="flex items-center justify-center h-11 w-11 rounded-lg border border-[#4A7C8A] text-[#4A7C8A] hover:bg-[#4A7C8A] hover:text-white active:bg-[#3A6270] transition"
        >
          &rarr;
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-xs sm:text-sm font-semibold text-[#4A7C8A] mb-1">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={`pad-${i}`} />;
          }
          const key = dayKey(view.year, view.month, day);
          const dayEvents = eventsByDay[key] ?? [];
          const isToday = key === todayKey;
          const clickable = dayEvents.length > 0 || isAdmin;

          const box = (
            <>
              <span
                className={`text-xs sm:text-sm font-semibold ${
                  isToday
                    ? "inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#C8722A] text-white"
                    : "text-[#2A4A52]"
                }`}
              >
                {day}
              </span>
              <span className="mt-1 space-y-0.5 block">
                {dayEvents.map((event) => (
                  <span
                    key={event.id}
                    className={`block truncate rounded px-1 py-0.5 text-[10px] sm:text-xs font-medium ${badgeClass(event.color)}`}
                  >
                    {event.title}
                  </span>
                ))}
              </span>
            </>
          );

          return clickable ? (
            <Link
              key={key}
              href={`/events/${key}`}
              className={`min-h-16 sm:min-h-28 rounded-lg border bg-white p-1 sm:p-2 text-left align-top hover:border-[#4A7C8A] hover:shadow-sm active:bg-[#F5F0E8] transition ${
                isToday ? "border-[#C8722A]" : "border-gray-200"
              }`}
            >
              {box}
            </Link>
          ) : (
            <div
              key={key}
              className={`min-h-16 sm:min-h-28 rounded-lg border bg-white p-1 sm:p-2 ${
                isToday ? "border-[#C8722A]" : "border-gray-200"
              }`}
            >
              {box}
            </div>
          );
        })}
      </div>

      <p className="text-sm text-gray-500 mt-4">
        Tap a date with an event to see the details
        {isAdmin ? ", or any date to manage that day's events." : "."}
      </p>
    </div>
  );
}
