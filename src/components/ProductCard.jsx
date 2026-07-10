"use client";

import Link from "next/link";
import { useCart } from "@/context/CartContext";

export default function ProductCard({
  id,
  name,
  quantity,
  price,
  image,
  category,
  variants = [],
  limitedQuantity = null,
}) {
  const { addItem } = useCart();

  const hasVariants = variants.length > 0;
  const stock = hasVariants
    ? variants.reduce((sum, v) => sum + v.quantity, 0)
    : quantity;
  const prices = hasVariants
    ? variants.map((v) => v.price ?? price)
    : [price];
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition group">
      <Link href={`/products/${id}`}>
        <div className="relative aspect-square overflow-hidden bg-[#F5F0E8]">
          <img
            src={image}
            alt={name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          {limitedQuantity != null && stock > 0 && (
            <span className="absolute top-2 left-2 bg-[#C8722A] text-white text-xs font-semibold px-2 py-1 rounded-full">
              Limited: {stock} of {limitedQuantity} left
            </span>
          )}
        </div>
      </Link>
      <div className="p-3 sm:p-4">
        <span className="text-xs text-[#4A7C8A] font-medium uppercase tracking-wide">
          {category}
        </span>
        <Link href={`/products/${id}`}>
          <h3 className="font-semibold text-sm sm:text-base text-[#2A4A52] mt-1 hover:text-[#4A7C8A] transition line-clamp-2">
            {name}
          </h3>
        </Link>
        {stock > 0 ? (
          <p className="font-semibold text-sm text-green-600 mt-1">{stock} In Stock</p>
        ) : (
          <p className="font-semibold text-sm text-red-600 mt-1">Out of Stock</p>
        )}
        {/* Cards are ~140px wide in the 2-up phone grid, so the price and
            button stack there and sit side by side from sm up. */}
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between mt-3">
          <span className="text-lg font-bold text-[#C8722A]">
            {minPrice === maxPrice
              ? `$${minPrice.toFixed(2)}`
              : `From $${minPrice.toFixed(2)}`}
          </span>
          {hasVariants ? (
            <Link
              href={`/products/${id}`}
              className="bg-[#4A7C8A] text-white px-3 py-2.5 sm:py-1.5 rounded-lg text-sm font-medium text-center hover:bg-[#3A6270] active:bg-[#2A4A52] transition"
            >
              Choose Options
            </Link>
          ) : (
            <button
              onClick={() => addItem({ productId: id, name, price, image })}
              disabled={stock <= 0}
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
