"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import AdminShell from "@/components/AdminShell";
import StoreImage from "@/components/StoreImage";
import { orderStatusLabel } from "@/lib/order-status";
import { formatCalendarDay, formatDateTime } from "@/lib/format-date";

const STATUSES = ["pending", "shipped", "delivered", "cancelled"];

const STATUS_STYLES = {
  pending: "bg-yellow-100 text-yellow-700",
  shipped: "bg-blue-100 text-blue-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function AdminOrdersPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isAdmin) {
      api
        .get("/admin/orders")
        .then((res) => setOrders(res.data.orders))
        .catch(() => setError("Failed to load orders."));
    }
  }, [isAdmin]);

  const patchOrder = async (orderId, body, fallbackMsg) => {
    setError("");
    try {
      const res = await api.patch(`/admin/orders/${orderId}`, body);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? res.data.order : o))
      );
    } catch (err) {
      setError(err.response?.data?.error || fallbackMsg);
    }
  };

  const updateStatus = (orderId, status) =>
    patchOrder(orderId, { status }, "Failed to update order status.");

  const toggleRefunded = (orderId, refunded) =>
    patchOrder(orderId, { refunded }, "Failed to update the refunded tag.");

  const orderList = orders ?? [];

  return (
    <AdminShell title="Orders" backTo="/admin">
      {error && (
        <p
          role="alert"
          className="text-red-500 text-sm bg-red-50 p-3 rounded-lg mb-6"
        >
          {error}
        </p>
      )}

      {orders === null && !error ? (
        <p className="text-gray-500 text-center py-10">Loading orders…</p>
      ) : orderList.length === 0 ? (
        <p className="text-gray-500 text-center py-10">No orders yet.</p>
      ) : (
        <div className="space-y-6">
          {orderList.map((order) => (
            <div
              key={order.id}
              className="bg-white rounded-xl shadow-sm p-4 sm:p-6"
            >
              <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
                <div>
                  <p className="font-semibold text-[#2A4A52]">
                    {order.confirmationNumber}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {formatDateTime(order.createdAt)}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {order.user
                      ? `${order.user.name} (${order.user.email})`
                      : `Guest: ${order.guestName ? `${order.guestName} — ` : ""}${order.guestEmail}`}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {order.fulfillmentType === "pickup"
                      ? order.pickupEvent
                        ? `Pickup at ${order.pickupEvent.title} — ${formatCalendarDay(
                            order.pickupEvent.date
                          )}${order.pickupEvent.location ? ` · ${order.pickupEvent.location}` : ""}`
                        : "Pickup at market/event"
                      : `Ship to: ${order.address}, ${order.city}, ${order.state} ${order.zip}`}
                    {order.channel === "market" && " · Market sale"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      STATUS_STYLES[order.status] || "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {orderStatusLabel(order.status)}
                  </span>
                  {order.refunded && (
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                      Refunded
                    </span>
                  )}

                  {order.status === "delivered" ? (
                    // Picked up: status is locked; only the bookkeeping
                    // Refunded tag can be toggled.
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={order.refunded}
                        onChange={(e) =>
                          toggleRefunded(order.id, e.target.checked)
                        }
                      />
                      Refunded (bookkeeping)
                    </label>
                  ) : order.status === "cancelled" ? (
                    <span className="text-xs text-gray-400">Locked</span>
                  ) : (
                    <select
                      value={order.status}
                      onChange={(e) => updateStatus(order.id, e.target.value)}
                      aria-label={`Update status for ${order.confirmationNumber}`}
                      className="border border-gray-300 rounded-lg px-3 py-2 min-h-11 text-base sm:text-sm"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {orderStatusLabel(s)}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                {order.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 text-sm"
                  >
                    {/* Decorative: the name sits right beside it, so an
                        alt would only repeat what a screen reader just
                        read. Shows the option the customer picked, which
                        is what's being packed. */}
                    <StoreImage
                      src={item.image ?? item.product.image}
                      alt=""
                      width={40}
                      height={40}
                      className="w-10 h-10 rounded-md object-cover bg-[#F5F0E8] shrink-0"
                    />
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
              <div className="flex flex-col items-end gap-0.5">
                {order.discountTotal > 0 && (
                  <>
                    <p className="text-sm text-gray-500">
                      Subtotal: $
                      {(order.total + order.discountTotal).toFixed(2)}
                    </p>
                    <p className="text-sm text-green-700">
                      Discount{order.promoCode ? ` (${order.promoCode})` : ""}:
                      −$
                      {order.discountTotal.toFixed(2)}
                    </p>
                  </>
                )}
                <p className="font-bold text-[#C8722A]">
                  Total: ${order.total.toFixed(2)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
