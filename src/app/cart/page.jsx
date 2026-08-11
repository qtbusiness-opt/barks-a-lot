"use client";

import Link from "next/link";
import { useCart } from "@/context/CartContext";

export default function CartPage() {
  const { items, removeItem, updateQuantity, total } = useCart();

  if (items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto safe-x py-20 text-center">
        <h1 className="text-3xl font-bold text-[#2A4A52] mb-4">Your Cart</h1>
        <p className="text-gray-500 mb-6">Your cart is empty.</p>
        <Link
          href="/products"
          className="inline-block bg-[#4A7C8A] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#3A6270] active:bg-[#2A4A52] transition"
        >
          Start Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto safe-x py-6 sm:py-10 pb-28 sm:pb-10">
      <h1 className="text-2xl sm:text-3xl font-bold text-[#2A4A52] mb-6 sm:mb-8">
        Your Cart
      </h1>

      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.key} className="bg-white rounded-xl shadow-sm p-4">
            {/* Two rows on phones (details, then controls); one row from sm up. */}
            <div className="flex items-center gap-3 sm:gap-4">
              <img
                src={item.image}
                alt={item.name}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg object-cover bg-[#F5F0E8] shrink-0"
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-[#2A4A52] truncate">
                  {item.name}
                </h3>
                {item.optionsLabel && (
                  <p className="text-xs text-gray-500">{item.optionsLabel}</p>
                )}
                <p className="text-[#C8722A] font-bold">
                  ${item.price.toFixed(2)}
                </p>
              </div>
              <div className="hidden sm:flex items-center gap-4">
                <QtyControls item={item} updateQuantity={updateQuantity} />
                <p className="font-bold text-[#2A4A52] w-20 text-right">
                  ${(item.price * item.quantity).toFixed(2)}
                </p>
                <RemoveButton item={item} removeItem={removeItem} />
              </div>
            </div>
            <div className="flex sm:hidden items-center justify-between mt-3">
              <QtyControls item={item} updateQuantity={updateQuantity} />
              <div className="flex items-center gap-2">
                <p className="font-bold text-[#2A4A52]">
                  ${(item.price * item.quantity).toFixed(2)}
                </p>
                <RemoveButton item={item} removeItem={removeItem} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* On phones the total + checkout stick to the bottom of the screen so
          the primary action never scrolls away. */}
      <div className="fixed sm:static inset-x-0 bottom-0 sm:mt-8 bg-white rounded-t-xl sm:rounded-xl shadow-[0_-4px_12px_rgba(0,0,0,0.08)] sm:shadow-sm p-4 sm:p-6 safe-bottom sm:pb-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center text-lg">
            <span className="font-semibold text-[#2A4A52]">Total</span>
            <span className="text-2xl font-bold text-[#C8722A]">
              ${total.toFixed(2)}
            </span>
          </div>
          <Link
            href="/checkout"
            className="mt-3 sm:mt-4 block text-center bg-[#C8722A] hover:bg-[#A85D1F] active:bg-[#8A4D1A] text-white py-3 rounded-lg font-semibold transition"
          >
            Proceed to Checkout
          </Link>
        </div>
      </div>
    </div>
  );
}

function QtyControls({ item, updateQuantity }) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => updateQuantity(item.key, item.quantity - 1)}
        aria-label={`Decrease quantity of ${item.name}`}
        className="w-11 h-11 sm:w-8 sm:h-8 rounded-full border border-gray-300 flex items-center justify-center text-lg sm:text-base hover:bg-gray-100 active:bg-gray-200"
      >
        -
      </button>
      <span className="w-10 sm:w-8 text-center font-medium">
        {item.quantity}
      </span>
      <button
        onClick={() => updateQuantity(item.key, item.quantity + 1)}
        aria-label={`Increase quantity of ${item.name}`}
        className="w-11 h-11 sm:w-8 sm:h-8 rounded-full border border-gray-300 flex items-center justify-center text-lg sm:text-base hover:bg-gray-100 active:bg-gray-200"
      >
        +
      </button>
    </div>
  );
}

function RemoveButton({ item, removeItem }) {
  return (
    <button
      onClick={() => removeItem(item.key)}
      aria-label={`Remove ${item.name} from cart`}
      className="flex items-center justify-center w-11 h-11 sm:w-auto sm:h-auto text-red-400 hover:text-red-600 active:text-red-700 transition"
    >
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
        />
      </svg>
    </button>
  );
}
