import { CheckIcon, CrossIcon } from "@/components/Icons";

// The price beside a yes/no availability line. Exact counts stay on the
// admin side; the storefront only says whether it can be bought.
export default function PriceAndStock({ price, inStock, available }) {
  let stockLabel = "Out of Stock";
  if (!available) stockLabel = "Not currently available";
  else if (inStock) stockLabel = "In Stock";

  return (
    <p className="text-xl sm:text-2xl font-bold mt-4 justify-between flex items-center gap-4">
      <span className="text-[#8A4D1A]">${price.toFixed(2)}</span>
      <span
        className={`flex items-center gap-1 text-sm font-semibold ${
          inStock ? "text-brand-success" : "text-brand-error"
        }`}
      >
        {inStock ? (
          <CheckIcon className="h-4 w-4 shrink-0" />
        ) : (
          <CrossIcon className="h-4 w-4 shrink-0" />
        )}
        {stockLabel}
      </span>
    </p>
  );
}
