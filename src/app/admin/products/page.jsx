"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import AdminShell from "@/components/AdminShell";
import ImageUpload from "@/components/ImageUpload";

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

const stockOf = (p) =>
  p.variants.length > 0
    ? p.variants.reduce((sum, v) => sum + v.quantity, 0)
    : p.quantity;

function ProductFields({ form, update, variantProduct }) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
          required
          className={inputClass}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
          required
          rows={3}
          className={inputClass}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Price ($)
          </label>
          <input
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
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Quantity in stock
          </label>
          <input
            type="number"
            min="0"
            step="1"
            value={form.quantity}
            onChange={(e) => update("quantity", e.target.value)}
            required={!variantProduct}
            disabled={variantProduct}
            className={`${inputClass} disabled:bg-gray-100 disabled:text-gray-400`}
          />
          {variantProduct && (
            <p className="text-xs text-gray-500 mt-1">
              Stock lives on this product&apos;s options.
            </p>
          )}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
        <select
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
      <ImageUpload value={form.image} onChange={(url) => update("image", url)} />
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
    </>
  );
}

function EditProductRow({ product, onSaved, onDeleted, onError }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);

  const variantProduct = product.variants.length > 0;

  const startEdit = () => {
    setForm({
      name: product.name,
      description: product.description,
      price: String(product.price),
      image: product.image,
      category: product.category,
      quantity: String(product.quantity),
      featured: product.featured,
      inStock: stockOf(product) > 0,
    });
    setEditing(true);
  };

  const update = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    onError("");
    try {
      const res = await api.patch(`/admin/products/${product.id}`, {
        name: form.name,
        description: form.description,
        price: Number(form.price),
        image: form.image,
        category: form.category,
        ...(variantProduct ? {} : { quantity: Number(form.quantity) }),
        featured: form.featured,
        inStock: form.inStock,
      });
      onSaved(res.data.product);
      setEditing(false);
    } catch (err) {
      onError(err.response?.data?.error || "Failed to update product.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete "${product.name}"? This can't be undone.`)) return;
    onError("");
    try {
      await api.delete(`/admin/products/${product.id}`);
      onDeleted(product.id);
    } catch (err) {
      onError(err.response?.data?.error || "Failed to delete product.");
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-3">
      <div className="flex items-center gap-3">
        <img
          src={product.image}
          alt={product.name}
          className="w-14 h-14 rounded-lg object-cover bg-[#F5F0E8] shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[#2A4A52] truncate">{product.name}</p>
          <p className="text-xs text-gray-500 capitalize">
            {product.category}
            {product.featured && " · Featured"}
            {product.limitedQuantity != null && " · Limited drop"}
            {product.variants.length > 0 && ` · ${product.variants.length} options`}
          </p>
          <p
            className={`text-xs font-medium ${
              stockOf(product) > 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            ${product.price.toFixed(2)} ·{" "}
            {stockOf(product) > 0
              ? `${stockOf(product)} in stock`
              : "Out of stock"}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={editing ? () => setEditing(false) : startEdit}
            className="min-h-11 px-3 rounded-lg text-sm font-medium border border-[#4A7C8A] text-[#4A7C8A] hover:bg-[#4A7C8A] hover:text-white active:bg-[#3A6270] transition"
          >
            {editing ? "Close" : "Edit"}
          </button>
          <button
            onClick={remove}
            className="min-h-11 px-3 rounded-lg text-sm font-medium border border-red-300 text-red-500 hover:bg-red-500 hover:text-white active:bg-red-600 transition"
          >
            Delete
          </button>
        </div>
      </div>

      {editing && form && (
        <form onSubmit={save} className="mt-4 pt-4 border-t border-gray-100 space-y-4">
          <ProductFields form={form} update={update} variantProduct={variantProduct} />
          <label className="flex items-center gap-3 min-h-11 cursor-pointer">
            <input
              type="checkbox"
              checked={form.inStock}
              onChange={(e) => update("inStock", e.target.checked)}
            />
            <span className="text-sm font-medium text-gray-700">In Stock</span>
          </label>
          <p className="text-xs text-gray-500 -mt-2">
            Unchecking In Stock wipes the quantity to zero
            {variantProduct ? " across all options" : ""}.
          </p>
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[#4A7C8A] hover:bg-[#3A6270] active:bg-[#2A4A52] text-white py-3 rounded-lg font-semibold transition disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </form>
      )}
    </div>
  );
}

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

  return (
    <AdminShell title="Products" backTo="/admin">
      {error && (
        <p className="text-red-500 text-sm bg-red-50 p-3 rounded-lg mb-6">{error}</p>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Creation form: the fields that make up a product card. */}
        <form
          onSubmit={handleCreate}
          className="bg-white rounded-xl shadow-sm p-4 sm:p-6 space-y-4 self-start"
        >
          <h2 className="text-xl font-semibold text-[#2A4A52]">New Product</h2>
          {success && (
            <p className="text-green-700 text-sm bg-green-50 p-3 rounded-lg">{success}</p>
          )}
          <ProductFields form={form} update={update} variantProduct={false} />
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
                <EditProductRow
                  key={p.id}
                  product={p}
                  onSaved={(updated) =>
                    setProducts((prev) =>
                      prev.map((x) => (x.id === updated.id ? updated : x))
                    )
                  }
                  onDeleted={(id) =>
                    setProducts((prev) => prev.filter((x) => x.id !== id))
                  }
                  onError={setError}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
