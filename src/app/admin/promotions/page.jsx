"use client";

import { useEffect, useState, useId } from "react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import AdminShell from "@/components/AdminShell";

const inputClass =
  "w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#4A7C8A]";

const EMPTY = {
  name: "",
  type: "code",
  active: true,
  code: "",
  percentOff: "",
  bundleQuantity: "2",
  bundlePrice: "",
  productIds: [],
};

// Shared create/edit form fields for a promotion.
function PromoFields({ form, update, products }) {
  // Rendered by the create form and by each open edit form, so the ids
  // tying labels to inputs have to be unique per instance.
  const fieldId = useId();
  const toggleProduct = (id) =>
    update(
      "productIds",
      form.productIds.includes(id)
        ? form.productIds.filter((p) => p !== id)
        : [...form.productIds, id]
    );

  return (
    <>
      <div>
        <label
          htmlFor={`${fieldId}-name`}
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Name / topic
        </label>
        <input
          id={`${fieldId}-name`}
          type="text"
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
          placeholder="e.g. Veterans Discount"
          maxLength={80}
          required
          className={inputClass}
        />
      </div>

      <div>
        <span className="block text-sm font-medium text-gray-700 mb-1">
          Type
        </span>
        <div className="flex gap-2">
          {[
            ["code", "Discount code (% off)"],
            ["bundle", "Bundle (mix & match)"],
          ].map(([value, label]) => (
            <label
              key={value}
              className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2 min-h-11 cursor-pointer has-checked:border-[#4A7C8A] has-checked:bg-[#F5F0E8] text-sm"
            >
              <input
                type="radio"
                name={`promo-type-${form._key ?? "new"}`}
                value={value}
                checked={form.type === value}
                onChange={() => update("type", value)}
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      {form.type === "code" ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor={`${fieldId}-code`}
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Code
            </label>
            <input
              id={`${fieldId}-code`}
              type="text"
              value={form.code}
              onChange={(e) => update("code", e.target.value.toUpperCase())}
              placeholder="VETERANS"
              maxLength={40}
              className={`${inputClass} uppercase`}
            />
          </div>
          <div>
            <label
              htmlFor={`${fieldId}-percent`}
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Percent off
            </label>
            <input
              id={`${fieldId}-percent`}
              type="number"
              min="1"
              max="100"
              value={form.percentOff}
              onChange={(e) => update("percentOff", e.target.value)}
              placeholder="20"
              className={inputClass}
            />
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor={`${fieldId}-bundleqty`}
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Buy any (quantity)
              </label>
              <input
                id={`${fieldId}-bundleqty`}
                type="number"
                min="2"
                max="50"
                value={form.bundleQuantity}
                onChange={(e) => update("bundleQuantity", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label
                htmlFor={`${fieldId}-bundleprice`}
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                For price ($)
              </label>
              <input
                id={`${fieldId}-bundleprice`}
                type="number"
                min="0.01"
                step="0.01"
                value={form.bundlePrice}
                onChange={(e) => update("bundlePrice", e.target.value)}
                placeholder="20.00"
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <span className="block text-sm font-medium text-gray-700 mb-1">
              Eligible products
            </span>
            <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
              {products.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={form.productIds.includes(p.id)}
                    onChange={() => toggleProduct(p.id)}
                  />
                  {p.name}
                </label>
              ))}
            </div>
          </div>
        </>
      )}

      <label className="flex items-center gap-3 min-h-11 cursor-pointer text-sm text-gray-700">
        <input
          type="checkbox"
          checked={form.active}
          onChange={(e) => update("active", e.target.checked)}
        />
        Active
      </label>
    </>
  );
}

function toPayload(form) {
  const base = { name: form.name.trim(), type: form.type, active: form.active };
  if (form.type === "code") {
    return {
      ...base,
      code: form.code.trim(),
      percentOff: Number(form.percentOff),
    };
  }
  return {
    ...base,
    bundleQuantity: Number(form.bundleQuantity),
    bundlePrice: Number(form.bundlePrice),
    productIds: form.productIds,
  };
}

function fromPromo(promo) {
  return {
    _key: promo.id,
    name: promo.name,
    type: promo.type,
    active: promo.active,
    code: promo.code ?? "",
    percentOff: promo.percentOff != null ? String(promo.percentOff) : "",
    bundleQuantity:
      promo.bundleQuantity != null ? String(promo.bundleQuantity) : "2",
    bundlePrice: promo.bundlePrice != null ? String(promo.bundlePrice) : "",
    productIds: promo.productIds ?? [],
  };
}

function PromoRow({ promo, products, onSaved, onDeleted, onError }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => fromPromo(promo));
  const [saving, setSaving] = useState(false);
  const update = (field, value) => setForm((p) => ({ ...p, [field]: value }));

  const productNames = (promo.productIds ?? [])
    .map((id) => products.find((p) => p.id === id)?.name)
    .filter(Boolean);

  const summary =
    promo.type === "code"
      ? `${promo.percentOff}% off · code ${promo.code}`
      : `Any ${promo.bundleQuantity} for $${promo.bundlePrice?.toFixed(2)} · ${productNames.join(", ") || "no products"}`;

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    onError("");
    try {
      const res = await api.patch(
        `/admin/promotions/${promo.id}`,
        toPayload(form)
      );
      onSaved(res.data.promotion);
      setEditing(false);
    } catch (err) {
      onError(err.response?.data?.error || "Failed to save the promotion.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async () => {
    onError("");
    try {
      const res = await api.patch(`/admin/promotions/${promo.id}`, {
        ...toPayload(fromPromo(promo)),
        active: !promo.active,
      });
      onSaved(res.data.promotion);
    } catch (err) {
      onError(err.response?.data?.error || "Failed to update the promotion.");
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete "${promo.name}"?`)) return;
    onError("");
    try {
      await api.delete(`/admin/promotions/${promo.id}`);
      onDeleted(promo.id);
    } catch (err) {
      onError(err.response?.data?.error || "Failed to delete the promotion.");
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-[#2A4A52]">
            {promo.name}
            {!promo.active && (
              <span className="ml-2 inline-block bg-gray-200 text-gray-600 rounded-full px-2 py-0.5 text-xs font-medium">
                Inactive
              </span>
            )}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{summary}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={toggleActive}
            className="min-h-11 px-3 rounded-lg text-sm font-medium border border-[#4A7C8A] text-[#4A7C8A] hover:bg-[#4A7C8A] hover:text-white transition"
          >
            {promo.active ? "Deactivate" : "Activate"}
          </button>
          <button
            onClick={() => setEditing((v) => !v)}
            className="min-h-11 px-3 rounded-lg text-sm font-medium border border-[#4A7C8A] text-[#4A7C8A] hover:bg-[#4A7C8A] hover:text-white transition"
          >
            {editing ? "Close" : "Edit"}
          </button>
          <button
            onClick={remove}
            className="min-h-11 px-3 rounded-lg text-sm font-medium border border-red-300 text-red-500 hover:bg-red-500 hover:text-white transition"
          >
            Delete
          </button>
        </div>
      </div>

      {editing && (
        <form
          onSubmit={save}
          className="mt-4 pt-4 border-t border-gray-100 space-y-4"
        >
          <PromoFields form={form} update={update} products={products} />
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[#4A7C8A] hover:bg-[#3A6270] text-white py-2.5 rounded-lg font-semibold transition disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function AdminPromotionsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [promotions, setPromotions] = useState(null);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isAdmin) {
      api
        .get("/admin/promotions")
        .then((res) => setPromotions(res.data.promotions))
        .catch(() => setError("Failed to load promotions."));
      api
        .get("/admin/products")
        .then((res) => setProducts(res.data.products))
        .catch(() => setProducts([]));
    }
  }, [isAdmin]);

  const update = (field, value) => setForm((p) => ({ ...p, [field]: value }));

  const create = async (e) => {
    e.preventDefault();
    setError("");
    setCreating(true);
    try {
      const res = await api.post("/admin/promotions", toPayload(form));
      setPromotions((prev) => [res.data.promotion, ...(prev ?? [])]);
      setForm(EMPTY);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to create the promotion.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <AdminShell title="Promotions" backTo="/admin">
      <p className="text-sm text-gray-500 mb-6 -mt-4">
        Discount codes apply when a customer enters the code at checkout;
        bundles (mix &amp; match) apply automatically when the cart qualifies.
      </p>
      {error && (
        <p
          role="alert"
          className="text-red-500 text-sm bg-red-50 p-3 rounded-lg mb-6"
        >
          {error}
        </p>
      )}

      <form
        onSubmit={create}
        className="bg-white rounded-xl shadow-sm p-4 sm:p-6 mb-6 max-w-xl space-y-4"
      >
        <h2 className="text-lg font-semibold text-[#2A4A52]">New Promotion</h2>
        <PromoFields form={form} update={update} products={products} />
        <button
          type="submit"
          disabled={creating}
          className="w-full bg-[#C8722A] hover:bg-[#A85D1F] text-white py-2.5 rounded-lg font-semibold transition disabled:opacity-50"
        >
          {creating ? "Creating…" : "Create Promotion"}
        </button>
      </form>

      {promotions === null && !error ? (
        <p className="text-gray-500 text-center py-10">Loading promotions…</p>
      ) : promotions?.length === 0 ? (
        <p className="text-gray-500 text-center py-10">
          No promotions yet — create one above.
        </p>
      ) : (
        <div className="space-y-3 max-w-xl">
          {promotions?.map((promo) => (
            <PromoRow
              key={promo.id}
              promo={promo}
              products={products}
              onSaved={(updated) =>
                setPromotions((prev) =>
                  prev.map((p) => (p.id === updated.id ? updated : p))
                )
              }
              onDeleted={(id) =>
                setPromotions((prev) => prev.filter((p) => p.id !== id))
              }
              onError={setError}
            />
          ))}
        </div>
      )}
    </AdminShell>
  );
}
