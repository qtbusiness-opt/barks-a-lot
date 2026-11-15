import { SHIPPING_ENABLED } from "@/lib/features";

// With shipping on, the customer chooses ship vs pickup. In the
// pickup-only launch there's nothing to choose, so this just explains how
// online orders are collected (or that no pickup times are open).
export default function DeliveryMethod({
  fulfillmentType,
  setFulfillmentType,
  canPickup,
  pickupOptionsLoaded,
}) {
  if (!SHIPPING_ENABLED) {
    return (
      <div>
        <h2 className="text-xl font-semibold text-[#2A4A52] mb-2">
          Delivery Method
        </h2>
        {pickupOptionsLoaded && !canPickup ? (
          <p className="text-sm text-amber-800 bg-amber-50 p-3 rounded-lg">
            Online orders are collected by scheduled pickup, and there are no
            pickup times open right now. Please check back soon!
          </p>
        ) : (
          <p className="text-sm text-gray-600 bg-[#F5F0E8] p-3 rounded-lg">
            All online orders are collected by pickup — choose the day and
            30-minute time slot that work best for you below.
          </p>
        )}
      </div>
    );
  }
  return (
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
  );
}
