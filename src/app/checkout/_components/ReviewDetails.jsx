import { formatPickupDay } from "@/lib/format-date";
import { formatSlot, formatTimeRange } from "@/lib/pickup-window";
import { formatEventDate } from "./checkout-ui";

function DeliverySummary({
  fulfillmentType,
  form,
  activePickupMode,
  chosenDay,
  chosenTime,
  chosenEvent,
  pickupDetails,
}) {
  if (fulfillmentType === "shipping") {
    return (
      <p className="text-[#2A4A52] mt-1">
        Ship to: {form.address}, {form.city}, {form.state} {form.zip}
      </p>
    );
  }
  if (activePickupMode === "scheduled" && chosenTime) {
    return (
      <div className="text-[#2A4A52] mt-1">
        <p className="font-medium">Pickup</p>
        <p className="text-sm text-gray-600">
          {formatPickupDay(chosenDay)} · {formatSlot(chosenTime)}
        </p>
        <p className="text-sm text-gray-600">{pickupDetails}</p>
      </div>
    );
  }
  if (chosenEvent) {
    const timeRange = formatTimeRange(chosenEvent);
    return (
      <div className="text-[#2A4A52] mt-1">
        <p className="font-medium">
          Pickup at {chosenEvent.title}
          {activePickupMode === "next" && " (Next Event)"}
        </p>
        <p className="text-sm text-gray-600">
          {formatEventDate(chosenEvent)}
          {timeRange && <> · {timeRange}</>}
          {chosenEvent.location && <> · {chosenEvent.location}</>}
        </p>
      </div>
    );
  }
  return <p className="text-red-700 mt-1">No pickup option selected.</p>;
}

// The review step's read-back of contact, delivery and card, so the
// customer can check everything before the charge.
export default function ReviewDetails({
  user,
  form,
  payment,
  fulfillmentType,
  activePickupMode,
  chosenDay,
  chosenTime,
  chosenEvent,
  pickupDetails,
}) {
  return (
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
        <DeliverySummary
          fulfillmentType={fulfillmentType}
          form={form}
          activePickupMode={activePickupMode}
          chosenDay={chosenDay}
          chosenTime={chosenTime}
          chosenEvent={chosenEvent}
          pickupDetails={pickupDetails}
        />
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
  );
}
