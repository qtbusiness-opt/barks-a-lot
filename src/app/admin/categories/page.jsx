"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import AdminShell from "@/components/AdminShell";

const inputClass =
  "w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#4A7C8A]";

function CategoryRow({ category, onSaved, onDeleted, onError }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: category.name,
    icon: category.icon,
    showsIngredients: category.showsIngredients,
  });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    onError("");
    try {
      const res = await api.patch(`/admin/categories/${category.id}`, form);
      onSaved({ ...res.data.category, productCount: category.productCount });
      setEditing(false);
    } catch (err) {
      onError(err.response?.data?.error || "Failed to update the category.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete the "${category.name}" category?`)) return;
    onError("");
    try {
      await api.delete(`/admin/categories/${category.id}`);
      onDeleted(category.id);
    } catch (err) {
      onError(err.response?.data?.error || "Failed to delete the category.");
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl">{category.icon}</span>
          <div>
            <p className="font-semibold text-[#2A4A52]">{category.name}</p>
            <p className="text-xs text-gray-500">
              /{category.slug} · {category.productCount} product
              {category.productCount === 1 ? "" : "s"}
              {category.showsIngredients && (
                <span className="ml-2 inline-block bg-green-100 text-green-800 rounded-full px-2 py-0.5 font-medium">
                  Ingredients
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => setEditing((v) => !v)}
            className="min-h-11 px-3 rounded-lg text-sm font-medium border border-[#4A7C8A] text-[#4A7C8A] hover:bg-[#4A7C8A] hover:text-white active:bg-[#3A6270] transition"
          >
            {editing ? "Close" : "Edit"}
          </button>
          <button
            onClick={remove}
            disabled={category.productCount > 0}
            title={
              category.productCount > 0
                ? "Move or delete this category's products first"
                : undefined
            }
            className="min-h-11 px-3 rounded-lg text-sm font-medium border border-red-300 text-red-500 hover:bg-red-500 hover:text-white active:bg-red-600 transition disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-red-500"
          >
            Delete
          </button>
        </div>
      </div>

      {editing && (
        <form
          onSubmit={save}
          className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-[5rem_1fr_auto] gap-3"
        >
          <input
            type="text"
            value={form.icon}
            onChange={(e) => setForm((p) => ({ ...p, icon: e.target.value }))}
            aria-label="Emoji"
            maxLength={8}
            required
            className={`${inputClass} text-center`}
          />
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            aria-label="Category name"
            maxLength={40}
            required
            className={inputClass}
          />
          <button
            type="submit"
            disabled={saving}
            className="bg-[#4A7C8A] hover:bg-[#3A6270] text-white px-4 rounded-lg font-semibold transition disabled:opacity-50"
          >
            {saving ? "…" : "Save"}
          </button>
          <label className="col-span-3 flex items-center gap-3 min-h-11 cursor-pointer text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.showsIngredients}
              onChange={(e) =>
                setForm((p) => ({ ...p, showsIngredients: e.target.checked }))
              }
            />
            Products in this category show an &ldquo;Ingredients&rdquo; section
          </label>
          {form.name.trim() && (
            <p className="col-span-3 text-xs text-gray-500">
              Renaming updates every product in this category automatically.
            </p>
          )}
        </form>
      )}
    </div>
  );
}

export default function AdminCategoriesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [categories, setCategories] = useState(null);
  const [form, setForm] = useState({ name: "", icon: "🐾", showsIngredients: false });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isAdmin) {
      api
        .get("/admin/categories")
        .then((res) => setCategories(res.data.categories))
        .catch(() => setError("Failed to load categories."));
    }
  }, [isAdmin]);

  const create = async (e) => {
    e.preventDefault();
    setError("");
    setCreating(true);
    try {
      const res = await api.post("/admin/categories", form);
      setCategories((prev) => [
        ...(prev ?? []),
        { ...res.data.category, productCount: 0 },
      ]);
      setForm({ name: "", icon: "🐾", showsIngredients: false });
    } catch (err) {
      setError(err.response?.data?.error || "Failed to create the category.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <AdminShell title="Categories" backTo="/admin">
      {error && (
        <p role="alert" className="text-red-500 text-sm bg-red-50 p-3 rounded-lg mb-6">{error}</p>
      )}

      <form
        onSubmit={create}
        className="bg-white rounded-xl shadow-sm p-4 sm:p-6 mb-6 max-w-xl"
      >
        <h2 className="text-lg font-semibold text-[#2A4A52] mb-3">
          New Category
        </h2>
        <div className="grid grid-cols-[5rem_1fr_auto] gap-3">
          <input
            type="text"
            value={form.icon}
            onChange={(e) => setForm((p) => ({ ...p, icon: e.target.value }))}
            aria-label="Emoji"
            maxLength={8}
            required
            className={`${inputClass} text-center`}
          />
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="e.g. Bandanas"
            aria-label="Category name"
            maxLength={40}
            required
            className={inputClass}
          />
          <button
            type="submit"
            disabled={creating}
            className="bg-[#C8722A] hover:bg-[#A85D1F] text-white px-4 rounded-lg font-semibold transition disabled:opacity-50"
          >
            {creating ? "…" : "Add"}
          </button>
        </div>
        <label className="flex items-center gap-3 min-h-11 cursor-pointer text-sm text-gray-700 mt-2">
          <input
            type="checkbox"
            checked={form.showsIngredients}
            onChange={(e) =>
              setForm((p) => ({ ...p, showsIngredients: e.target.checked }))
            }
          />
          Products in this category show an &ldquo;Ingredients&rdquo; section
          (for edibles like treats)
        </label>
        <p className="text-xs text-gray-500 mt-2">
          The emoji shows on the homepage tile; the shop filter uses the name.
        </p>
      </form>

      {categories === null && !error ? (
        <p className="text-gray-500 text-center py-10">Loading categories…</p>
      ) : (
        <div className="space-y-3 max-w-xl">
          {(categories ?? []).map((category) => (
            <CategoryRow
              key={category.id}
              category={category}
              onSaved={(updated) =>
                setCategories((prev) =>
                  prev.map((c) => (c.id === updated.id ? updated : c))
                )
              }
              onDeleted={(id) =>
                setCategories((prev) => prev.filter((c) => c.id !== id))
              }
              onError={setError}
            />
          ))}
        </div>
      )}
    </AdminShell>
  );
}
