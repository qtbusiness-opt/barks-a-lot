const QUANTITIES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// Why the button can't be pressed, checked in the order a customer would
// want to hear it: the product itself first, then their picks, then stock.
function buttonLabel({ available, missingGroup, purchasable }) {
  if (!available) return "Not Available";
  if (missingGroup) return "Choose an Option";
  if (!purchasable) return "Out of Stock";
  return "Add to Cart";
}

// Quantity picker and the Add to Cart button. Rendered as siblings (no
// wrapper) so the page's spacing between them is unchanged.
export default function PurchaseControls({
  qty,
  onQtyChange,
  onAdd,
  available,
  missingGroup,
  purchasable,
}) {
  return (
    <>
      <div className="mt-6 flex items-center gap-4">
        <label htmlFor="qty" className="text-sm font-medium text-brand-ink">
          Qty:
        </label>
        <select
          id="qty"
          value={qty}
          onChange={(e) => onQtyChange(Number(e.target.value))}
          className="border border-brand-teal rounded-lg px-3 py-2 min-h-11 text-base sm:text-sm bg-white text-brand-ink"
        >
          {QUANTITIES.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={onAdd}
        disabled={!purchasable}
        className={`mt-6 w-full sm:w-auto whitespace-nowrap px-8 py-3 rounded-full font-semibold transition-colors duration-(--dur-micro) ease-(--ease-out) ${
          purchasable
            ? "bg-brand-accent-strong text-brand-on hover:bg-brand-accent-deep"
            : "bg-brand-paper-3 text-brand-ink-2 cursor-not-allowed"
        }`}
      >
        {buttonLabel({ available, missingGroup, purchasable })}
      </button>
    </>
  );
}
