import DeliveryMethod from "./DeliveryMethod";
import GuestContactFields from "./GuestContactFields";
import ShippingAddressFields from "./ShippingAddressFields";
import PickupOptions from "./PickupOptions";
import CardPaymentSection from "./CardPaymentSection";
import TermsAgreement from "./TermsAgreement";
import PromoCodeBox from "./PromoCodeBox";

// Step 1 of checkout: contact, delivery, card and terms, beside the order
// summary and promo code. The page owns every piece of state and the
// submit handler; `pickup` is spread straight into <PickupOptions> and
// `promo` into <PromoCodeBox>.
export default function InfoStep({
  user,
  form,
  update,
  fulfillmentType,
  setFulfillmentType,
  canPickup,
  pickupOptionsLoaded,
  hasSameDayEvent,
  pickup,
  showCardForm,
  cardStatus,
  agreed,
  setAgreed,
  onSubmit,
  continueDisabled,
  submitting,
  orderSummary,
  promo,
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
      <form onSubmit={onSubmit} className="space-y-4 order-2 md:order-1">
        {!user && <GuestContactFields form={form} update={update} />}

        <DeliveryMethod
          fulfillmentType={fulfillmentType}
          setFulfillmentType={setFulfillmentType}
          canPickup={canPickup}
          pickupOptionsLoaded={pickupOptionsLoaded}
        />

        {hasSameDayEvent && (
          <p className="text-sm text-amber-800 bg-amber-50 p-3 rounded-lg">
            Same-day pickup isn’t available. Reserve by the day before an event.
          </p>
        )}

        {fulfillmentType === "shipping" ? (
          <ShippingAddressFields form={form} update={update} />
        ) : canPickup ? (
          <PickupOptions {...pickup} />
        ) : null}

        {showCardForm && <CardPaymentSection cardStatus={cardStatus} />}

        <TermsAgreement agreed={agreed} setAgreed={setAgreed} />

        <button
          type="submit"
          disabled={continueDisabled}
          className="w-full bg-[#4A7C8A] hover:bg-[#3A6270] active:bg-[#2A4A52] text-white py-3 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Checking card…" : "Continue to Review"}
        </button>
      </form>

      <div className="order-1 md:order-2 md:self-start space-y-4">
        {orderSummary}
        <PromoCodeBox {...promo} />
      </div>
    </div>
  );
}
