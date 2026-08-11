"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import Link from "next/link";
import { orderStatusLabel } from "@/lib/order-status";
import { parseSelectedOptions, formatSelectedOptions } from "@/lib/options";

export default function OrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(null);

  useEffect(() => {
    if (user) {
      api.get("/orders").then((res) => setOrders(res.data.orders));
    }
  }, [user]);

  const cancelOrder = async (orderId) => {
    if (
      !window.confirm(
        "Cancel this order? Your items will go back on the shelf and this can't be undone."
      )
    ) {
      return;
    }
    setError("");
    setCancelling(orderId);
    try {
      const res = await api.post(`/orders/${orderId}/cancel`);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? res.data.order : o))
      );
    } catch (err) {
      setError(err.response?.data?.error || "Failed to cancel the order.");
    } finally {
      setCancelling(null);
    }
  };

  const loading = authLoading || (!!user && orders === null);

  if (!authLoading && !user) {
    return (
      <div className="max-w-4xl mx-auto safe-x py-20 text-center">
        <h1 className="text-3xl font-bold text-[#2A4A52] mb-4">My Orders</h1>
        <p className="text-gray-500 mb-6">Please log in to view your orders.</p>
        <Link
          href="/login"
          className="bg-[#4A7C8A] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#3A6270] transition"
        >
          Log In
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center text-gray-500">
        Loading orders...
      </div>
    );
  }

  const orderList = orders ?? [];

  return (
    <div className="max-w-4xl mx-auto safe-x py-6 sm:py-10">
      <h1 className="text-2xl sm:text-3xl font-bold text-[#2A4A52] mb-6 sm:mb-8">
        My Orders
      </h1>

      {error && (
        <p
          role="alert"
          className="text-red-500 text-sm bg-red-50 p-3 rounded-lg mb-6"
        >
          {error}
        </p>
      )}

      {orderList.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-gray-500 mb-6">
            You haven&rsquo;t placed any orders yet.
          </p>
          <Link
            href="/products"
            className="bg-[#4A7C8A] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#3A6270] transition"
          >
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {orderList.map((order) => (
            <div
              key={order.id}
              className="bg-white rounded-xl shadow-sm p-4 sm:p-6"
            >
              <div className="flex flex-wrap gap-2 justify-between items-start mb-4">
                <div>
                  <p className="text-sm text-gray-500">
                    Order placed{" "}
                    {new Date(order.createdAt).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Confirmation #: {order.confirmationNumber}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {order.fulfillmentType === "pickup"
                      ? order.pickupEvent
                        ? `Pickup at ${order.pickupEvent.title} — ${new Date(
                            `${String(order.pickupEvent.date).slice(0, 10)}T00:00:00`
                          ).toLocaleDateString()}${order.pickupEvent.location ? ` · ${order.pickupEvent.location}` : ""}`
                        : "Pickup at market/event"
                      : "Ships to your address"}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    order.status === "pending"
                      ? "bg-yellow-100 text-yellow-700"
                      : order.status === "shipped"
                        ? "bg-blue-100 text-blue-700"
                        : order.status === "delivered"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {orderStatusLabel(order.status)}
                </span>
              </div>
              <div className="space-y-3">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-4">
                    <img
                      src={item.product.image}
                      alt={item.product.name}
                      className="w-12 h-12 rounded-lg object-cover bg-[#F5F0E8]"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {item.product.name}
                        {item.variant && ` — ${item.variant.name}`}
                      </p>
                      {formatSelectedOptions(
                        parseSelectedOptions(item.options)
                      ) && (
                        <p className="text-xs text-gray-500">
                          {formatSelectedOptions(
                            parseSelectedOptions(item.options)
                          )}
                        </p>
                      )}
                      <p className="text-xs text-gray-500">
                        Qty: {item.quantity}
                      </p>
                    </div>
                    <p className="text-sm font-medium">
                      ${(item.price * item.quantity).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
              <hr className="my-4 border-gray-100" />
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Cancellable until picked up ("delivered"). */}
                {["pending", "shipped"].includes(order.status) ? (
                  <button
                    onClick={() => cancelOrder(order.id)}
                    disabled={cancelling === order.id}
                    className="min-h-11 px-4 rounded-lg text-sm font-medium border border-red-300 text-red-500 hover:bg-red-500 hover:text-white active:bg-red-600 transition disabled:opacity-50"
                  >
                    {cancelling === order.id ? "Cancelling…" : "Cancel Order"}
                  </button>
                ) : (
                  <span />
                )}
                <div className="text-right">
                  {order.discountTotal > 0 && (
                    <p className="text-sm text-green-700">
                      Discount: −${order.discountTotal.toFixed(2)}
                    </p>
                  )}
                  <p className="font-bold text-[#C8722A]">
                    Total: ${order.total.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
