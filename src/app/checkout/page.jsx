"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import api from "@/lib/api";
import Link from "next/link";
import { SHIPPING_ENABLED, EVENT_PICKUP_ENABLED } from "@/lib/features";
import {
  isPickupSelectable,
  formatTimeRange,
  eventDayKey,
  dayKeyOf,
  PICKUP_FALLBACK,
  formatSlot,
} from "@/lib/pickup-window";
import { getPublicConfig } from "@/lib/public-config";
import { formatCalendarDay, formatPickupDay } from "@/lib/format-date";

const inputClass =
  "w-full border border-[#4A7C8A] rounded-lg px-4 py-3";

// Square Web Payments SDK. The app id is public by design (it only
// tokenizes cards in the browser); the secret access token lives
// server-side. Both ids come from /api/config at runtime (see
// lib/public-config.js). Without an app id the card form is skipped and
// the server skips charging too — payments simply aren't configured yet.
function loadSquareSdk(appId) {
  const sdkUrl = appId.startsWith("sandbox-")
    ? "https://sandbox.web.squarecdn.com/v1/square.js"
    : "https://web.squarecdn.com/v1/square.js";
  return new Promise((resolve, reject) => {
    if (window.Square) return resolve(window.Square);
    let script = document.querySelector(`script[src="${sdkUrl}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = sdkUrl;
      document.head.appendChild(script);
    }
    script.addEventListener("load", () => resolve(window.Square));
    script.addEventListener("error", () =>
      reject(new Error("Square SDK failed to load"))
    );
  });
}

// One shared line shape for every call that sends the cart to the
// server — the two promo-preview calls and the real order submit. Built
// once so options can't quietly drop from one of the three and make a
// preview disagree with the price checkout actually charges.
const orderLinePayload = (i) => ({
  productId: i.productId,
  ...(i.variantId ? { variantId: i.variantId } : {}),
  quantity: i.quantity,
  // The server re-resolves these ids to labels and prices, and re-checks
  // required groups, before the order is written.
  ...(i.options?.length ? { options: i.options } : {}),
});

const eventDay = (event) => String(event.date).slice(0, 10);

const formatEventDate = (event) =>
  formatCalendarDay(eventDay(event), {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

function Stepper({ step }) {
  return (
    <ol
      aria-label="Checkout progress"
      className="flex items-center gap-2 text-sm font-medium mb-6"
    >
      {["Your Info", "Review & Pay"].map((label, i) => {
        const active = step === i;
        const done = step > i;
        return (
          <li
            key={label}
            aria-current={active ? "step" : undefined}
            className="flex items-center gap-2"
          >
            {i > 0 && (
              <span
                aria-hidden="true"
                className="w-6 sm:w-10 h-px bg-gray-300"
              />
            )}
            <span
              aria-hidden="true"
              className={`flex items-center justify-center w-6 h-6 rounded-full text-xs ${
                done
                  ? "bg-green-700 text-white"
                  : active
                    ? "bg-[#4A7C8A] text-white"
                    : "bg-gray-200 text-gray-600"
              }`}
            >
              {done ? "✓" : i + 1}
            </span>
            <span className={active ? "text-[#2A4A52]" : "text-gray-600"}>
              {label}
              {done && <span className="sr-only"> (completed)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function OrderSummary({ items, subtotal, discount = 0, applied = [] }) {
  const total = Math.max(0, subtotal - discount);
  return (
    <div className="bg-[#F5F0E8] rounded-xl p-4 sm:p-6">
      <h2 className="text-xl font-semibold text-[#2A4A52] mb-4">
        Order Summary
      </h2>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.key} className="flex justify-between text-sm">
            <span>
              {item.name} x {item.quantity}
              {item.optionsLabel && (
                <span className="block text-xs text-gray-600">
                  {item.optionsLabel}
                </span>
              )}
            </span>
            <span className="font-medium">
              ${(item.price * item.quantity).toFixed(2)}
            </span>
          </div>
        ))}
        <hr className="border-[#E8DFC8]" />
        {discount > 0 && (
          <>
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-green-800">
              <span>Discount</span>
              <span>−${discount.toFixed(2)}</span>
            </div>
            {applied.length > 0 && (
              <ul className="text-xs text-green-800 list-disc pl-4">
                {applied.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            )}
          </>
        )}
        <div className="flex justify-between font-bold text-lg">
          <span>Total</span>
          <span className="text-[#8A4D1A]">${total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

// The day and half-hour slot pickers. Full days and full slots stay in
// the lists, disabled, so the customer can see they exist.
function PickupDayAndTime({
  schedule,
  chosenDay,
  setPickupDay,
  chosenTime,
  setPickupTime,
  pickupDetails,
}) {
  const daySlots = schedule.days.find((d) => d.day === chosenDay)?.slots ?? [];
  return (
    <div className="mt-3 space-y-2">
      <label htmlFor="pickup-day" className="sr-only">
        Pickup day
      </label>
      <select
        id="pickup-day"
        value={chosenDay}
        onChange={(e) => setPickupDay(e.target.value)}
        required
        className={inputClass}
      >
        <option value="" disabled>
          Choose a day...
        </option>
        {schedule.days.map(({ day, slots }) => {
          const full = !slots.some((slot) => slot.available);
          return (
            <option key={day} value={day} disabled={full}>
              {formatPickupDay(day)}
              {full ? " — fully booked" : ""}
            </option>
          );
        })}
      </select>
      <label htmlFor="pickup-time" className="sr-only">
        Pickup time
      </label>
      <select
        id="pickup-time"
        value={chosenTime}
        onChange={(e) => setPickupTime(e.target.value)}
        required
        disabled={!chosenDay}
        className={`${inputClass} disabled:bg-gray-100 disabled:text-gray-600`}
      >
        <option value="" disabled>
          {chosenDay ? "Choose a time..." : "Choose a day first"}
        </option>
        {daySlots.map(({ time, available }) => (
          <option key={time} value={time} disabled={!available}>
            {formatSlot(time)}
            {available ? "" : " — full"}
          </option>
        ))}
      </select>
      <p className="text-sm text-gray-700 bg-[#F5F0E8] p-3 rounded-lg">
        {pickupDetails}
      </p>
      <p className="text-xs text-gray-600">
        Pickup is Monday–Saturday in 30-minute time slots, booked at least a day
        ahead.
      </p>
    </div>
  );
}

// The pickup choice on the info step: a pickup day and half-hour slot.
// The event options (next event, a chosen event) only appear while
// EVENT_PICKUP_ENABLED is on; with one kind of pickup there's nothing to
// choose between, so the radios go away too.
function PickupOptions({
  hasEvents,
  offersScheduled,
  activePickupMode,
  setPickupMode,
  pickupChoiceLost,
  nextEvent,
  events,
  pickupChoice,
  setPickupChoice,
  schedule,
  chosenDay,
  setPickupDay,
  chosenTime,
  setPickupTime,
  pickupDetails,
}) {
  return (
    <fieldset>
      <legend className="block text-xl font-semibold text-[#2A4A52] mb-2">
        {hasEvents ? "Pickup Option" : "Pickup Day & Time"}
      </legend>
      {pickupChoiceLost && (
        <p
          role="alert"
          className="text-sm text-amber-800 bg-amber-50 p-3 rounded-lg mb-3"
        >
          That pickup option isn&rsquo;t available anymore — please choose
          another.
        </p>
      )}
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-4">
        {hasEvents && (
          <>
            <label className="flex items-center gap-3 border border-gray-300 rounded-lg px-4 py-3 min-h-12 cursor-pointer has-checked:border-[#4A7C8A] has-checked:bg-[#F5F0E8]">
              <input
                type="radio"
                name="pickup-mode"
                value="next"
                checked={activePickupMode === "next"}
                onChange={() => setPickupMode("next")}
              />
              <span className="text-sm font-medium">Next Event</span>
            </label>
            <label className="flex items-center gap-3 border border-gray-300 rounded-lg px-4 py-3 min-h-12 cursor-pointer has-checked:border-[#4A7C8A] has-checked:bg-[#F5F0E8]">
              <input
                type="radio"
                name="pickup-mode"
                value="choose"
                checked={activePickupMode === "choose"}
                onChange={() => setPickupMode("choose")}
              />
              <span className="text-sm font-medium">Choose Event</span>
            </label>
          </>
        )}
        {hasEvents && offersScheduled && (
          <label className="flex items-center gap-3 border border-gray-300 rounded-lg px-4 py-3 min-h-12 cursor-pointer has-checked:border-[#4A7C8A] has-checked:bg-[#F5F0E8]">
            <input
              type="radio"
              name="pickup-mode"
              value="scheduled"
              checked={activePickupMode === "scheduled"}
              onChange={() => setPickupMode("scheduled")}
            />
            <span className="text-sm font-medium">Pickup Day &amp; Time</span>
          </label>
        )}
      </div>

      {activePickupMode === "next" ? (
        nextEvent && (
          <p className="text-sm text-gray-700 bg-[#F5F0E8] p-3 rounded-lg mt-3">
            <strong>{nextEvent.title}</strong> — {formatEventDate(nextEvent)}
          </p>
        )
      ) : activePickupMode === "choose" ? (
        <div className="mt-3">
          <label htmlFor="pickup-event" className="sr-only">
            Pickup event
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
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title} — {formatEventDate(event)}
              </option>
            ))}
          </select>
        </div>
      ) : activePickupMode === "scheduled" ? (
        <PickupDayAndTime
          schedule={schedule}
          chosenDay={chosenDay}
          setPickupDay={setPickupDay}
          chosenTime={chosenTime}
          setPickupTime={setPickupTime}
          pickupDetails={pickupDetails}
        />
      ) : null}
    </fieldset>
  );
}

export default function CheckoutPage() {
  const { user } = useAuth();
  const { items, total, clearCart } = useCart();
  const router = useRouter();

  const [step, setStep] = useState(0);
  // Pickup-only launch: every order is collected on a booked pickup day
  // and time slot.
  const [fulfillmentType, setFulfillmentType] = useState(
    SHIPPING_ENABLED ? "shipping" : "pickup"
  );
  // null until the customer picks a radio; then "next" (nearest open
  // event), "choose" (pick from the list) or "scheduled" (a day and slot).
  const [pickupMode, setPickupMode] = useState(null);
  // Event id when pickupMode is "choose".
  const [pickupChoice, setPickupChoice] = useState("");
  const [upcomingEvents, setUpcomingEvents] = useState(null);
  // Scheduled pickup as the server offers it — { enabled, details, days:
  // [{ day, slots: [{ time, available }] }] } — or null while loading.
  // The server decides which days and slots are bookable.
  const [schedule, setSchedule] = useState(null);
  // YYYY-MM-DD when pickupMode is "scheduled".
  const [pickupDay, setPickupDay] = useState("");
  // "HH:MM" start of the slot on that day.
  const [pickupTime, setPickupTime] = useState("");
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
  // Runtime Square config: null while loading, then
  // { appId, locationId } ("" when payments aren't configured).
  const [square, setSquare] = useState(null);
  // "off" (Square not configured) | "loading" | "ready" | "error"
  const [cardStatus, setCardStatus] = useState("loading");
  const cardRef = useRef(null);
  // One-time Square token + display details ("Visa ending in 1111"),
  // captured when the customer continues to review.
  const [payment, setPayment] = useState(null);
  const [agreed, setAgreed] = useState(false);
  // Promo code the customer types, the code actually applied, and the
  // server-computed discount preview.
  const [codeInput, setCodeInput] = useState("");
  const [appliedCode, setAppliedCode] = useState("");
  const [discount, setDiscount] = useState({ discountTotal: 0, applied: [] });
  const [codeError, setCodeError] = useState("");
  const [checkingCode, setCheckingCode] = useState(false);

  useEffect(() => {
    api
      .get("/events?upcoming=true")
      .then((res) => setUpcomingEvents(res.data.events))
      .catch(() => setUpcomingEvents([]));
  }, []);

  // Also called again after a refused order, so a day that just became
  // same-day (store midnight) or a slot that just filled drops out.
  const loadSchedule = useCallback(
    () =>
      api
        .get("/pickup/days")
        .then((res) => setSchedule(res.data))
        .catch(() => setSchedule({ enabled: false, details: "", days: [] })),
    []
  );

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  useEffect(() => {
    getPublicConfig().then((cfg) => {
      setSquare({
        appId: cfg.squareAppId,
        locationId: cfg.squareLocationId,
      });
      if (!cfg.squareAppId) setCardStatus("off");
    });
  }, []);

  // Preview discounts (automatic bundles + any applied code) whenever the
  // cart or applied code changes. The order API recomputes authoritatively.
  useEffect(() => {
    if (items.length === 0) {
      setDiscount({ discountTotal: 0, applied: [] });
      return;
    }
    api
      .post("/promotions/validate", {
        items: items.map(orderLinePayload),
        ...(appliedCode ? { code: appliedCode } : {}),
      })
      .then((res) => {
        setDiscount({
          discountTotal: res.data.discountTotal,
          applied: res.data.applied,
        });
        // A code that stopped being valid (deactivated) clears itself.
        if (appliedCode && res.data.codeError) {
          setCodeError(res.data.codeError);
          setAppliedCode("");
        }
      })
      .catch(() => setDiscount({ discountTotal: 0, applied: [] }));
  }, [items, appliedCode]);

  const applyCode = async () => {
    const code = codeInput.trim();
    if (!code) return;
    setCodeError("");
    setCheckingCode(true);
    try {
      const res = await api.post("/promotions/validate", {
        items: items.map(orderLinePayload),
        code,
      });
      if (res.data.codeError) {
        setCodeError(res.data.codeError);
        setAppliedCode("");
      } else {
        setAppliedCode(code);
        setDiscount({
          discountTotal: res.data.discountTotal,
          applied: res.data.applied,
        });
      }
    } catch {
      setCodeError("Couldn't check that code — please try again.");
    } finally {
      setCheckingCode(false);
    }
  };

  const removeCode = () => {
    setAppliedCode("");
    setCodeInput("");
    setCodeError("");
  };

  // Mount the Square card form on the info step; the iframe keeps card
  // details inside Square — they never touch our servers.
  useEffect(() => {
    if (step !== 0 || !square?.appId) return undefined;
    let cancelled = false;
    let cardInstance;
    (async () => {
      try {
        const Square = await loadSquareSdk(square.appId);
        const payments = square.locationId
          ? Square.payments(square.appId, square.locationId)
          : Square.payments(square.appId);
        cardInstance = await payments.card();
        if (cancelled) {
          cardInstance.destroy();
          return;
        }
        await cardInstance.attach("#card-container");
        cardRef.current = cardInstance;
        setCardStatus("ready");
      } catch (err) {
        console.error("[checkout] Square init failed:", err);
        if (!cancelled) setCardStatus("error");
      }
    })();
    return () => {
      cancelled = true;
      cardRef.current = null;
      cardInstance?.destroy();
    };
  }, [step, square]);

  // No same-day pickup (shared rule with the orders API). "Next Event"
  // is the nearest event still open for pickup.
  const events = EVENT_PICKUP_ENABLED
    ? (upcomingEvents ?? []).filter((e) => isPickupSelectable(e))
    : [];
  const hasEvents = events.length > 0;
  const nextEvent = events[0] ?? null;
  const offersScheduled =
    Boolean(schedule?.enabled) && (schedule?.days.length ?? 0) > 0;
  const canPickup = hasEvents || offersScheduled;
  const pickupOptionsLoaded = upcomingEvents !== null && schedule !== null;
  const isOffered = (mode) =>
    mode === "scheduled" ? offersScheduled : hasEvents;
  // An explicit pick is never swapped for another kind of pickup behind
  // the customer's back: if it stops being offered (the owner switched
  // pickup off, the last event passed), nothing is selected and
  // they choose again. Before they pick, events come first.
  const activePickupMode =
    pickupMode === null
      ? hasEvents
        ? "next"
        : offersScheduled
          ? "scheduled"
          : null
      : isOffered(pickupMode)
        ? pickupMode
        : null;
  const pickupChoiceLost =
    pickupMode !== null && activePickupMode === null && canPickup;
  const chosenEvent =
    activePickupMode === "next"
      ? nextEvent
      : activePickupMode === "choose"
        ? events.find((e) => e.id === pickupChoice)
        : undefined;
  // A day or slot that stopped being bookable (filled up, got closed)
  // reads as not chosen, so the customer has to pick again.
  const dayEntry =
    activePickupMode === "scheduled"
      ? schedule.days.find((d) => d.day === pickupDay)
      : undefined;
  const chosenDay = dayEntry?.slots.some((slot) => slot.available)
    ? pickupDay
    : "";
  const chosenTime =
    chosenDay &&
    dayEntry.slots.some((slot) => slot.time === pickupTime && slot.available)
      ? pickupTime
      : "";
  const pickupReady =
    activePickupMode === "scheduled" ? chosenTime !== "" : Boolean(chosenEvent);
  const pickupDetails = schedule?.details || PICKUP_FALLBACK;
  // True only when today's own event is the thing missing from the list
  // above, so the note doesn't show for an ordinary quiet week.
  const hasSameDayEvent =
    EVENT_PICKUP_ENABLED &&
    (upcomingEvents ?? []).some((e) => eventDayKey(e) === dayKeyOf());

  // Guest orders finish here (guests have no orders page), so show the
  // confirmation inline after the cart has been cleared.
  if (confirmation) {
    return (
      <div className="max-w-4xl mx-auto safe-x py-20 text-center">
        <h1 className="text-3xl font-bold text-[#2A4A52] mb-4">
          Thank You for Your Order!
        </h1>
        <p className="text-gray-600 mb-2">Your confirmation number is</p>
        <p className="text-2xl font-bold text-[#8A4D1A] mb-6">
          {confirmation.number}
        </p>
        {confirmation.pickupDate ? (
          <div className="text-gray-600 mb-8 space-y-2">
            <p>
              We&rsquo;ll have your order ready for pickup on{" "}
              {formatPickupDay(confirmation.pickupDate)}
              {confirmation.pickupTime &&
                `, ${formatSlot(confirmation.pickupTime)}`}{" "}
              — bring your confirmation number.
            </p>
            <p>{pickupDetails}</p>
          </div>
        ) : (
          <p className="text-gray-600 mb-8">
            {confirmation.event
              ? `We'll have your order ready at ${confirmation.event.title} on ${formatEventDate(confirmation.event)} — just give us your confirmation number at the booth.`
              : "Keep this number for your records — you'll need it if you contact us about your order."}
          </p>
        )}
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
        <p className="text-gray-600 mb-6">Your cart is empty.</p>
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

  // Continuing to review tokenizes the card (nothing is charged yet) so
  // the review step can show which card will be used.
  const handleContinue = async (e) => {
    e.preventDefault();
    setError("");

    if (square?.appId) {
      if (!cardRef.current) {
        setError(
          "The payment form isn't ready yet — give it a second and try again."
        );
        return;
      }
      setSubmitting(true);
      try {
        const result = await cardRef.current.tokenize();
        if (result.status !== "OK") {
          // Surface Square's own message — config problems (wrong
          // environment, mismatched location id) are only diagnosable
          // from it.
          console.error("[checkout] tokenize failed:", result.errors);
          setError(
            result.errors?.map((e) => e.message).join(" ") ||
              "Please check your card details and try again."
          );
          return;
        }
        setPayment({
          token: result.token,
          card: result.details?.card ?? null,
        });
      } catch (err) {
        console.error("[checkout] tokenize threw:", err);
        setError(
          err?.message
            ? `Payment form error: ${err.message}`
            : "Please check your card details and try again."
        );
        return;
      } finally {
        setSubmitting(false);
      }
    }

    // The pickup shown by default becomes the customer's explicit pick, so
    // nothing on the review step can quietly change it.
    setPickupMode(activePickupMode);
    setStep(1);
    window.scrollTo({ top: 0 });
  };

  // Back to the info step: Square tokens are single-use, so drop the old
  // one — continuing again re-tokenizes the card.
  const handleBack = () => {
    setPayment(null);
    if (square?.appId) setCardStatus("loading");
    setStep(0);
    window.scrollTo({ top: 0 });
  };

  // Send the stored one-time token with the order payload; the server
  // charges the verified total.
  const handleProcessPayment = async () => {
    setError("");
    setSubmitting(true);
    const paymentToken = payment?.token;

    try {
      const res = await api.post("/orders", {
        items: items.map(orderLinePayload),
        fulfillmentType,
        ...(fulfillmentType === "shipping"
          ? {
              address: form.address,
              city: form.city,
              state: form.state,
              zip: form.zip,
            }
          : activePickupMode === "scheduled"
            ? { pickupDate: chosenDay, pickupTime: chosenTime }
            : {
                pickupEventId:
                  activePickupMode === "next" ? "next" : pickupChoice,
              }),
        ...(user
          ? {}
          : { guestEmail: form.guestEmail, guestName: form.guestName }),
        ...(paymentToken ? { paymentToken } : {}),
        ...(appliedCode ? { promoCode: appliedCode } : {}),
      });
      clearCart();
      if (user) {
        router.push("/orders");
      } else {
        setConfirmation({
          number: res.data.order.confirmationNumber,
          event: res.data.order.pickupEvent,
          pickupDate: res.data.order.pickupDate,
          pickupTime: res.data.order.pickupTime,
        });
      }
    } catch (err) {
      setError(
        err.response?.data?.error || "Failed to place order. Please try again."
      );
      setSubmitting(false);
      // A refused day or slot has usually just filled up, become same-day
      // (store midnight) or been closed — refresh so it drops out.
      if (err.response?.status === 409 && activePickupMode === "scheduled") {
        loadSchedule();
      }
      // A declined charge consumes the one-time token — back to the info
      // step so the customer can re-enter or change the card.
      if (err.response?.status === 402) {
        setPayment(null);
        if (square?.appId) setCardStatus("loading");
        setStep(0);
        window.scrollTo({ top: 0 });
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto safe-x py-6 sm:py-10">
      <h1 className="text-2xl sm:text-3xl font-bold text-[#2A4A52] mb-4">
        Checkout
      </h1>
      <Stepper step={step} />

      {error && (
        <p
          role="alert"
          className="text-red-700 text-sm bg-red-50 p-3 rounded-lg mb-6"
        >
          {error}
        </p>
      )}

      {step === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          <form
            onSubmit={handleContinue}
            className="space-y-4 order-2 md:order-1"
          >
            {!user && (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-[#2A4A52]">
                    Guest Checkout
                  </h2>
                  <Link
                    href="/login"
                    className="text-sm text-[#3A6270] font-medium hover:underline"
                  >
                    Have an account? Log in
                  </Link>
                </div>
                <div>
                  <label
                    htmlFor="guest-name"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
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
                  <label
                    htmlFor="guest-email"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
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

            {SHIPPING_ENABLED ? (
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
                      canPickup
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
                      disabled={!canPickup}
                    />
                    <span className="text-sm font-medium">
                      Pickup
                      {pickupOptionsLoaded && !canPickup && (
                        <span className="block text-xs text-gray-600 font-normal">
                          No pickup options available right now
                        </span>
                      )}
                    </span>
                  </label>
                </div>
              </fieldset>
            ) : (
              <div>
                <h2 className="text-xl font-semibold text-[#2A4A52] mb-2">
                  Delivery Method
                </h2>
                {pickupOptionsLoaded && !canPickup ? (
                  <p className="text-sm text-amber-800 bg-amber-50 p-3 rounded-lg">
                    Online orders are collected by scheduled pickup, and there
                    are no pickup times open right now. Please check back soon!
                  </p>
                ) : (
                  <p className="text-sm text-gray-600 bg-[#F5F0E8] p-3 rounded-lg">
                    All online orders are collected by pickup — choose the day
                    and 30-minute time slot that work best for you below.
                  </p>
                )}
              </div>
            )}

            {hasSameDayEvent && (
              <p className="text-sm text-amber-800 bg-amber-50 p-3 rounded-lg">
                Same-day pickup isn’t available. Reserve by the day before an
                event.
              </p>
            )}

            {fulfillmentType === "shipping" ? (
              <>
                <h2 className="text-xl font-semibold text-[#2A4A52]">
                  Shipping Address
                </h2>
                <div>
                  <label
                    htmlFor="address"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
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
                  <label
                    htmlFor="city"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
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
                    <label
                      htmlFor="state"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
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
                    <label
                      htmlFor="zip"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
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
            ) : canPickup ? (
              <PickupOptions
                hasEvents={hasEvents}
                offersScheduled={offersScheduled}
                activePickupMode={activePickupMode}
                setPickupMode={setPickupMode}
                pickupChoiceLost={pickupChoiceLost}
                nextEvent={nextEvent}
                events={events}
                pickupChoice={pickupChoice}
                setPickupChoice={setPickupChoice}
                schedule={schedule}
                chosenDay={chosenDay}
                setPickupDay={setPickupDay}
                chosenTime={chosenTime}
                setPickupTime={setPickupTime}
                pickupDetails={pickupDetails}
              />
            ) : null}

            {square?.appId && (
              <div>
                <h2 className="text-xl font-semibold text-[#2A4A52] mb-2">
                  Payment
                </h2>
                {cardStatus === "error" ? (
                  <p
                    role="alert"
                    className="text-red-700 text-sm bg-red-50 p-3 rounded-lg"
                  >
                    The payment form couldn&rsquo;t be loaded. Please refresh
                    the page and try again.
                  </p>
                ) : (
                  <>
                    {cardStatus === "loading" && (
                      <p className="text-sm text-gray-600 mb-2">
                        Loading secure payment form...
                      </p>
                    )}
                    <div id="card-container" />
                    <p className="text-xs text-gray-600 mt-1">
                      Payments are processed securely by Square — your card
                      details never touch our servers. Nothing is charged until
                      you confirm on the next step.
                    </p>
                  </>
                )}
              </div>
            )}

            <label className="flex items-start gap-3 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                required
                className="mt-1 h-4 w-4 shrink-0 accent-[#4A7C8A]"
              />
              <span>
                I have read and agree to the{" "}
                <Link
                  href="/privacy"
                  target="_blank"
                  className="text-[#3A6270] underline hover:text-[#2A4A52]"
                >
                  Privacy Policy
                </Link>{" "}
                and{" "}
                <Link
                  href="/terms"
                  target="_blank"
                  className="text-[#3A6270] underline hover:text-[#2A4A52]"
                >
                  Terms of Service
                </Link>
                .
              </span>
            </label>

            <button
              type="submit"
              disabled={
                submitting ||
                (fulfillmentType === "pickup" && activePickupMode === null) ||
                // Config still resolving, or card form not ready yet —
                // never let an order slip past a configured card form.
                square === null ||
                (Boolean(square.appId) && cardStatus !== "ready")
              }
              className="w-full bg-[#4A7C8A] hover:bg-[#3A6270] active:bg-[#2A4A52] text-white py-3 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Checking card…" : "Continue to Review"}
            </button>
          </form>

          <div className="order-1 md:order-2 md:self-start space-y-4">
            <OrderSummary
              items={items}
              subtotal={total}
              discount={discount.discountTotal}
              applied={discount.applied}
            />
            {/* Promo code */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <label
                htmlFor="promo-code"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Promo code
              </label>
              {appliedCode ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-green-700 font-medium">
                    {appliedCode} applied
                  </span>
                  <button
                    type="button"
                    onClick={removeCode}
                    className="text-sm text-[#3A6270] underline hover:text-[#2A4A52]"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    id="promo-code"
                    type="text"
                    value={codeInput}
                    onChange={(e) => setCodeInput(e.target.value)}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 min-h-11 uppercase"
                  />
                  <button
                    type="button"
                    onClick={applyCode}
                    disabled={checkingCode || !codeInput.trim()}
                    className="shrink-0 bg-[#4A7C8A] hover:bg-[#3A6270] text-white px-4 rounded-lg font-semibold transition disabled:opacity-50"
                  >
                    {checkingCode ? "…" : "Apply"}
                  </button>
                </div>
              )}
              {codeError && (
                <p role="alert" className="text-red-700 text-sm mt-2">
                  {codeError}
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6 max-w-2xl">
          <OrderSummary
            items={items}
            subtotal={total}
            discount={discount.discountTotal}
            applied={discount.applied}
          />

          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 space-y-4">
            <h2 className="text-xl font-semibold text-[#2A4A52]">
              Review Your Information
            </h2>

            <div>
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
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
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                Delivery
              </h3>
              {fulfillmentType === "shipping" ? (
                <p className="text-[#2A4A52] mt-1">
                  Ship to: {form.address}, {form.city}, {form.state} {form.zip}
                </p>
              ) : activePickupMode === "scheduled" && chosenTime ? (
                <div className="text-[#2A4A52] mt-1">
                  <p className="font-medium">Pickup</p>
                  <p className="text-sm text-gray-600">
                    {formatPickupDay(chosenDay)} · {formatSlot(chosenTime)}
                  </p>
                  <p className="text-sm text-gray-600">{pickupDetails}</p>
                </div>
              ) : chosenEvent ? (
                <div className="text-[#2A4A52] mt-1">
                  <p className="font-medium">
                    Pickup at {chosenEvent.title}
                    {activePickupMode === "next" && " (Next Event)"}
                  </p>
                  <p className="text-sm text-gray-600">
                    {formatEventDate(chosenEvent)}
                    {formatTimeRange(chosenEvent) && (
                      <> · {formatTimeRange(chosenEvent)}</>
                    )}
                    {chosenEvent.location && <> · {chosenEvent.location}</>}
                  </p>
                </div>
              ) : (
                <p className="text-red-700 mt-1">No pickup option selected.</p>
              )}
            </div>

            {payment && (
              <div>
                <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                  Payment
                </h3>
                <p className="text-[#2A4A52] mt-1">
                  {payment.card
                    ? `${payment.card.brand ?? "Card"} ending in ${payment.card.last4 ?? "····"}`
                    : "Card ready — charged when you confirm below"}
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleBack}
              className="sm:flex-1 border-2 border-[#4A7C8A] text-[#3A6270] py-3 rounded-lg font-semibold hover:bg-[#4A7C8A] hover:text-white active:bg-[#3A6270] transition"
            >
              Back
            </button>
            <button
              onClick={handleProcessPayment}
              disabled={
                submitting ||
                (fulfillmentType === "pickup" && !pickupReady) ||
                (Boolean(square?.appId) && !payment)
              }
              className="sm:flex-[2] bg-[#A85D1F] hover:bg-[#8A4D1A] active:bg-[#8A4D1A] text-white py-3 rounded-lg font-semibold transition disabled:opacity-50"
            >
              {submitting
                ? "Processing…"
                : `Process Payment — $${Math.max(0, total - discount.discountTotal).toFixed(2)}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
