"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import AdminShell from "@/components/AdminShell";

export default function AdminNotificationsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  // "active" | "archived"
  const [view, setView] = useState("active");
  // Tagged with the view it was loaded for, so switching tabs shows a
  // loading state without a synchronous setState in the effect.
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isAdmin) {
      const q = view === "archived" ? "?archived=true" : "";
      api
        .get(`/admin/notifications${q}`)
        .then((res) => setResult({ view, notifications: res.data.notifications }))
        .catch(() => setError("Failed to load notifications."));
    }
  }, [isAdmin, view]);

  const archived = view === "archived";
  const loading = result?.view !== view;
  const notifications = loading ? null : result.notifications;

  const setArchived = async (id, value) => {
    setError("");
    try {
      await api.patch(`/admin/notifications/${id}`, { archived: value });
      // Drop it from the current list — it now belongs to the other view.
      setResult((prev) => ({
        ...prev,
        notifications: prev.notifications.filter((n) => n.id !== id),
      }));
    } catch {
      setError(`Failed to ${value ? "archive" : "restore"} the notification.`);
    }
  };

  const tabClass = (active) =>
    `min-h-11 px-4 rounded-lg text-sm font-medium transition ${
      active
        ? "bg-[#4A7C8A] text-white"
        : "bg-white text-[#4A7C8A] border border-[#4A7C8A] hover:bg-[#4A7C8A] hover:text-white"
    }`;

  return (
    <AdminShell title="Customer Notifications" backTo="/admin">
      <p className="text-sm text-gray-500 mb-4 -mt-4">
        Order updates recorded against each customer&rsquo;s email. A
        notification is created every time an order&rsquo;s status changes.
      </p>

      <div className="flex gap-2 mb-6">
        <button onClick={() => setView("active")} className={tabClass(!archived)}>
          Active
        </button>
        <button onClick={() => setView("archived")} className={tabClass(archived)}>
          Archived
        </button>
      </div>

      {error && (
        <p role="alert" className="text-red-500 text-sm bg-red-50 p-3 rounded-lg mb-6">
          {error}
        </p>
      )}

      {notifications === null && !error ? (
        <p className="text-gray-500 text-center py-10">Loading notifications…</p>
      ) : notifications?.length === 0 ? (
        <p className="text-gray-500 text-center py-10">
          {archived
            ? "No archived notifications."
            : "No notifications yet — they appear when order statuses change."}
        </p>
      ) : (
        <div className="space-y-3">
          {notifications?.map((n) => (
            <div
              key={n.id}
              className="bg-white rounded-xl shadow-sm p-4 flex flex-wrap items-baseline justify-between gap-2"
            >
              <div className="min-w-0">
                <p className="font-semibold text-[#2A4A52]">{n.email}</p>
                <p className="text-sm text-gray-600 mt-1">{n.message}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <p className="text-xs text-gray-500">
                  {new Date(n.createdAt).toLocaleString()}
                </p>
                <button
                  onClick={() => setArchived(n.id, !archived)}
                  className="min-h-9 px-3 rounded-lg text-sm font-medium border border-[#4A7C8A] text-[#4A7C8A] hover:bg-[#4A7C8A] hover:text-white transition"
                >
                  {archived ? "Restore" : "Archive"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
