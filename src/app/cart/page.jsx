"use client";

import Link from "next/link";
import { useCart } from "@/context/CartContext";

export default function CartPage() {
  const { items, removeItem, updateQuantity, total } = useCart();

  if (items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <h1 className="text-3xl font-bold text-[#2A4A52] mb-4">Your Cart</h1>
        <p className="text-gray-500 mb-6">Your cart is empty.</p>
        <Link
          href="/products"
          className="bg-[#4A7C8A] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#3A6270] transition"
        >
          Start Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-[#2A4A52] mb-8">Your Cart</h1>

      <div className="space-y-4">
        {items.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-4"
          >
            <img
              src={item.image}
              alt={item.name}
              className="w-20 h-20 rounded-lg object-cover bg-[#F5F0E8]"
            />
            <div className="flex-1">
              <h3 className="font-semibold text-[#2A4A52]">{item.name}</h3>
              <p className="text-[#C8722A] font-bold">${item.price.toFixed(2)}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100"
              >
                -
              </button>
              <span className="w-8 text-center font-medium">{item.quantity}</span>
              <button
                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100"
              >
                +
              </button>
            </div>
            <p className="font-bold text-[#2A4A52] w-20 text-right">
              ${(item.price * item.quantity).toFixed(2)}
            </p>
            <button
              onClick={() => removeItem(item.id)}
              className="text-red-400 hover:text-red-600 transition"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      <div className="mt-8 bg-white rounded-xl shadow-sm p-6">
        <div className="flex justify-between items-center text-lg">
          <span className="font-semibold text-[#2A4A52]">Total</span>
          <span className="text-2xl font-bold text-[#C8722A]">${total.toFixed(2)}</span>
        </div>
        <Link
          href="/checkout"
          className="mt-4 block text-center bg-[#C8722A] hover:bg-[#A85D1F] text-white py-3 rounded-lg font-semibold transition"
        >
          Proceed to Checkout
        </Link>
      </div>
    </div>
  );
}
