// The promo code entry beside the order summary. The page owns the code
// state and the server check; this only renders it.
export default function PromoCodeBox({
  appliedCode,
  codeInput,
  setCodeInput,
  onApply,
  onRemove,
  checkingCode,
  codeError,
}) {
  return (
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
            onClick={onRemove}
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
            onClick={onApply}
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
  );
}
