"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import api from "@/lib/api";
import { SHIPPING_ENABLED } from "@/lib/features";
import { tokenizeCard } from "./_lib/square-sdk";
import { buildOrderPayload } from "./_lib/order-payload";
import {
  resolvePickupSelection,
  isContinueBlocked,
  isPaymentBlocked,
} from "./_lib/pickup-selection";
import { usePickupData } from "./_hooks/usePickupData";
import { usePromotions } from "./_hooks/usePromotions";
import { useSquareCard } from "./_hooks/useSquareCard";
import Stepper from "./_components/Stepper";
import OrderSummary from "./_components/OrderSummary";
import OrderConfirmation from "./_components/OrderConfirmation";
import EmptyCart from "./_components/EmptyCart";
import InfoStep from "./_components/InfoStep";
import ReviewStep from "./_components/ReviewStep";

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
  // One-time Square token + display details ("Visa ending in 1111"),
  // captured when the customer continues to review.
  const [payment, setPayment] = useState(null);
  const [agreed, setAgreed] = useState(false);

  const {
    events,
    hasSameDayEvent,
    schedule,
    pickupOptionsLoaded,
    pickupDetails,
    reloadSchedule,
  } = usePickupData();
  const promo = usePromotions(items);
  const { appliedCode, discount } = promo;
  const { square, cardStatus, cardRef, markCardReloading } = useSquareCard(
    step === 0
  );

  const {
    hasEvents,
    nextEvent,
    offersScheduled,
    canPickup,
    activePickupMode,
    pickupChoiceLost,
    chosenEvent,
    chosenDay,
    chosenTime,
    pickupReady,
  } = resolvePickupSelection({
    events,
    schedule,
    pickupMode,
    pickupChoice,
    pickupDay,
    pickupTime,
  });

  if (confirmation) {
    return (
      <OrderConfirmation
        confirmation={confirmation}
        pickupDetails={pickupDetails}
      />
    );
  }

  if (items.length === 0) return <EmptyCart />;

  const update = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // Square tokens are single-use, so any trip back to the info step drops
  // the old one — continuing again re-tokenizes the card.
  const returnToInfoStep = () => {
    setPayment(null);
    markCardReloading();
    setStep(0);
    window.scrollTo({ top: 0 });
  };

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
      const tokenized = await tokenizeCard(cardRef.current);
      setSubmitting(false);
      if (tokenized.error) {
        setError(tokenized.error);
        return;
      }
      setPayment(tokenized.payment);
    }

    // The pickup shown by default becomes the customer's explicit pick, so
    // nothing on the review step can quietly change it.
    setPickupMode(activePickupMode);
    setStep(1);
    window.scrollTo({ top: 0 });
  };

  // Send the stored one-time token with the order payload; the server
  // charges the verified total.
  const handleProcessPayment = async () => {
    setError("");
    setSubmitting(true);

    try {
      const res = await api.post(
        "/orders",
        buildOrderPayload({
          items,
          fulfillmentType,
          form,
          activePickupMode,
          chosenDay,
          chosenTime,
          pickupChoice,
          isSignedIn: Boolean(user),
          paymentToken: payment?.token,
          appliedCode,
        })
      );
      clearCart();
      if (user) {
        router.push("/orders");
      } else {
        // Guest orders finish here (guests have no orders page).
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
        reloadSchedule();
      }
      // A declined charge consumes the one-time token — back to the info
      // step so the customer can re-enter or change the card.
      if (err.response?.status === 402) returnToInfoStep();
    }
  };

  const orderSummary = (
    <OrderSummary
      items={items}
      subtotal={total}
      discount={discount.discountTotal}
      applied={discount.applied}
    />
  );

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
        <InfoStep
          user={user}
          form={form}
          update={update}
          fulfillmentType={fulfillmentType}
          setFulfillmentType={setFulfillmentType}
          canPickup={canPickup}
          pickupOptionsLoaded={pickupOptionsLoaded}
          hasSameDayEvent={hasSameDayEvent}
          pickup={{
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
          }}
          showCardForm={Boolean(square?.appId)}
          cardStatus={cardStatus}
          agreed={agreed}
          setAgreed={setAgreed}
          onSubmit={handleContinue}
          continueDisabled={isContinueBlocked({
            submitting,
            fulfillmentType,
            activePickupMode,
            square,
            cardStatus,
          })}
          submitting={submitting}
          orderSummary={orderSummary}
          promo={{
            appliedCode,
            codeInput: promo.codeInput,
            setCodeInput: promo.setCodeInput,
            onApply: promo.applyCode,
            onRemove: promo.removeCode,
            checkingCode: promo.checkingCode,
            codeError: promo.codeError,
          }}
        />
      ) : (
        <ReviewStep
          orderSummary={orderSummary}
          details={{
            user,
            form,
            payment,
            fulfillmentType,
            activePickupMode,
            chosenDay,
            chosenTime,
            chosenEvent,
            pickupDetails,
          }}
          onBack={returnToInfoStep}
          onPay={handleProcessPayment}
          payDisabled={isPaymentBlocked({
            submitting,
            fulfillmentType,
            pickupReady,
            square,
            payment,
          })}
          submitting={submitting}
          amountDue={Math.max(0, total - discount.discountTotal)}
        />
      )}
    </div>
  );
}
