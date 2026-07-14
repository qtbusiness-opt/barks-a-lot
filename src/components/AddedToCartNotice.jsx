"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useCart } from "@/context/CartContext";

// Confirmation shown after adding to cart: a right-side drawer on desktop
// (md+) and a bottom-sheet modal on phones. Driven by CartContext so it
// fires from both the product grid and the detail page.
export default function AddedToCartNotice() {
  const { lastAdded, dismissLastAdded, total, itemCount } = useCart();
  const panelRef = useRef(null);

  useEffect(() => {
    if (!lastAdded) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") dismissLastAdded();
    };
    document.addEventListener("keydown", onKeyDown);
    // Lock page scroll behind the overlay.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [lastAdded, dismissLastAdded]);

  if (!lastAdded) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <button
        aria-label="Close"
        onClick={dismissLastAdded}
        className="absolute inset-0 bg-black/40 animate-fade-in cursor-default"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Added to cart"
        className="absolute bg-white shadow-2xl flex flex-col focus:outline-none
                   inset-x-0 bottom-0 rounded-t-2xl max-h-[85vh] animate-slide-up
                   md:inset-x-auto md:right-0 md:top-0 md:bottom-0 md:w-96 md:rounded-none md:max-h-none md:animate-slide-in-right"
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100">
          <h2 className="text-lg font-bold text-[#2A4A52] flex items-center gap-2">
            <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Added to Cart
          </h2>
          <button
            onClick={dismissLastAdded}
            aria-label="Close"
            className="flex items-center justify-center h-11 w-11 -mr-2 text-gray-500 hover:text-gray-700 active:text-gray-800"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 flex items-center gap-4 overflow-y-auto">
          <img
            src={lastAdded.image}
            alt={lastAdded.name}
            className="w-20 h-20 rounded-lg object-cover bg-[#F5F0E8] shrink-0"
          />
          <div className="min-w-0">
            <p className="font-semibold text-[#2A4A52]">{lastAdded.name}</p>
            <p className="text-sm text-gray-500 mt-1">Qty: {lastAdded.quantity}</p>
            <p className="text-[#C8722A] font-bold mt-1">
              ${(lastAdded.price * lastAdded.quantity).toFixed(2)}
            </p>
          </div>
        </div>

        <div className="mt-auto px-5 py-4 border-t border-gray-100 safe-bottom md:pb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-3">
            <span>
              Cart ({itemCount} {itemCount === 1 ? "item" : "items"})
            </span>
            <span className="font-bold text-[#2A4A52]">${total.toFixed(2)}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/cart"
              onClick={dismissLastAdded}
              className="text-center border-2 border-[#4A7C8A] text-[#4A7C8A] py-2.5 rounded-lg font-semibold hover:bg-[#4A7C8A] hover:text-white active:bg-[#3A6270] transition"
            >
              View Cart
            </Link>
            <Link
              href="/checkout"
              onClick={dismissLastAdded}
              className="text-center bg-[#C8722A] hover:bg-[#A85D1F] active:bg-[#8A4D1A] text-white py-2.5 rounded-lg font-semibold transition"
            >
              Checkout
            </Link>
          </div>
          <button
            onClick={dismissLastAdded}
            className="w-full text-center text-sm text-[#4A7C8A] font-medium hover:underline mt-3 min-h-11"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    </div>
  );
}
