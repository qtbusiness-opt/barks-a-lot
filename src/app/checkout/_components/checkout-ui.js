import { formatCalendarDay } from "@/lib/format-date";

// Shared by the checkout page and its sections so every field and event
// date reads the same across both steps and the confirmation.
export const inputClass = "w-full border border-[#4A7C8A] rounded-lg px-4 py-3";

const eventDay = (event) => String(event.date).slice(0, 10);

export const formatEventDate = (event) =>
  formatCalendarDay(eventDay(event), {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
