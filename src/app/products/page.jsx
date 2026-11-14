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
  // Bumped by "Try again" to re-run the products request.
  const [retryKey, setRetryKey] = useState(0);
  // Admin-managed category chips; "all" is a fixed pseudo-filter.
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    api
      .get("/categories")
      .then((res) => setCategories(res.data.categories))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    // Ignore a response that arrives after the category changed again.
    let stale = false;
    const params = category !== "all" ? `?category=${encodeURIComponent(category)}` : "";
    api
      .get(`/products${params}`)
      .then((res) => {
        if (!stale) setResult({ category, products: res.data.products, error: false });
      })
      .catch(() => {
        if (!stale) setResult({ category, products: [], error: true });
      });
    return () => {
      stale = true;
    };
  }, [category, retryKey]);

  const chips = [
    { slug: "all", name: "All" },
    ...categories.map((c) => ({ slug: c.slug, name: c.name })),
  ];

  const loading = result?.category !== category;
  const products = result?.products ?? [];
  const failed = !loading && result?.error;

  return (
    <div className="max-w-7xl mx-auto safe-x py-6 sm:py-10">
      <h1 className="text-2xl sm:text-3xl font-bold text-brand-ink mb-6 sm:mb-8">Our Products</h1>

      <div className="flex sm:flex-wrap gap-2 mb-6 sm:mb-8 overflow-x-auto pb-2 -mx-1 px-1">
        {chips.map((cat) => (
          <button
            key={cat.slug}
            onClick={() => setCategory(cat.slug)}
            className={`shrink-0 min-h-11 px-4 py-2 rounded-full text-sm font-medium transition ${
              category === cat.slug
                ? "bg-brand-teal text-brand-on border border-brand-teal"
                : "bg-white text-brand-ink-2 border border-brand-teal hover:bg-brand-teal hover:text-brand-on"
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-brand-ink-2">Loading products…</div>
      ) : failed ? (
        <div role="alert" className="text-center py-20 text-brand-ink-2">
          <p>We couldn&rsquo;t load the products just now.</p>
          <button
            type="button"
            onClick={() => {
              // Clearing the result shows "Loading products…" while retrying.
              setResult(null);
              setRetryKey((k) => k + 1);
            }}
            className="mt-4 inline-flex items-center min-h-11 px-5 rounded-full bg-brand-teal text-brand-on font-semibold hover:bg-brand-deep"
          >
            Try again
          </button>
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-20 text-brand-ink-2">
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
    <Suspense fallback={<div className="text-center py-20 text-brand-ink-2">Loading…</div>}>
      <ProductsContent />
    </Suspense>
  );
}
