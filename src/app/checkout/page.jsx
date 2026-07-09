"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import api from "@/lib/api";
import Link from "next/link";

export default function CheckoutPage() {
  const { user } = useAuth();
  const { items, total, clearCart } = useCart();
  const router = useRouter();
  const [form, setForm] = useState({
    guestName: "",
    guestEmail: "",
    address: "",
    city: "",
    state: "",
    zip: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState(null);

  // Guest orders finish here (guests have no orders page), so show the
  // confirmation inline after the cart has been cleared.
  if (confirmation) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h1 className="text-3xl font-bold text-[#2A4A52] mb-4">
          Thank You for Your Order!
        </h1>
        <p className="text-gray-600 mb-2">
          Your confirmation number is
        </p>
        <p className="text-2xl font-bold text-[#C8722A] mb-6">{confirmation}</p>
        <p className="text-gray-500 mb-8">
          Keep this number for your records — you&apos;ll need it if you contact
          us about your order.
        </p>
        <Link
          href="/products"
          className="bg-[#4A7C8A] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#3A6270] transition"
        >
          Continue Shopping
        </Link>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h1 className="text-3xl font-bold text-[#2A4A52] mb-4">Checkout</h1>
        <p className="text-gray-500 mb-6">Your cart is empty.</p>
        <Link
          href="/products"
          className="bg-[#4A7C8A] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#3A6270] transition"
        >
          Start Shopping
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await api.post("/orders", {
        items: items.map((i) => ({ productId: i.id, quantity: i.quantity })),
        address: form.address,
        city: form.city,
        state: form.state,
        zip: form.zip,
        ...(user ? {} : { guestEmail: form.guestEmail, guestName: form.guestName }),
      });
      clearCart();
      if (user) {
        router.push("/orders");
      } else {
        setConfirmation(res.data.order.confirmationNumber);
      }
    } catch {
      setError("Failed to place order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const update = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-[#2A4A52] mb-8">Checkout</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <form onSubmit={handleSubmit} className="space-y-4">
          {!user && (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-[#2A4A52]">
                  Guest Checkout
                </h2>
                <Link
                  href="/login"
                  className="text-sm text-[#4A7C8A] font-medium hover:underline"
                >
                  Have an account? Log in
                </Link>
              </div>
              <input
                type="text"
                placeholder="Name"
                value={form.guestName}
                onChange={(e) => update("guestName", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#4A7C8A]"
              />
              <input
                type="email"
                placeholder="Email"
                value={form.guestEmail}
                onChange={(e) => update("guestEmail", e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#4A7C8A]"
              />
            </>
          )}

          <h2 className="text-xl font-semibold text-[#2A4A52]">Shipping Address</h2>
          {error && (
            <p className="text-red-500 text-sm bg-red-50 p-3 rounded-lg">{error}</p>
          )}
          <input
            type="text"
            placeholder="Street Address"
            value={form.address}
            onChange={(e) => update("address", e.target.value)}
            required
            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#4A7C8A]"
          />
          <input
            type="text"
            placeholder="City"
            value={form.city}
            onChange={(e) => update("city", e.target.value)}
            required
            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#4A7C8A]"
          />
          <div className="grid grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="State"
              value={form.state}
              onChange={(e) => update("state", e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#4A7C8A]"
            />
            <input
              type="text"
              placeholder="ZIP Code"
              value={form.zip}
              onChange={(e) => update("zip", e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#4A7C8A]"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#C8722A] hover:bg-[#A85D1F] text-white py-3 rounded-lg font-semibold transition disabled:opacity-50"
          >
            {submitting ? "Placing Order..." : `Place Order - $${total.toFixed(2)}`}
          </button>
        </form>

        <div className="bg-[#F5F0E8] rounded-xl p-6">
          <h2 className="text-xl font-semibold text-[#2A4A52] mb-4">Order Summary</h2>
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span>
                  {item.name} x {item.quantity}
                </span>
                <span className="font-medium">
                  ${(item.price * item.quantity).toFixed(2)}
                </span>
              </div>
            ))}
            <hr className="border-[#D4CCBC]" />
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span className="text-[#C8722A]">${total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
