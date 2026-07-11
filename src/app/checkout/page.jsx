"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import api from "@/lib/api";
import Link from "next/link";

const inputClass =
  "w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#4A7C8A]";

const eventDay = (event) => String(event.date).slice(0, 10);

const formatEventDate = (event) =>
  new Date(`${eventDay(event)}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

const pad = (n) => String(n).padStart(2, "0");

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function Stepper({ step }) {
  return (
    <ol className="flex items-center gap-2 text-sm font-medium mb-6">
      {["Your Info", "Review & Pay"].map((label, i) => {
        const active = step === i;
        const done = step > i;
        return (
          <li key={label} className="flex items-center gap-2">
            {i > 0 && <span className="w-6 sm:w-10 h-px bg-gray-300" />}
            <span
              className={`flex items-center justify-center w-6 h-6 rounded-full text-xs ${
                done
                  ? "bg-green-600 text-white"
                  : active
                  ? "bg-[#4A7C8A] text-white"
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              {done ? "✓" : i + 1}
            </span>
            <span className={active ? "text-[#2A4A52]" : "text-gray-400"}>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function OrderSummary({ items, total }) {
  return (
    <div className="bg-[#F5F0E8] rounded-xl p-4 sm:p-6">
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
  );
}

export default function CheckoutPage() {
  const { user } = useAuth();
  const { items, total, clearCart } = useCart();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [fulfillmentType, setFulfillmentType] = useState("shipping");
  const [pickupChoice, setPickupChoice] = useState("");
  const [upcomingEvents, setUpcomingEvents] = useState(null);
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

  useEffect(() => {
    api
      .get("/events?upcoming=true")
      .then((res) => setUpcomingEvents(res.data.events))
      .catch(() => setUpcomingEvents([]));
  }, []);

  const events = upcomingEvents ?? [];
  const hasEvents = events.length > 0;
  // "Next Event" means the nearest upcoming event that is NOT today.
  const nextEvent = events.find((e) => eventDay(e) > todayKey()) ?? null;
  const chosenEvent =
    pickupChoice === "next" ? nextEvent : events.find((e) => e.id === pickupChoice);

  // Guest orders finish here (guests have no orders page), so show the
  // confirmation inline after the cart has been cleared.
  if (confirmation) {
    return (
      <div className="max-w-4xl mx-auto safe-x py-20 text-center">
        <h1 className="text-3xl font-bold text-[#2A4A52] mb-4">
          Thank You for Your Order!
        </h1>
        <p className="text-gray-600 mb-2">Your confirmation number is</p>
        <p className="text-2xl font-bold text-[#C8722A] mb-6">
          {confirmation.number}
        </p>
        <p className="text-gray-500 mb-8">
          {confirmation.event
            ? `We'll have your order ready at ${confirmation.event.title} on ${formatEventDate(confirmation.event)} — just give us your confirmation number at the booth.`
            : "Keep this number for your records — you'll need it if you contact us about your order."}
        </p>
        <Link
          href="/products"
          className="inline-block bg-[#4A7C8A] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#3A6270] transition"
        >
          Continue Shopping
        </Link>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto safe-x py-20 text-center">
        <h1 className="text-3xl font-bold text-[#2A4A52] mb-4">Checkout</h1>
        <p className="text-gray-500 mb-6">Your cart is empty.</p>
        <Link
          href="/products"
          className="inline-block bg-[#4A7C8A] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#3A6270] transition"
        >
          Start Shopping
        </Link>
      </div>
    );
  }

  const update = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // Step 1 submit only advances to review — nothing is charged or saved.
  const handleContinue = (e) => {
    e.preventDefault();
    setError("");
    setStep(1);
    window.scrollTo({ top: 0 });
  };

  // Square payment processing plugs in here: tokenize the card, then send
  // the payment token along with the order payload.
  const handleProcessPayment = async () => {
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
          : { pickupEventId: pickupChoice }),
        ...(user ? {} : { guestEmail: form.guestEmail, guestName: form.guestName }),
      });
      clearCart();
      if (user) {
        router.push("/orders");
      } else {
        setConfirmation({
          number: res.data.order.confirmationNumber,
          event: res.data.order.pickupEvent,
        });
      }
    } catch (err) {
      setError(
        err.response?.data?.error || "Failed to place order. Please try again."
      );
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto safe-x py-6 sm:py-10">
      <h1 className="text-2xl sm:text-3xl font-bold text-[#2A4A52] mb-4">
        Checkout
      </h1>
      <Stepper step={step} />

      {error && (
        <p className="text-red-500 text-sm bg-red-50 p-3 rounded-lg mb-6">{error}</p>
      )}

      {step === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          <form onSubmit={handleContinue} className="space-y-4 order-2 md:order-1">
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
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                <label className="flex items-center gap-3 border border-gray-300 rounded-lg px-4 py-3 min-h-12 cursor-pointer has-checked:border-[#4A7C8A] has-checked:bg-[#F5F0E8]">
                  <input
                    type="radio"
                    name="fulfillment"
                    value="shipping"
                    checked={fulfillmentType === "shipping"}
                    onChange={() => setFulfillmentType("shipping")}
                  />
                  <span className="text-sm font-medium">Ship to me</span>
                </label>
                <label
                  className={`flex items-center gap-3 border border-gray-300 rounded-lg px-4 py-3 min-h-12 ${
                    hasEvents
                      ? "cursor-pointer has-checked:border-[#4A7C8A] has-checked:bg-[#F5F0E8]"
                      : "opacity-50 cursor-not-allowed"
                  }`}
                >
                  <input
                    type="radio"
                    name="fulfillment"
                    value="pickup"
                    checked={fulfillmentType === "pickup"}
                    onChange={() => setFulfillmentType("pickup")}
                    disabled={!hasEvents}
                  />
                  <span className="text-sm font-medium">
                    Pickup at market/event
                    {upcomingEvents !== null && !hasEvents && (
                      <span className="block text-xs text-gray-500 font-normal">
                        No upcoming events scheduled
                      </span>
                    )}
                  </span>
                </label>
              </div>
            </fieldset>

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
              <div>
                <label htmlFor="pickup-event" className="block text-xl font-semibold text-[#2A4A52] mb-2">
                  Pickup Event
                </label>
                <select
                  id="pickup-event"
                  value={pickupChoice}
                  onChange={(e) => setPickupChoice(e.target.value)}
                  required
                  className={inputClass}
                >
                  <option value="" disabled>
                    Choose an event...
                  </option>
                  <option value="next" disabled={!nextEvent}>
                    Next Event
                    {nextEvent
                      ? ` (${nextEvent.title} — ${formatEventDate(nextEvent)})`
                      : " (none scheduled after today)"}
                  </option>
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.title} — {formatEventDate(event)}
                      {event.location ? ` · ${event.location}` : ""}
                    </option>
                  ))}
                </select>
                {chosenEvent && (
                  <p className="text-sm text-gray-600 bg-[#F5F0E8] p-3 rounded-lg mt-2">
                    Pick up at <strong>{chosenEvent.title}</strong> on{" "}
                    {formatEventDate(chosenEvent)}
                    {chosenEvent.location && <> — {chosenEvent.location}</>}.
                  </p>
                )}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-[#4A7C8A] hover:bg-[#3A6270] active:bg-[#2A4A52] text-white py-3 rounded-lg font-semibold transition"
            >
              Continue to Review
            </button>
          </form>

          <div className="order-1 md:order-2 md:self-start">
            <OrderSummary items={items} total={total} />
          </div>
        </div>
      ) : (
        <div className="space-y-6 max-w-2xl">
          <OrderSummary items={items} total={total} />

          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 space-y-4">
            <h2 className="text-xl font-semibold text-[#2A4A52]">
              Review Your Information
            </h2>

            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                Contact
              </h3>
              <p className="text-[#2A4A52] mt-1">
                {user ? (
                  <>
                    {user.name} ({user.email})
                  </>
                ) : (
                  <>
                    {form.guestName ? `${form.guestName} — ` : ""}
                    {form.guestEmail}
                  </>
                )}
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                Delivery
              </h3>
              {fulfillmentType === "shipping" ? (
                <p className="text-[#2A4A52] mt-1">
                  Ship to: {form.address}, {form.city}, {form.state} {form.zip}
                </p>
              ) : chosenEvent ? (
                <div className="text-[#2A4A52] mt-1">
                  <p className="font-medium">
                    Pickup at {chosenEvent.title}
                    {pickupChoice === "next" && " (Next Event)"}
                  </p>
                  <p className="text-sm text-gray-600">
                    {formatEventDate(chosenEvent)}
                    {chosenEvent.location && <> · {chosenEvent.location}</>}
                  </p>
                </div>
              ) : (
                <p className="text-red-500 mt-1">No pickup event selected.</p>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setStep(0)}
              className="sm:flex-1 border-2 border-[#4A7C8A] text-[#4A7C8A] py-3 rounded-lg font-semibold hover:bg-[#4A7C8A] hover:text-white active:bg-[#3A6270] transition"
            >
              Back
            </button>
            {/* Square payment SDK will mount its card form here; the button
                then submits the tokenized payment with the order. */}
            <button
              onClick={handleProcessPayment}
              disabled={submitting || (fulfillmentType === "pickup" && !chosenEvent)}
              className="sm:flex-[2] bg-[#C8722A] hover:bg-[#A85D1F] active:bg-[#8A4D1A] text-white py-3 rounded-lg font-semibold transition disabled:opacity-50"
            >
              {submitting
                ? "Processing..."
                : `Process Payment — $${total.toFixed(2)}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
