"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";

const STATUSES = ["pending", "shipped", "delivered", "cancelled"];

const STATUS_STYLES = {
  pending: "bg-yellow-100 text-yellow-700",
  shipped: "bg-blue-100 text-blue-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState("");

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (isAdmin) {
      api
        .get("/admin/orders")
        .then((res) => setOrders(res.data.orders))
        .catch(() => setError("Failed to load orders."));
    }
  }, [isAdmin]);

  const updateStatus = async (orderId, status) => {
    setError("");
    try {
      const res = await api.patch(`/admin/orders/${orderId}`, { status });
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? res.data.order : o))
      );
    } catch {
      setError("Failed to update order status.");
    }
  };

  if (authLoading || (isAdmin && orders === null && !error)) {
    return (
      <div className="max-w-6xl mx-auto safe-x py-20 text-center text-gray-500">
        Loading...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-6xl mx-auto safe-x py-20 text-center">
        <h1 className="text-3xl font-bold text-[#2A4A52] mb-4">Admin</h1>
        <p className="text-gray-500 mb-6">
          You need an admin account to view this page.
        </p>
        <Link
          href="/login"
          className="bg-[#4A7C8A] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#3A6270] transition"
        >
          Log In
        </Link>
      </div>
    );
  }

  const orderList = orders ?? [];

  return (
    <div className="max-w-6xl mx-auto safe-x py-6 sm:py-10">
      <h1 className="text-3xl font-bold text-[#2A4A52] mb-8">
        Admin — Orders
      </h1>

      {error && (
        <p className="text-red-500 text-sm bg-red-50 p-3 rounded-lg mb-6">{error}</p>
      )}

      {orderList.length === 0 ? (
        <p className="text-gray-500 text-center py-10">No orders yet.</p>
      ) : (
        <div className="space-y-6">
          {orderList.map((order) => (
            <div key={order.id} className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
              <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
                <div>
                  <p className="font-semibold text-[#2A4A52]">
                    {order.confirmationNumber}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {new Date(order.createdAt).toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {order.user
                      ? `${order.user.name} (${order.user.email})`
                      : `Guest: ${order.guestName ? `${order.guestName} — ` : ""}${order.guestEmail}`}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {order.fulfillmentType === "pickup"
                      ? "Pickup at market/event"
                      : `Ship to: ${order.address}, ${order.city}, ${order.state} ${order.zip}`}
                    {order.channel === "market" && " · Market sale"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${
                      STATUS_STYLES[order.status] || "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {order.status}
                  </span>
                  <select
                    value={order.status}
                    onChange={(e) => updateStatus(order.id, e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 min-h-11 text-base sm:text-sm"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-4 text-sm">
                    <span className="flex-1">
                      {item.product.name}
                      {item.variant && ` — ${item.variant.name}`}
                    </span>
                    <span className="text-gray-500">x {item.quantity}</span>
                    <span className="w-20 text-right font-medium">
                      ${(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
              <hr className="my-4 border-gray-100" />
              <div className="flex justify-end">
                <p className="font-bold text-[#C8722A]">
                  Total: ${order.total.toFixed(2)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
