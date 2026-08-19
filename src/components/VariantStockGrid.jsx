"use client";

const inputClass =
  "w-24 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#4A7C8A]";

// One quantity input per stock combination (e.g. "Medium / Plaid"),
// generated server-side from the option groups above and only available
// once the product has been saved at least once with them — a brand new
// group or choice has no combination to set stock on until then.
export default function VariantStockGrid({ variants, stock, onChange }) {
  if (variants.length === 0) return null;

  return (
    <fieldset>
      <legend className="block text-sm font-medium text-gray-700 mb-1">
        Stock by option
      </legend>
      <p className="text-xs text-gray-500 mb-2">
        Added or removed choices show up here after you save once.
      </p>
      <div className="space-y-2">
        {variants.map((v) => (
          <div
            key={v.id}
            className="flex items-center justify-between gap-3 border border-gray-200 rounded-lg px-3 py-2"
          >
            <span className="text-sm text-[#2A4A52]">{v.name}</span>
            <input
              type="number"
              min="0"
              step="1"
              value={stock[v.id] ?? v.quantity}
              onChange={(e) => onChange(v.id, e.target.value)}
              aria-label={`Quantity in stock for ${v.name}`}
              className={inputClass}
            />
          </div>
        ))}
      </div>
    </fieldset>
  );
}
