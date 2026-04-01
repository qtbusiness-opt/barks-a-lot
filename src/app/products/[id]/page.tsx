"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { useCart } from "@/context/CartContext";

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  inStock: boolean;
}

export default function ProductDetailPage() {
  const { id } = useParams();
  const { addItem } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (id) {
      api.get(`/products/${id}`).then((res) => setProduct(res.data.product));
    }
  }, [id]);

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center text-gray-500">
        Loading...
      </div>
    );
  }

  const handleAdd = () => {
    addItem(
      { id: product.id, name: product.name, price: product.price, image: product.image },
      quantity
    );
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <Link href="/products" className="text-[#4A7C8A] hover:underline mb-6 inline-block">
        &larr; Back to Products
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="bg-[#F5F0E8] rounded-xl overflow-hidden">
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        </div>

        <div>
          <span className="text-sm text-[#4A7C8A] font-medium uppercase tracking-wide">
            {product.category}
          </span>
          <h1 className="text-3xl font-bold text-[#2A4A52] mt-2">{product.name}</h1>
          <p className="text-2xl font-bold text-[#C8722A] mt-4">
            ${product.price.toFixed(2)}
          </p>
          <p className="text-gray-600 mt-4 leading-relaxed">{product.description}</p>

          <div className="mt-6 flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Qty:</label>
            <select
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleAdd}
            disabled={!product.inStock}
            className={`mt-6 w-full sm:w-auto px-8 py-3 rounded-lg font-semibold text-white transition ${
              product.inStock
                ? "bg-[#C8722A] hover:bg-[#A85D1F]"
                : "bg-gray-400 cursor-not-allowed"
            }`}
          >
            {!product.inStock
              ? "Out of Stock"
              : added
              ? "Added to Cart!"
              : "Add to Cart"}
          </button>

          {added && (
            <Link
              href="/cart"
              className="mt-4 inline-block text-[#4A7C8A] hover:underline font-medium"
            >
              View Cart &rarr;
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
