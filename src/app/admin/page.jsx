"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import AdminShell from "@/components/AdminShell";

function StatPanel({ href, icon, label, value, detail, accent }) {
  return (
    <Link
      href={href}
      className="bg-white rounded-xl shadow-md p-5 sm:p-6 flex items-start gap-4 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all"
    >
      <span
        aria-hidden="true"
        className={`flex items-center justify-center w-12 h-12 rounded-xl text-2xl shrink-0 ${accent}`}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-3xl font-bold text-[#2A4A52]">
          {value ?? "—"}
        </span>
        <span className="block font-semibold text-[#4A7C8A] mt-0.5">{label}</span>
        {detail && (
          <span className="block text-sm text-gray-500 mt-1">{detail}</span>
        )}
      </span>
    </Link>
  );
}

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isAdmin) {
      api
        .get("/admin/stats")
        .then((res) => setStats(res.data.stats))
        .catch(() => setError("Failed to load dashboard stats."));
    }
  }, [isAdmin]);

  return (
    <AdminShell title="Admin Dashboard">
      {error && (
        <p role="alert" className="text-red-500 text-sm bg-red-50 p-3 rounded-lg mb-6">{error}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <StatPanel
          href="/admin/orders"
          icon="📦"
          accent="bg-[#4A7C8A]/10"
          label="Orders"
          value={stats?.orders.total}
          detail={
            stats ? `${stats.orders.pending} pending fulfillment` : "View and manage orders"
          }
        />
        <StatPanel
          href="/admin/products"
          icon="🦴"
          accent="bg-[#C8722A]/10"
          label="Products in Stock"
          value={stats?.products.inStock}
          detail={
            stats
              ? `${stats.products.units} units across the catalog`
              : "Manage the catalog"
          }
        />
        <StatPanel
          href="/admin/categories"
          icon="🏷️"
          accent="bg-teal-500/10"
          label="Categories"
          value={stats?.categories}
          detail="Create, rename, and remove product categories"
        />
        <StatPanel
          href="/admin/announcements"
          icon="📣"
          accent="bg-yellow-400/10"
          label="Announcements"
          value={stats?.announcements}
          detail="Create and review store announcements"
        />
        <StatPanel
          href="/admin/notifications"
          icon="✉️"
          accent="bg-green-500/10"
          label="Customer Notifications"
          value={stats?.notifications}
          detail="Order updates sent to customer emails"
        />
        <StatPanel
          href="/admin/messages"
          icon="💬"
          accent="bg-orange-500/10"
          label="Messages"
          value={stats?.unreadMessages}
          detail={
            stats
              ? `${stats.unreadMessages} unread from the contact form`
              : "Contact form messages"
          }
        />
        <StatPanel
          href="/events"
          icon="📅"
          accent="bg-purple-500/10"
          label="Upcoming Events"
          value={stats?.upcomingEvents}
          detail="Manage markets and expos on the calendar"
        />
        <StatPanel
          href="/admin/users"
          icon="🔑"
          accent="bg-blue-500/10"
          label="Admin Accounts"
          value={stats?.adminUsers}
          detail="Create and review admin logins"
        />
        <StatPanel
          href="/admin/customers"
          icon="🐾"
          accent="bg-pink-500/10"
          label="Customers"
          value={stats?.customers}
          detail="Look up accounts, send password resets"
        />
      </div>
    </AdminShell>
  );
}
