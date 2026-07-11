"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import AdminShell from "@/components/AdminShell";

const CATEGORIES = ["treats", "toys", "accessories", "food"];

const inputClass =
  "w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#4A7C8A]";

const EMPTY_FORM = {
  name: "",
  description: "",
  price: "",
  image: "/images/products/squeaky-bone.svg",
  category: "treats",
  quantity: "",
  featured: false,
};

export default function AdminProductsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [products, setProducts] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      api
        .get("/admin/products")
        .then((res) => setProducts(res.data.products))
        .catch(() => setError("Failed to load products."));
    }
  }, [isAdmin]);

  const update = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      const res = await api.post("/admin/products", {
        name: form.name,
        description: form.description,
        price: Number(form.price),
        image: form.image,
        category: form.category,
        quantity: Number(form.quantity),
        featured: form.featured,
      });
      setProducts((prev) => [res.data.product, ...(prev ?? [])]);
      setForm(EMPTY_FORM);
      setSuccess(`"${res.data.product.name}" added to the catalog.`);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to create product.");
    } finally {
      setSubmitting(false);
    }
  };

  const stockOf = (p) =>
    p.variants.length > 0
      ? p.variants.reduce((sum, v) => sum + v.quantity, 0)
      : p.quantity;

  return (
    <AdminShell title="Products" backTo="/admin">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Creation form: the fields that make up a product card. */}
        <form
          onSubmit={handleCreate}
          className="bg-white rounded-xl shadow-sm p-4 sm:p-6 space-y-4 self-start"
        >
          <h2 className="text-xl font-semibold text-[#2A4A52]">New Product</h2>
          {error && (
            <p className="text-red-500 text-sm bg-red-50 p-3 rounded-lg">{error}</p>
          )}
          {success && (
            <p className="text-green-700 text-sm bg-green-50 p-3 rounded-lg">{success}</p>
          )}
          <div>
            <label htmlFor="p-name" className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              id="p-name"
              type="text"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="p-desc" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              id="p-desc"
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              required
              rows={3}
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="p-price" className="block text-sm font-medium text-gray-700 mb-1">
                Price ($)
              </label>
              <input
                id="p-price"
                type="number"
                min="0.01"
                step="0.01"
                value={form.price}
                onChange={(e) => update("price", e.target.value)}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="p-qty" className="block text-sm font-medium text-gray-700 mb-1">
                Quantity in stock
              </label>
              <input
                id="p-qty"
                type="number"
                min="0"
                step="1"
                value={form.quantity}
                onChange={(e) => update("quantity", e.target.value)}
                required
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label htmlFor="p-cat" className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              id="p-cat"
              value={form.category}
              onChange={(e) => update("category", e.target.value)}
              className={`${inputClass} capitalize`}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c} className="capitalize">
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="p-img" className="block text-sm font-medium text-gray-700 mb-1">
              Image path
            </label>
            <input
              id="p-img"
              type="text"
              value={form.image}
              onChange={(e) => update("image", e.target.value)}
              required
              className={inputClass}
            />
            <p className="text-xs text-gray-500 mt-1">
              Place the file under public/images/products/ and reference it
              here, e.g. /images/products/my-treat.svg
            </p>
          </div>
          <label className="flex items-center gap-3 min-h-11 cursor-pointer">
            <input
              type="checkbox"
              checked={form.featured}
              onChange={(e) => update("featured", e.target.checked)}
            />
            <span className="text-sm font-medium text-gray-700">
              Featured on the homepage
            </span>
          </label>
          <p className="text-xs text-gray-500">
            Stock status is set automatically: products with quantity 0 show
            as out of stock.
          </p>
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#C8722A] hover:bg-[#A85D1F] active:bg-[#8A4D1A] text-white py-3 rounded-lg font-semibold transition disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create Product"}
          </button>
        </form>

        {/* Full catalog, including items hidden from the storefront. */}
        <div>
          <h2 className="text-xl font-semibold text-[#2A4A52] mb-4">
            Catalog ({products?.length ?? "…"})
          </h2>
          {products === null ? (
            <p className="text-gray-500">Loading products...</p>
          ) : (
            <div className="space-y-3">
              {products.map((p) => (
                <div
                  key={p.id}
                  className="bg-white rounded-xl shadow-sm p-3 flex items-center gap-3"
                >
                  <img
                    src={p.image}
                    alt={p.name}
                    className="w-14 h-14 rounded-lg object-cover bg-[#F5F0E8] shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#2A4A52] truncate">{p.name}</p>
                    <p className="text-xs text-gray-500 capitalize">
                      {p.category}
                      {p.featured && " · Featured"}
                      {p.limitedQuantity != null && " · Limited drop"}
                      {p.variants.length > 0 && ` · ${p.variants.length} options`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-[#C8722A]">${p.price.toFixed(2)}</p>
                    <p
                      className={`text-xs font-medium ${
                        stockOf(p) > 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {stockOf(p) > 0 ? `${stockOf(p)} in stock` : "Out of stock"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
