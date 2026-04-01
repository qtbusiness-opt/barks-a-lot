"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import ProductCard from "@/components/ProductCard";

interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  category: string;
}

export default function HomePage() {
  const [featured, setFeatured] = useState<Product[]>([]);

  useEffect(() => {
    api.get("/products?featured=true").then((res) => setFeatured(res.data.products));
  }, []);

  return (
    <div>
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-[#4A7C8A] to-[#3A6270] text-white">
        <div className="max-w-7xl mx-auto px-4 py-20 sm:py-28 flex flex-col items-center text-center">
          <img
            src="/images/logo.svg"
            alt="Barks-A-Lot Treats & More"
            className="h-40 w-40 mb-6 rounded-full shadow-xl"
          />
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            Barks-A-Lot Treats & More
          </h1>
          <p className="text-lg sm:text-xl text-[#E8DFC8] max-w-2xl mb-8">
            Premium, tail-wagging treats and accessories for your furry best friend.
            Made with love, delivered with care.
          </p>
          <Link
            href="/products"
            className="bg-[#C8722A] hover:bg-[#A85D1F] text-white px-8 py-3 rounded-full text-lg font-semibold shadow-lg transition"
          >
            Shop Now
          </Link>
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center text-[#2A4A52] mb-10">
          Shop by Category
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { name: "Treats", icon: "🦴", slug: "treats" },
            { name: "Toys", icon: "🧸", slug: "toys" },
            { name: "Accessories", icon: "🎀", slug: "accessories" },
            { name: "Food", icon: "🥩", slug: "food" },
          ].map((cat) => (
            <Link
              key={cat.slug}
              href={`/products?category=${cat.slug}`}
              className="bg-white rounded-xl shadow-md p-8 text-center hover:shadow-lg hover:-translate-y-1 transition-all"
            >
              <span className="text-4xl mb-3 block">{cat.icon}</span>
              <h3 className="text-lg font-semibold text-[#2A4A52]">{cat.name}</h3>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Products */}
      {featured.length > 0 && (
        <section className="bg-[#F5F0E8] py-16">
          <div className="max-w-7xl mx-auto px-4">
            <h2 className="text-3xl font-bold text-center text-[#2A4A52] mb-10">
              Featured Products
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featured.map((product) => (
                <ProductCard key={product.id} {...product} />
              ))}
            </div>
            <div className="text-center mt-10">
              <Link
                href="/products"
                className="inline-block border-2 border-[#4A7C8A] text-[#4A7C8A] px-6 py-2.5 rounded-full font-semibold hover:bg-[#4A7C8A] hover:text-white transition"
              >
                View All Products
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Trust banner */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          <div>
            <div className="text-3xl mb-2">🐾</div>
            <h3 className="font-semibold text-[#2A4A52] text-lg">All Natural</h3>
            <p className="text-sm text-gray-600 mt-1">
              Only the finest, natural ingredients for your pup
            </p>
          </div>
          <div>
            <div className="text-3xl mb-2">🚚</div>
            <h3 className="font-semibold text-[#2A4A52] text-lg">Fast Shipping</h3>
            <p className="text-sm text-gray-600 mt-1">
              Free shipping on orders over $50
            </p>
          </div>
          <div>
            <div className="text-3xl mb-2">❤️</div>
            <h3 className="font-semibold text-[#2A4A52] text-lg">Made with Love</h3>
            <p className="text-sm text-gray-600 mt-1">
              Every product crafted with your pet&apos;s happiness in mind
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
