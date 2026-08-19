"use client";

import Link from "next/link";
import { useCart } from "@/context/CartContext";
import StoreImage from "@/components/StoreImage";

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

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition group">
      <Link href={`/products/${slug ?? id}`}>
        <div className="relative aspect-square overflow-hidden bg-[#F5F0E8]">
          <StoreImage
            src={image}
            alt={name}
            fill
            sizes="(max-width: 640px) 50vw, 25vw"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
          {limitedQuantity != null && inStock && (
            <span className="absolute top-2 left-2 bg-[#C8722A] text-white text-xs font-semibold px-2 py-1 rounded-full">
              Limited Edition
            </span>
          )}
        </div>
      </Link>
      <div className="p-3 sm:p-4">
        <span className="text-xs text-[#4A7C8A] font-medium uppercase tracking-wide">
          {category}
        </span>
        <Link href={`/products/${slug ?? id}`}>
          <h3 className="font-semibold text-sm sm:text-base text-[#2A4A52] mt-1 hover:text-[#4A7C8A] transition line-clamp-2">
            {name}
          </h3>
        </Link>
        {inStock ? (
          <p className="font-semibold text-sm text-green-600 mt-1">In Stock</p>
        ) : (
          <p className="font-semibold text-sm text-red-600 mt-1">
            Out of Stock
          </p>
        )}
        {/* Cards are ~140px wide in the 2-up phone grid, so the price and
            button stack there and sit side by side from sm up. */}
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between mt-3">
          <span className="text-lg font-bold text-[#C8722A]">
            {minPrice === maxPrice
              ? `$${minPrice.toFixed(2)}`
              : `From $${minPrice.toFixed(2)}`}
          </span>
          {needsSelection ? (
            <Link
              href={`/products/${slug ?? id}`}
              className="bg-[#4A7C8A] text-white px-3 py-2.5 sm:py-1.5 rounded-lg text-sm font-medium text-center hover:bg-[#3A6270] active:bg-[#2A4A52] transition"
            >
              Choose Options
            </Link>
          ) : (
            <button
              onClick={() => addItem({ productId: id, name, price, image })}
              disabled={!inStock}
              className="bg-[#4A7C8A] text-white px-3 py-2.5 sm:py-1.5 rounded-lg text-sm font-medium hover:bg-[#3A6270] active:bg-[#2A4A52] transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add to Cart
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
