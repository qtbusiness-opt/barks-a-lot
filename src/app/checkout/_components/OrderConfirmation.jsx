import Link from "next/link";
import { formatPickupDay } from "@/lib/format-date";
import { formatSlot } from "@/lib/pickup-window";
import { formatEventDate } from "./checkout-ui";

// Guest orders finish here (guests have no orders page), so the page
// shows this inline after the cart has been cleared.
export default function OrderConfirmation({ confirmation, pickupDetails }) {
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
