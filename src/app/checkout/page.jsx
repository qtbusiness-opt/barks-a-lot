"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import api from "@/lib/api";
import Link from "next/link";

const inputClass =
  "w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#4A7C8A]";

export default function CheckoutPage() {
  const { user } = useAuth();
  const { items, total, clearCart } = useCart();
  const router = useRouter();
  const [fulfillmentType, setFulfillmentType] = useState("shipping");
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
        <p className="text-gray-600 mb-2">Your confirmation number is</p>
        <p className="text-2xl font-bold text-[#C8722A] mb-6">
          {confirmation.number}
        </p>
        <p className="text-gray-500 mb-8">
          {confirmation.fulfillmentType === "pickup"
            ? "We'll have your order ready for pickup at the market — just give us your confirmation number at the booth."
            : "Keep this number for your records — you'll need it if you contact us about your order."}
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
        items: items.map((i) => ({
          productId: i.productId,
          ...(i.variantId ? { variantId: i.variantId } : {}),
          quantity: i.quantity,
        })),
        fulfillmentType,
        ...(fulfillmentType === "shipping"
          ? {
              address: form.address,
              city: form.city,
              state: form.state,
              zip: form.zip,
            }
          : {}),
        ...(user ? {} : { guestEmail: form.guestEmail, guestName: form.guestName }),
      });
      clearCart();
      if (user) {
        router.push("/orders");
      } else {
        setConfirmation({
          number: res.data.order.confirmationNumber,
          fulfillmentType,
        });
      }
    } catch (err) {
      setError(
        err.response?.data?.error || "Failed to place order. Please try again."
      );
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
              <div>
                <label htmlFor="guest-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  id="guest-name"
                  type="text"
                  value={form.guestName}
                  onChange={(e) => update("guestName", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="guest-email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  id="guest-email"
                  type="email"
                  value={form.guestEmail}
                  onChange={(e) => update("guestEmail", e.target.value)}
                  required
                  className={inputClass}
                />
              </div>
            </>
          )}

          <fieldset>
            <legend className="text-xl font-semibold text-[#2A4A52] mb-2">
              Delivery Method
            </legend>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 border border-gray-300 rounded-lg px-4 py-3 cursor-pointer has-checked:border-[#4A7C8A] has-checked:bg-[#F5F0E8]">
                <input
                  type="radio"
                  name="fulfillment"
                  value="shipping"
                  checked={fulfillmentType === "shipping"}
                  onChange={() => setFulfillmentType("shipping")}
                />
                <span className="text-sm font-medium">Ship to me</span>
              </label>
              <label className="flex items-center gap-2 border border-gray-300 rounded-lg px-4 py-3 cursor-pointer has-checked:border-[#4A7C8A] has-checked:bg-[#F5F0E8]">
                <input
                  type="radio"
                  name="fulfillment"
                  value="pickup"
                  checked={fulfillmentType === "pickup"}
                  onChange={() => setFulfillmentType("pickup")}
                />
                <span className="text-sm font-medium">Pickup at market/event</span>
              </label>
            </div>
          </fieldset>

          {error && (
            <p className="text-red-500 text-sm bg-red-50 p-3 rounded-lg">{error}</p>
          )}

          {fulfillmentType === "shipping" ? (
            <>
              <h2 className="text-xl font-semibold text-[#2A4A52]">
                Shipping Address
              </h2>
              <div>
                <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                  Street Address
                </label>
                <input
                  id="address"
                  type="text"
                  value={form.address}
                  onChange={(e) => update("address", e.target.value)}
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
                  City
                </label>
                <input
                  id="city"
                  type="text"
                  value={form.city}
                  onChange={(e) => update("city", e.target.value)}
                  required
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">
                    State
                  </label>
                  <input
                    id="state"
                    type="text"
                    value={form.state}
                    onChange={(e) => update("state", e.target.value)}
                    required
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="zip" className="block text-sm font-medium text-gray-700 mb-1">
                    ZIP Code
                  </label>
                  <input
                    id="zip"
                    type="text"
                    value={form.zip}
                    onChange={(e) => update("zip", e.target.value)}
                    required
                    className={inputClass}
                  />
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-600 bg-[#F5F0E8] p-4 rounded-lg">
              No address needed — pick up your order at our next market or
              event. We&apos;ll hold it under your confirmation number.
            </p>
          )}

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
              <div key={item.key} className="flex justify-between text-sm">
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
