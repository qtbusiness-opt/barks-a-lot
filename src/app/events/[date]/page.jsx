"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { EVENT_COLORS, EVENT_COLOR_KEYS, badgeClass } from "@/lib/event-colors";

const inputClass =
  "w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#4A7C8A]";

function ColorPicker({ value, onChange }) {
  return (
    <fieldset>
      <legend className="block text-sm font-medium text-gray-700 mb-1">
        Badge color
      </legend>
      <div className="flex gap-2">
        {EVENT_COLOR_KEYS.map((key) => (
          <label key={key} className="cursor-pointer">
            <input
              type="radio"
              name="color"
              value={key}
              checked={value === key}
              onChange={() => onChange(key)}
              className="sr-only"
            />
            <span
              title={EVENT_COLORS[key].label}
              className={`block w-9 h-9 rounded-full ${EVENT_COLORS[key].swatch} ${
                value === key ? "ring-2 ring-offset-2 ring-[#2A4A52]" : ""
              }`}
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// Admins edit in place; customers get the read-only card.
function EventCard({ event, isAdmin, onSaved, onDeleted, onError }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);

  const startEdit = () => {
    setForm({
      title: event.title,
      description: event.description,
      location: event.location ?? "",
      date: String(event.date).slice(0, 10),
      color: event.color,
    });
    setEditing(true);
  };

  const update = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    onError("");
    try {
      const res = await api.patch(`/admin/events/${event.id}`, form);
      onSaved(res.data.event);
      setEditing(false);
    } catch (err) {
      onError(err.response?.data?.error || "Failed to update event.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete "${event.title}"?`)) return;
    onError("");
    try {
      await api.delete(`/admin/events/${event.id}`);
      onDeleted(event.id);
    } catch (err) {
      onError(err.response?.data?.error || "Failed to delete event.");
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
      <span
        className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${badgeClass(event.color)}`}
      >
        {event.title}
      </span>
      <h2 className="text-xl font-bold text-[#2A4A52] mt-3">{event.title}</h2>
      {event.location && (
        <p className="text-sm text-[#4A7C8A] font-medium mt-1">
          📍 {event.location}
        </p>
      )}
      <p className="text-gray-600 mt-3 leading-relaxed">{event.description}</p>

      {isAdmin && (
        <>
          <div className="flex gap-2 mt-4">
            <button
              onClick={editing ? () => setEditing(false) : startEdit}
              className="min-h-11 px-3 rounded-lg text-sm font-medium border border-[#4A7C8A] text-[#4A7C8A] hover:bg-[#4A7C8A] hover:text-white active:bg-[#3A6270] transition"
            >
              {editing ? "Close" : "Edit"}
            </button>
            <button
              onClick={remove}
              className="min-h-11 px-3 rounded-lg text-sm font-medium border border-red-300 text-red-500 hover:bg-red-500 hover:text-white active:bg-red-600 transition"
            >
              Delete
            </button>
          </div>

          {editing && form && (
            <form onSubmit={save} className="mt-4 pt-4 border-t border-gray-100 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => update("title", e.target.value)}
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => update("description", e.target.value)}
                  required
                  rows={3}
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={(e) => update("location", e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => update("date", e.target.value)}
                    required
                    className={inputClass}
                  />
                </div>
              </div>
              <ColorPicker value={form.color} onChange={(c) => update("color", c)} />
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-[#4A7C8A] hover:bg-[#3A6270] active:bg-[#2A4A52] text-white py-3 rounded-lg font-semibold transition disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </form>
          )}
        </>
      )}
    </div>
  );
}

export default function EventDayPage() {
  const { date } = useParams();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [fetched, setFetched] = useState(null);
  const [error, setError] = useState("");

  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date ?? "");

  useEffect(() => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) {
      api
        .get(`/events?date=${date}`)
        .then((res) => setFetched(res.data.events))
        .catch(() => setError("Failed to load events."));
    }
  }, [date]);

  // A malformed date in the URL just renders an empty day.
  const events = validDate ? fetched : [];
  const setEvents = (updater) =>
    setFetched(typeof updater === "function" ? updater : () => updater);

  const dayLabel = validDate
    ? new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : date;

  return (
    <div className="max-w-3xl mx-auto safe-x py-6 sm:py-10">
      <Link
        href="/events"
        className="inline-flex items-center min-h-11 text-[#4A7C8A] hover:underline mb-1"
      >
        &larr; Back to Calendar
      </Link>
      <h1 className="text-2xl sm:text-3xl font-bold text-[#2A4A52] mb-6">
        {dayLabel}
      </h1>

      {error && (
        <p className="text-red-500 text-sm bg-red-50 p-3 rounded-lg mb-6">{error}</p>
      )}

      {events === null ? (
        <p className="text-gray-500 text-center py-10">Loading events...</p>
      ) : events.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-gray-500 mb-6">No events on this day.</p>
          {isAdmin && (
            <Link
              href={`/admin/events/new?date=${date}`}
              className="inline-block bg-[#C8722A] hover:bg-[#A85D1F] text-white px-6 py-3 rounded-lg font-semibold transition"
            >
              + Add Event on This Day
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              isAdmin={isAdmin}
              onSaved={(updated) =>
                setEvents((prev) =>
                  // An edit can move the event to another day — drop it from
                  // this view when the date changed.
                  prev
                    .map((x) => (x.id === updated.id ? updated : x))
                    .filter((x) => String(x.date).slice(0, 10) === date)
                )
              }
              onDeleted={(id) =>
                setEvents((prev) => prev.filter((x) => x.id !== id))
              }
              onError={setError}
            />
          ))}
          {isAdmin && (
            <Link
              href={`/admin/events/new?date=${date}`}
              className="block text-center border-2 border-dashed border-[#4A7C8A]/40 text-[#4A7C8A] rounded-xl py-4 font-medium hover:border-[#4A7C8A] hover:bg-[#F5F0E8] transition"
            >
              + Add Another Event
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
