"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import AdminShell from "@/components/AdminShell";

export default function AdminNotificationsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [notifications, setNotifications] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isAdmin) {
      api
        .get("/admin/notifications")
        .then((res) => setNotifications(res.data.notifications))
        .catch(() => setError("Failed to load notifications."));
    }
  }, [isAdmin]);

  return (
    <AdminShell title="Customer Notifications" backTo="/admin">
      <p className="text-sm text-gray-500 mb-6 -mt-4">
        Order updates recorded against each customer&apos;s email. A
        notification is created every time an order&apos;s status changes.
      </p>
      {error && (
        <p role="alert" className="text-red-500 text-sm bg-red-50 p-3 rounded-lg mb-6">{error}</p>
      )}

      {notifications === null && !error ? (
        <p className="text-gray-500 text-center py-10">Loading notifications...</p>
      ) : notifications?.length === 0 ? (
        <p className="text-gray-500 text-center py-10">
          No notifications yet — they appear when order statuses change.
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
              <p className="text-xs text-gray-500 shrink-0">
                {new Date(n.createdAt).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
