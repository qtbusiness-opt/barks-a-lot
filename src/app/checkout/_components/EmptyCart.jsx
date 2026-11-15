import Link from "next/link";

export default function EmptyCart() {
  return (
    <div className="max-w-4xl mx-auto safe-x py-20 text-center">
      <h1 className="text-3xl font-bold text-[#2A4A52] mb-4">Checkout</h1>
      <p className="text-gray-600 mb-6">Your cart is empty.</p>
      <Link
        href="/products"
        className="inline-block bg-[#4A7C8A] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#3A6270] transition"
      >
        Start Shopping
      </Link>
    </div>
  );
}
