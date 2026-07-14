"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import api from "@/lib/api";
import ProductCard from "@/components/ProductCard";

function ProductsContent() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get("category") || "all";
  const [category, setCategory] = useState(initialCategory);
  const [result, setResult] = useState(null);
  // Admin-managed category chips; "all" is a fixed pseudo-filter.
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    api
      .get("/categories")
      .then((res) => setCategories(res.data.categories))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    const params = category !== "all" ? `?category=${encodeURIComponent(category)}` : "";
    api
      .get(`/products${params}`)
      .then((res) => setResult({ category, products: res.data.products }));
  }, [category]);

  const chips = [
    { slug: "all", name: "All" },
    ...categories.map((c) => ({ slug: c.slug, name: c.name })),
  ];

  const loading = result?.category !== category;
  const products = result?.products ?? [];

  return (
    <div className="max-w-7xl mx-auto safe-x py-6 sm:py-10">
      <h1 className="text-2xl sm:text-3xl font-bold text-[#2A4A52] mb-6 sm:mb-8">Our Products</h1>

      <div className="flex sm:flex-wrap gap-2 mb-6 sm:mb-8 overflow-x-auto pb-2 -mx-1 px-1">
        {chips.map((cat) => (
          <button
            key={cat.slug}
            onClick={() => setCategory(cat.slug)}
            className={`shrink-0 min-h-11 px-4 py-2 rounded-full text-sm font-medium transition ${
              category === cat.slug
                ? "bg-[#4A7C8A] text-white"
                : "bg-white text-[#4A7C8A] border border-[#4A7C8A] hover:bg-[#4A7C8A] hover:text-white"
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-500">Loading products...</div>
      ) : products.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          No products found in this category.
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} {...product} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-gray-500">Loading...</div>}>
      <ProductsContent />
    </Suspense>
  );
}
