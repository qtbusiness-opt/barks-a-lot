"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import AdminShell from "@/components/AdminShell";
import { formatDateTime } from "@/lib/format-date";

// Friendly labels for the raw event keys.
const EVENT_LABELS = {
  login_success: "Login",
  login_failed: "Failed login",
  login_unverified: "Blocked (unverified)",
  login_rate_limited: "Rate-limited",
  server_error: "Server error",
  payment_error: "Payment error",
  cart_abandoned: "Abandoned cart",
};
const eventLabel = (e) => EVENT_LABELS[e] || e;

const LEVEL_STYLES = {
  error: "bg-red-100 text-red-700",
  warn: "bg-yellow-100 text-yellow-700",
  info: "bg-green-100 text-green-700",
};

function StatCard({ label, value, accent }) {
  return (
    <div className={`rounded-xl p-4 text-center ${accent}`}>
      <p className="text-2xl font-bold">{value ?? "—"}</p>
      <p className="text-xs font-medium mt-1">{label}</p>
    </div>
  );
}

export default function AdminLogsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  // "all" | "auth" | "error" | "cart"
  const [filter, setFilter] = useState("all");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isAdmin) {
      const q = filter === "all" ? "" : `?category=${filter}`;
      api
        .get(`/admin/logs${q}`)
        .then((res) => setData({ filter, ...res.data }))
        .catch(() => setError("Failed to load the activity log."));
    }
  }, [isAdmin, filter]);

  const loading = data?.filter !== filter;
  const summary = data?.summary;
  const events = loading ? null : data.events;

  const tabClass = (active) =>
    `min-h-11 px-4 rounded-lg text-sm font-medium transition ${
      active
        ? "bg-[#4A7C8A] text-white"
        : "bg-white text-[#4A7C8A] border border-[#4A7C8A] hover:bg-[#4A7C8A] hover:text-white"
    }`;

  return (
    <AdminShell title="Activity Log" backTo="/admin">
      <p className="text-sm text-gray-500 mb-6 -mt-4">
        User logins, server errors, and carts abandoned at logout. Every event
        is also written to the container&rsquo;s stdout, so it shows up in{" "}
        <code>docker logs</code> too.
      </p>

      {error && (
        <p
          role="alert"
          className="text-red-500 text-sm bg-red-50 p-3 rounded-lg mb-6"
        >
          {error}
        </p>
      )}

      {/* Summary (last 24h, plus 7-day total) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Logins (24h)"
          value={summary?.loginsToday}
          accent="bg-green-50 text-green-700"
        />
        <StatCard
          label="Failed logins (24h)"
          value={summary?.failedToday}
          accent="bg-yellow-50 text-yellow-700"
        />
        <StatCard
          label="Errors (24h)"
          value={summary?.errorsToday}
          accent="bg-red-50 text-red-700"
        />
        <StatCard
          label="Events (7d)"
          value={summary?.totalWeek}
          accent="bg-slate-100 text-slate-700"
        />
      </div>

      {/* Breakdown by event type (last 24h) */}
      {summary && Object.keys(summary.breakdown).length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <h2 className="text-sm font-semibold text-[#2A4A52] mb-3">
            Last 24 hours by type
          </h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(summary.breakdown)
              .sort((a, b) => b[1] - a[1])
              .map(([ev, count]) => (
                <span
                  key={ev}
                  className="inline-flex items-center gap-2 bg-[#F5F0E8] rounded-full px-3 py-1 text-sm"
                >
                  <span className="text-[#2A4A52]">{eventLabel(ev)}</span>
                  <span className="font-semibold text-[#C8722A]">{count}</span>
                </span>
              ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setFilter("all")}
          className={tabClass(filter === "all")}
        >
          All
        </button>
        <button
          onClick={() => setFilter("auth")}
          className={tabClass(filter === "auth")}
        >
          Logins
        </button>
        <button
          onClick={() => setFilter("error")}
          className={tabClass(filter === "error")}
        >
          Errors
        </button>
        <button
          onClick={() => setFilter("cart")}
          className={tabClass(filter === "cart")}
        >
          Carts
        </button>
      </div>

      {events === null && !error ? (
        <p className="text-gray-500 text-center py-10">Loading events…</p>
      ) : events?.length === 0 ? (
        <p className="text-gray-500 text-center py-10">
          No events recorded yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="py-2 pr-4 font-medium">When</th>
                <th className="py-2 pr-4 font-medium">Event</th>
                <th className="py-2 pr-4 font-medium">Who</th>
                <th className="py-2 pr-4 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {events?.map((e) => (
                <tr key={e.id} className="border-b border-gray-100 align-top">
                  <td className="py-2 pr-4 whitespace-nowrap text-gray-500">
                    {formatDateTime(e.createdAt)}
                  </td>
                  <td className="py-2 pr-4 whitespace-nowrap">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        LEVEL_STYLES[e.level] || "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {eventLabel(e.event)}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-gray-700">
                    {e.email || "—"}
                    {e.ip && (
                      <span className="block text-xs text-gray-400">
                        {e.ip}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-gray-600">
                    {e.message}
                    {e.path && (
                      <span className="block text-xs text-gray-400">
                        {e.path}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
