// Fixed badge palette for calendar events. The admin picks a key; the
// classes stay in one place so the calendar, day view, and forms agree.
export const EVENT_COLORS = {
  teal: { label: "Teal", badge: "bg-[#4A7C8A] text-white", swatch: "bg-[#4A7C8A]" },
  orange: { label: "Orange", badge: "bg-[#C8722A] text-white", swatch: "bg-[#C8722A]" },
  green: { label: "Green", badge: "bg-green-600 text-white", swatch: "bg-green-600" },
  blue: { label: "Blue", badge: "bg-blue-600 text-white", swatch: "bg-blue-600" },
  purple: { label: "Purple", badge: "bg-purple-600 text-white", swatch: "bg-purple-600" },
  red: { label: "Red", badge: "bg-red-600 text-white", swatch: "bg-red-600" },
};

export const EVENT_COLOR_KEYS = Object.keys(EVENT_COLORS);

export function badgeClass(color) {
  return (EVENT_COLORS[color] ?? EVENT_COLORS.teal).badge;
}

// YYYY-MM-DD key for a stored event date (midnight UTC).
export function eventDayKey(isoDate) {
  return String(isoDate).slice(0, 10);
}
