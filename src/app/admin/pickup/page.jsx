"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import AdminShell from "@/components/AdminShell";
import { useAsyncAction } from "@/lib/use-async-action";
import {
  WEEKDAY_PICKUP_ENABLED,
  WEEKDAY_PICKUP_DETAILS,
  WEEKDAY_PICKUP_CLOSED_DAYS,
  MAX_CLOSED_DAYS,
} from "@/lib/setting-keys";
import {
  isWeekday,
  parseClosedDays,
  pruneClosedDays,
} from "@/lib/calendar-days";
import { dayKeyOf } from "@/lib/pickup-window";
import { formatPickupDay } from "@/lib/format-date";

const inputClass =
  "w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#4A7C8A]";
const buttonClass =
  "min-h-11 px-4 rounded-lg font-semibold text-white bg-[#4A7C8A] hover:bg-[#3A6270] active:bg-[#2A4A52] transition disabled:opacity-50 disabled:cursor-not-allowed";

// Weekday pickup settings: the on/off switch, the where/when text shown
// to customers, and the days the owner is unavailable. Stored as site
// settings through the generic, admin-only settings route.
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
          setDetails(res.data.settings[WEEKDAY_PICKUP_DETAILS] ?? "");
        })
        .catch(() => setError("Failed to load the weekday pickup settings."));
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

  const enabled = settings?.[WEEKDAY_PICKUP_ENABLED] === "true";
  const closedDays = parseClosedDays(settings?.[WEEKDAY_PICKUP_CLOSED_DAYS]);

  const saveClosedDays = (days, doneNotice) =>
    save(WEEKDAY_PICKUP_CLOSED_DAYS, days.join(","), doneNotice);

  const addClosedDay = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    const today = dayKeyOf();
    if (!closeDay || closeDay <= today) {
      setError("Pick a day after today.");
      return;
    }
    if (!isWeekday(closeDay)) {
      setError("Weekends are already closed — pick a weekday.");
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
    <AdminShell title="Weekday Pickup" backTo="/admin">
      <p className="text-sm text-gray-500 mb-6 -mt-4">
        Let customers collect their order on a weekday instead of at a market or
        event.
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
                    WEEKDAY_PICKUP_ENABLED,
                    e.target.checked ? "true" : "",
                    e.target.checked
                      ? "Weekday pickup is on."
                      : "Weekday pickup is off."
                  )
                }
                className="h-5 w-5 accent-[#4A7C8A]"
              />
              Offer weekday pickup at checkout
            </label>
            <p className="text-sm text-gray-500 mt-2">
              Customers can choose from the next 10 open weekdays
              (Monday–Friday), starting the day after they order.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              save(WEEKDAY_PICKUP_DETAILS, details, "Pickup details saved.");
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
              Where and when to collect — e.g. &ldquo;Porch pickup in Meridian,
              3–6 PM.&rdquo; Shown at checkout, in My Orders and in order
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
              weekdays to choose from. Closing a day doesn&rsquo;t change orders
              already booked for it — check Orders for those.
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
