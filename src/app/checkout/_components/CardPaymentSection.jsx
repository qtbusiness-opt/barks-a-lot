// Holds the #card-container the page mounts Square's card iframe into
// (see ../_hooks/useSquareCard.js), so the id must stay as is.
// `cardStatus` is "loading" | "ready" | "error".
export default function CardPaymentSection({ cardStatus }) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-[#2A4A52] mb-2">Payment</h2>
      {cardStatus === "error" ? (
        <p
          role="alert"
          className="text-red-700 text-sm bg-red-50 p-3 rounded-lg"
        >
          The payment form couldn&rsquo;t be loaded. Please refresh the page and
          try again.
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
            Payments are processed securely by Square — your card details never
            touch our servers. Nothing is charged until you confirm on the next
            step.
          </p>
        </>
      )}
    </div>
  );
}
