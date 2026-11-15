import ReviewDetails from "./ReviewDetails";

// Step 2 of checkout: read everything back, then charge. `details` is
// spread into <ReviewDetails>; the page owns the payment handler and
// decides when the button is enabled.
export default function ReviewStep({
  orderSummary,
  details,
  onBack,
  onPay,
  payDisabled,
  submitting,
  amountDue,
}) {
  return (
    <div className="space-y-6 max-w-2xl">
      {orderSummary}

      <ReviewDetails {...details} />

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={onBack}
          className="sm:flex-1 border-2 border-[#4A7C8A] text-[#3A6270] py-3 rounded-lg font-semibold hover:bg-[#4A7C8A] hover:text-white active:bg-[#3A6270] transition"
        >
          Back
        </button>
        <button
          onClick={onPay}
          disabled={payDisabled}
          className="sm:flex-[2] bg-[#A85D1F] hover:bg-[#8A4D1A] active:bg-[#8A4D1A] text-white py-3 rounded-lg font-semibold transition disabled:opacity-50"
        >
          {submitting
            ? "Processing…"
            : `Process Payment — $${amountDue.toFixed(2)}`}
        </button>
      </div>
    </div>
  );
}
