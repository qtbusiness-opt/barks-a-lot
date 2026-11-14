"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import StoreImage from "@/components/StoreImage";
import QuantityStepper from "@/components/QuantityStepper";
import { CheckIcon, CrossIcon } from "@/components/Icons";

export default function ProductCard({
  id,
  slug,
  name,
  price,
  image,
  category,
  inStock: productInStock = true,
  variants = [],
  optionGroups = [],
  trackOptionStock = false,
  limitedQuantity = null,
}) {
  const { addItem } = useCart();
  // How many to quick-add. Resets after each add so the next card visit
  // starts from 1 rather than inheriting the last order's count.
  const [qty, setQty] = useState(1);

  // Anything the customer must choose before a price or an "add to
  // cart" makes sense routes to the detail page instead of quick-adding.
  // Checking variants alone used to miss option groups entirely — a
  // product with a required group but no variants would quick-add with
  // no options at all, then fail at checkout with nothing on the cart
  // page able to fix it.
  const needsSelection =
    variants.length > 0 || optionGroups.length > 0 || trackOptionStock;

  // The public API exposes availability as booleans only — exact stock
  // counts are admin-side business data.
  const inStock = trackOptionStock
    ? variants.some((v) => v.inStock)
    : variants.length > 0
      ? variants.some((v) => v.inStock)
      : productInStock;
  const prices = trackOptionStock
    ? (optionGroups.find((g) => g.setsPrice)?.choices ?? [])
        .map((c) => c.price)
        .filter((p) => p != null)
    : variants.length > 0
      ? variants.map((v) => v.price ?? price)
      : [price];
  const minPrice = prices.length > 0 ? Math.min(...prices) : price;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : price;
  const href = `/products/${slug ?? id}`;

  return (
    // One container signal (the soft card shadow); hover lifts the whole card
    // 2px and nothing else moves. Tailwind's hover: variant only fires on
    // devices that can actually hover.
    <div className="group bg-brand-paper rounded-xl shadow-(--shadow-card) overflow-hidden transition-transform duration-(--dur-short) ease-(--ease-out) hover:-translate-y-0.5 h-full flex flex-col">
      {/* The title below is the card's one link to the product; the image
          link repeats it for pointer users and stays out of the tab order. */}
      <Link href={href} tabIndex={-1} aria-hidden="true">
        <div className="relative aspect-square overflow-hidden bg-brand-paper-2">
          <StoreImage
            src={image}
            alt=""
            fill
            sizes="(max-width: 640px) 50vw, 25vw"
            className="object-cover"
          />
          {limitedQuantity != null && inStock && (
            <span className="absolute top-2 left-2 bg-brand-accent-strong text-brand-on text-xs font-semibold px-2 py-1 rounded-full">
              Limited Edition
            </span>
          )}
        </div>
      </Link>
      <div className="p-3 sm:p-4 flex flex-1 flex-col">
        <span className="text-xs text-brand-ink-2 font-medium uppercase tracking-[0.08em]">
          {category}
        </span>
        <h3 className="font-semibold text-sm sm:text-base text-brand-ink mt-1 line-clamp-2">
          <Link
            href={href}
            className="hover:underline underline-offset-4 decoration-2"
          >
            {name}
          </Link>
        </h3>
        {/* Stock is icon + word, never colour alone. */}
        {inStock ? (
          <p className="flex items-center gap-1 font-semibold text-sm text-brand-success mt-1">
            <CheckIcon className="h-4 w-4 shrink-0" />
            In Stock
          </p>
        ) : (
          <p className="flex items-center gap-1 font-semibold text-sm text-brand-error mt-1">
            <CrossIcon className="h-4 w-4 shrink-0" />
            Out of Stock
          </p>
        )}
        {/* Cards are ~140px wide in the 2-up phone grid, so the price and
            the control beside it stack there and sit side by side from
            sm up. */}
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between mt-auto pt-3">
          <span className="text-lg font-bold text-brand-accent-deep tabular">
            {minPrice === maxPrice
              ? `$${minPrice.toFixed(2)}`
              : `From $${minPrice.toFixed(2)}`}
          </span>
          {needsSelection ? (
            <Link
              href={href}
              aria-label={`Choose options for ${name}`}
              className="whitespace-nowrap bg-brand-teal text-brand-on px-3 py-2.5 sm:py-1.5 rounded-full text-sm font-medium text-center hover:bg-brand-deep active:bg-brand-ink transition-colors duration-(--dur-micro) ease-(--ease-out)"
            >
              <span className="sm:hidden">Options</span>
              <span className="hidden sm:inline">Choose Options</span>
            </Link>
          ) : (
            <QuantityStepper
              value={qty}
              onChange={setQty}
              label={`Quantity of ${name}`}
              disabled={!inStock}
            />
          )}
        </div>
        {/* Full width under the price row: the stepper already takes the
            space a side-by-side button would have used. */}
        {!needsSelection && (
          <button
            onClick={() => {
              addItem({ productId: id, name, price, image }, qty);
              setQty(1);
            }}
            disabled={!inStock}
            aria-label={`Add to Cart: ${name}`}
            className="mt-2 w-full whitespace-nowrap bg-brand-teal text-brand-on px-3 py-2.5 sm:py-1.5 rounded-full text-sm font-medium hover:bg-brand-deep active:bg-brand-ink transition-colors duration-(--dur-micro) ease-(--ease-out) disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add to Cart
          </button>
        )}
      </div>
    </div>
  );
}
