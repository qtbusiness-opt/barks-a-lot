"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import AdminShell from "@/components/AdminShell";
import { useAsyncAction } from "@/lib/use-async-action";
import {
  PICKUP_ENABLED,
  PICKUP_DETAILS,
  PICKUP_CLOSED_DAYS,
  PICKUP_HOURS_START,
  PICKUP_HOURS_END,
  MAX_CLOSED_DAYS,
} from "@/lib/setting-keys";
import {
  isPickupWeekday,
  parseClosedDays,
  pruneClosedDays,
  pickupHours,
  pickupSlots,
  SLOT_CAPACITY,
} from "@/lib/calendar-days";
import { dayKeyOf, formatTime } from "@/lib/pickup-window";
import { formatPickupDay } from "@/lib/format-date";

const inputClass =
  "w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#4A7C8A]";
const buttonClass =
  "min-h-11 px-4 rounded-lg font-semibold text-white bg-[#4A7C8A] hover:bg-[#3A6270] active:bg-[#2A4A52] transition disabled:opacity-50 disabled:cursor-not-allowed";

// Every half hour of the day, for the opening/closing pickers.
const HALF_HOURS = pickupSlots("00:00", "24:00");

// Pickup settings: the on/off switch, the hours slots are offered in, the
// where-to-collect text shown to customers, and the days the owner is
// unavailable. Stored as site settings through the generic, admin-only
// settings route.
// Opening and closing time for pickup slots, saved as soon as either
// changes.
function PickupHoursCard({ hours, saving, onChange }) {
  const slots = pickupSlots(hours.start, hours.end);
  return (
    <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
      <h2 className="font-semibold text-[#2A4A52]">Pickup hours</h2>
      <p className="text-sm text-gray-500 mt-1 mb-3">
        The same hours apply Monday through Saturday. Customers book a 30-minute
        slot, and each slot takes up to {SLOT_CAPACITY} orders — right now
        that&rsquo;s {slots.length} slot
        {slots.length === 1 ? "" : "s"} a day, the last starting at{" "}
        {formatTime(slots.at(-1))}.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="pickup-opens"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Opens
          </label>
          <select
            id="pickup-opens"
            value={hours.start}
            disabled={saving}
            onChange={(e) => onChange(e.target.value, hours.end)}
            className={inputClass}
          >
            {HALF_HOURS.map((time) => (
              <option key={time} value={time}>
                {formatTime(time)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="pickup-closes"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Closes
          </label>
          <select
            id="pickup-closes"
            value={hours.end}
            disabled={saving}
            onChange={(e) => onChange(hours.start, e.target.value)}
            className={inputClass}
          >
            {HALF_HOURS.slice(1).map((time) => (
              <option key={time} value={time}>
                {formatTime(time)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-2">
        Changing hours doesn&rsquo;t move orders already booked.
      </p>
    </div>
  );
}

export default function AdminPickupPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [settings, setSettings] = useState(null);
  const [details, setDetails] = useState("");
  const [closeDay, setCloseDay] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (isAdmin) {
      api
        .get("/admin/site-settings")
        .then((res) => {
          setSettings(res.data.settings);
          setDetails(res.data.settings[PICKUP_DETAILS] ?? "");
        })
        .catch(() => setError("Failed to load the pickup settings."));
    }
  }, [isAdmin]);

  // One guard for every change, so a double click can't send two writes
  // and nothing else can be changed while one is in flight.
  const [save, saving] = useAsyncAction(async (key, value, doneNotice) => {
    setError("");
    setNotice("");
    // Optimistic, so the switch moves the moment it's clicked; rolled back
    // if the save fails.
    const previous = settings?.[key];
    setSettings((prev) => ({ ...prev, [key]: value }));
    try {
      await api.patch("/admin/site-settings", { key, value });
      setNotice(doneNotice);
      return true;
    } catch (err) {
      setSettings((prev) => ({ ...prev, [key]: previous }));
      setError(err.response?.data?.error || "Failed to save the change.");
      return false;
    }
  });

  const enabled = settings?.[PICKUP_ENABLED] === "true";
  const closedDays = parseClosedDays(settings?.[PICKUP_CLOSED_DAYS]);

  const hours = pickupHours(
    settings?.[PICKUP_HOURS_START],
    settings?.[PICKUP_HOURS_END]
  );

  // Hours are two settings saved one at a time, so both are always written:
  // a lone value would pair with nothing and the server would fall back to
  // the default hours.
  const saveHours = async (start, end) => {
    if (start >= end) {
      setNotice("");
      setError("Closing time has to be after opening time.");
      return;
    }
    const doneNotice = `Pickup hours are ${formatTime(start)} – ${formatTime(end)}.`;
    if (await save(PICKUP_HOURS_START, start, doneNotice)) {
      await save(PICKUP_HOURS_END, end, doneNotice);
    }
  };

  const saveClosedDays = (days, doneNotice) =>
    save(PICKUP_CLOSED_DAYS, days.join(","), doneNotice);

  const addClosedDay = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    const today = dayKeyOf();
    if (!closeDay || closeDay <= today) {
      setError("Pick a day after today.");
      return;
    }
    if (!isPickupWeekday(closeDay)) {
      setError("Sundays are already closed — pick another day.");
      return;
    }
    const next = pruneClosedDays(
      parseClosedDays([...closedDays, closeDay].join(",")),
      today
    );
    if (next.length > MAX_CLOSED_DAYS) {
      setError(
        "That's as many closed days as we can keep — reopen some first."
      );
      return;
    }
    if (await saveClosedDays(next, `${formatPickupDay(closeDay)} is closed.`)) {
      setCloseDay("");
    }
  };

  const reopen = (day) =>
    saveClosedDays(
      pruneClosedDays(
        closedDays.filter((d) => d !== day),
        dayKeyOf()
      ),
      `${formatPickupDay(day)} is open again.`
    );

  return (
    <AdminShell title="Pickup" backTo="/admin">
      <p className="text-sm text-gray-500 mb-6 -mt-4">
        How customers collect online orders: a pickup day (Monday–Saturday) and
        a 30-minute time slot.
      </p>

      {error && (
        <p
          role="alert"
          className="text-red-500 text-sm bg-red-50 p-3 rounded-lg mb-4"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="text-green-700 text-sm bg-green-50 p-3 rounded-lg mb-4"
        >
          {notice}
        </p>
      )}

      {settings === null && !error ? (
        <p className="text-gray-500 text-center py-10">Loading…</p>
      ) : (
        <div className="space-y-6 max-w-xl">
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
            <label className="flex items-center gap-3 font-semibold text-[#2A4A52] cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                disabled={saving}
                onChange={(e) =>
                  save(
                    PICKUP_ENABLED,
                    e.target.checked ? "true" : "",
                    e.target.checked ? "Pickup is on." : "Pickup is off."
                  )
                }
                className="h-5 w-5 accent-[#4A7C8A]"
              />
              Offer pickup at checkout
            </label>
            <p className="text-sm text-gray-500 mt-2">
              Customers choose from the next 10 open days (Monday–Saturday),
              starting the day after they order. Sundays, closed days and any
              day with an event on the calendar are skipped automatically. While
              this is off, online orders can&rsquo;t be placed.
            </p>
          </div>

          <PickupHoursCard hours={hours} saving={saving} onChange={saveHours} />

          <form
            onSubmit={(e) => {
              e.preventDefault();
              save(PICKUP_DETAILS, details, "Pickup details saved.");
            }}
            className="bg-white rounded-xl shadow-sm p-4 sm:p-6"
          >
            <label
              htmlFor="pickup-details"
              className="block font-semibold text-[#2A4A52] mb-1"
            >
              Pickup details shown to customers
            </label>
            <p className="text-sm text-gray-500 mb-3">
              Where to collect — e.g. &ldquo;Porch pickup at 123 Main St,
              Meridian.&rdquo; Shown at checkout, in My Orders and in order
              emails. Anyone can see it at checkout, so leave out anything you
              don&rsquo;t want public.
            </p>
            <textarea
              id="pickup-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={500}
              rows={4}
              className={inputClass}
            />
            <button
              type="submit"
              disabled={saving}
              className={`${buttonClass} mt-3`}
            >
              Save details
            </button>
          </form>

          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
            <h2 className="font-semibold text-[#2A4A52]">Closed days</h2>
            <p className="text-sm text-gray-500 mt-1 mb-3">
              Closed days never appear at checkout; customers still get 10 open
              days to choose from. Event days are blocked automatically, so
              there&rsquo;s no need to add them here. Closing a day (or adding
              an event) doesn&rsquo;t change orders already booked for it —
              check Orders for those.
            </p>
            <form
              onSubmit={addClosedDay}
              className="flex flex-col sm:flex-row sm:items-end gap-3"
            >
              <div className="flex-1">
                <label
                  htmlFor="closed-day"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Close a day
                </label>
                <input
                  id="closed-day"
                  type="date"
                  value={closeDay}
                  onChange={(e) => setCloseDay(e.target.value)}
                  className={inputClass}
                />
              </div>
              <button
                type="submit"
                disabled={saving || !closeDay}
                className={buttonClass}
              >
                Close day
              </button>
            </form>

            {closedDays.length === 0 ? (
              <p className="text-sm text-gray-500 mt-4">No closed days.</p>
            ) : (
              <ul className="mt-4 divide-y divide-gray-100 border-t border-gray-100">
                {closedDays.map((day) => (
                  <li
                    key={day}
                    className="flex items-center justify-between gap-3 py-2"
                  >
                    <span className="text-[#2A4A52]">
                      {formatPickupDay(day)}
                    </span>
                    <button
                      type="button"
                      onClick={() => reopen(day)}
                      disabled={saving}
                      className="min-h-11 px-3 rounded-lg text-sm font-medium border border-[#4A7C8A] text-[#4A7C8A] hover:bg-[#4A7C8A] hover:text-white transition disabled:opacity-50"
                    >
                      Reopen
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </AdminShell>
  );
}
