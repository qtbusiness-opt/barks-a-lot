"use client";

import Link from "next/link";
import { useCart } from "@/context/CartContext";

interface ProductCardProps {
  id: string;
  name: string;
  price: number;
  image: string;
  category: string;
}

export default function ProductCard({ id, name, price, image, category }: ProductCardProps) {
  const { addItem } = useCart();

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition group">
      <Link href={`/products/${id}`}>
        <div className="aspect-square overflow-hidden bg-[#F5F0E8]">
          <img
            src={image}
            alt={name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      </Link>
      <div className="p-4">
        <span className="text-xs text-[#4A7C8A] font-medium uppercase tracking-wide">
          {category}
        </span>
        <Link href={`/products/${id}`}>
          <h3 className="font-semibold text-[#2A4A52] mt-1 hover:text-[#4A7C8A] transition">
            {name}
          </h3>
        </Link>
        <div className="flex items-center justify-between mt-3">
          <span className="text-lg font-bold text-[#C8722A]">${price.toFixed(2)}</span>
          <button
            onClick={() => addItem({ id, name, price, image })}
            className="bg-[#4A7C8A] text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-[#3A6270] transition"
          >
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}
