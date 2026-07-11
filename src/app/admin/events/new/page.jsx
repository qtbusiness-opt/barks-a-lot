"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import api from "@/lib/api";
import AdminShell from "@/components/AdminShell";
import { EVENT_COLORS, EVENT_COLOR_KEYS } from "@/lib/event-colors";
import LocationInput from "@/components/LocationInput";

const inputClass =
  "w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#4A7C8A]";

const pad = (n) => String(n).padStart(2, "0");

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function NewEventForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefill = searchParams.get("date");

  const [form, setForm] = useState({
    title: "",
    description: "",
    location: "",
    date: /^\d{4}-\d{2}-\d{2}$/.test(prefill ?? "") ? prefill : todayKey(),
    color: "teal",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const update = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.post("/admin/events", form);
      router.push(`/events/${form.date}`);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to create event.");
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-xl shadow-sm p-4 sm:p-6 space-y-4 max-w-xl"
    >
      {error && (
        <p className="text-red-500 text-sm bg-red-50 p-3 rounded-lg">{error}</p>
      )}
      <div>
        <label htmlFor="e-title" className="block text-sm font-medium text-gray-700 mb-1">
          Title
        </label>
        <input
          id="e-title"
          type="text"
          value={form.title}
          onChange={(e) => update("title", e.target.value)}
          required
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="e-desc" className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          id="e-desc"
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
          required
          rows={4}
          className={inputClass}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="e-loc" className="block text-sm font-medium text-gray-700 mb-1">
            Location (optional)
          </label>
          <LocationInput
            id="e-loc"
            value={form.location}
            onChange={(v) => update("location", v)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="e-date" className="block text-sm font-medium text-gray-700 mb-1">
            Date
          </label>
          <input
            id="e-date"
            type="date"
            value={form.date}
            onChange={(e) => update("date", e.target.value)}
            required
            className={inputClass}
          />
        </div>
      </div>
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
                checked={form.color === key}
                onChange={() => update("color", key)}
                className="sr-only"
              />
              <span
                title={EVENT_COLORS[key].label}
                className={`block w-9 h-9 rounded-full ${EVENT_COLORS[key].swatch} ${
                  form.color === key ? "ring-2 ring-offset-2 ring-[#2A4A52]" : ""
                }`}
              />
            </label>
          ))}
        </div>
      </fieldset>
      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-[#C8722A] hover:bg-[#A85D1F] active:bg-[#8A4D1A] text-white py-3 rounded-lg font-semibold transition disabled:opacity-50"
      >
        {submitting ? "Creating..." : "Create Event"}
      </button>
    </form>
  );
}

export default function NewEventPage() {
  return (
    <AdminShell title="New Event" backTo="/admin">
      <Suspense fallback={<p className="text-gray-500">Loading...</p>}>
        <NewEventForm />
      </Suspense>
    </AdminShell>
  );
}
