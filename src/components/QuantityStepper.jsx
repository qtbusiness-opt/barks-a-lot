"use client";

/**
 * A minus/plus quantity control for a product that isn't in the cart yet.
 *
 * Sized for the two-up phone product grid, where a card is only ~150px
 * wide: full width there with the buttons pushed to the outer edges, so
 * both stay a 44px tap target, and compact from sm up. The count is a
 * live region rather than a text field for the same reason — an input
 * narrow enough to fit is too small to type into.
 *
 * @param {number} value        current quantity
 * @param {(n: number) => void} onChange
 * @param {string} label        names the group, e.g. "Quantity of Biscuits"
 * @param {number} [min=1]
 * @param {number} [max=10]     matches the product page's Qty dropdown
 * @param {boolean} [disabled]
 */
export default function QuantityStepper({
  value,
  onChange,
  label,
  min = 1,
  max = 10,
  disabled = false,
}) {
  const step = (delta) => onChange(Math.min(max, Math.max(min, value + delta)));

  const buttonClass =
    "w-11 h-11 sm:w-8 sm:h-8 shrink-0 rounded-full border border-gray-300 " +
    "flex items-center justify-center text-lg sm:text-base leading-none " +
    "text-[#2A4A52] hover:bg-gray-100 active:bg-gray-200 " +
    "disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div
      role="group"
      aria-label={label}
      className="flex items-center justify-between gap-1 w-full sm:w-auto sm:justify-center"
    >
      <button
        type="button"
        onClick={() => step(-1)}
        disabled={disabled || value <= min}
        aria-label="Decrease quantity"
        className={buttonClass}
      >
        −
      </button>
      {/* Announced on change, so a screen reader user hears the new count
          without having to move focus off the button they just pressed. */}
      <span
        aria-live="polite"
        aria-atomic="true"
        className="min-w-8 text-center font-medium tabular-nums text-[#2A4A52]"
      >
        {value}
      </span>
      <button
        type="button"
        onClick={() => step(1)}
        disabled={disabled || value >= max}
        aria-label="Increase quantity"
        className={buttonClass}
      >
        +
      </button>
    </div>
  );
}
