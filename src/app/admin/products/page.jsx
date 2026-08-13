"use client";

import { useEffect, useId, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import AdminShell from "@/components/AdminShell";
import ImageUpload from "@/components/ImageUpload";
import OptionGroupsEditor from "@/components/OptionGroupsEditor";
import StoreImage from "@/components/StoreImage";

const inputClass =
  "w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#4A7C8A]";

const EMPTY_FORM = {
  name: "",
  description: "",
  price: "",
  image: "/images/products/squeaky-bone.svg",
  images: [],
  itemDetails: "",
  nutritionFacts: [],
  optionGroups: [],
  category: "treats",
  quantity: "",
  featured: false,
};

const MAX_NUTRITION_ROWS = 30;

// A half-filled row would fail server validation and sink the whole
// save, so incomplete rows are dropped on the way out instead.
const cleanOptionGroups = (groups) =>
  groups
    .map((g) => ({
      ...g,
      name: g.name.trim(),
      choices: g.choices
        .map((c) => ({ label: c.label.trim(), image: c.image || null }))
        .filter((c) => c.label !== ""),
    }))
    .filter((g) => g.name !== "" && g.choices.length > 0);

const cleanNutrition = (rows) =>
  rows
    .map((r) => ({ label: r.label.trim(), value: r.value.trim() }))
    .filter((r) => r.label !== "" && r.value !== "");

// Suggested starting rows for a dog treat — the guaranteed analysis
// most treat labels carry. Values are left blank for the admin to fill.
const NUTRITION_STARTER = [
  { label: "Crude Protein (min)", value: "" },
  { label: "Crude Fat (min)", value: "" },
  { label: "Crude Fiber (max)", value: "" },
  { label: "Moisture (max)", value: "" },
];

// Repeatable label/value rows rendered as the Nutrition Facts table on
// the product page. Only offered for categories that show an
// Ingredients section — the app's "this is edible" flag.
function NutritionFactsFields({ rows, onChange, idSuffix }) {
  const setRow = (index, field, value) =>
    onChange(rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)));

  return (
    <fieldset>
      <legend className="block text-sm font-medium text-gray-700 mb-1">
        Nutrition Facts (optional)
      </legend>
      {rows.length > 0 && (
        <div className="space-y-2 mb-2">
          {rows.map((row, i) => (
            <div key={i} className="flex gap-2 items-start">
              <input
                type="text"
                value={row.label}
                onChange={(e) => setRow(i, "label", e.target.value)}
                aria-label={`Nutrient name, row ${i + 1}`}
                placeholder="Crude Protein (min)"
                maxLength={80}
                className={`${inputClass} flex-[3] py-2`}
              />
              <input
                type="text"
                value={row.value}
                onChange={(e) => setRow(i, "value", e.target.value)}
                aria-label={`Amount, row ${i + 1}`}
                placeholder="24%"
                maxLength={80}
                className={`${inputClass} flex-1 py-2`}
              />
              <button
                type="button"
                onClick={() => onChange(rows.filter((_, j) => j !== i))}
                aria-label={`Remove nutrition row ${i + 1}`}
                className="shrink-0 h-11 w-11 rounded-lg border border-red-300 text-red-500 hover:bg-red-500 hover:text-white transition"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {rows.length < MAX_NUTRITION_ROWS && (
          <button
            type="button"
            onClick={() => onChange([...rows, { label: "", value: "" }])}
            className="min-h-11 px-3 rounded-lg text-sm font-medium border border-[#4A7C8A] text-[#4A7C8A] hover:bg-[#4A7C8A] hover:text-white transition"
          >
            + Add row
          </button>
        )}
        {rows.length === 0 && (
          <button
            type="button"
            onClick={() => onChange(NUTRITION_STARTER.map((r) => ({ ...r })))}
            id={`nutrition-starter-${idSuffix}`}
            className="min-h-11 px-3 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-100 transition"
          >
            Use guaranteed analysis
          </button>
        )}
      </div>
      <p className="text-xs text-gray-500 mt-1">
        Shown as a table on the product page. Rows missing a name or an amount
        are dropped when you save.
      </p>
    </fieldset>
  );
}

const stockOf = (p) =>
  p.variants.length > 0
    ? p.variants.reduce((sum, v) => sum + v.quantity, 0)
    : p.quantity;

function ProductFields({ form, update, variantProduct, categories }) {
  // Rendered by the create form and by every open edit form, so field
  // ids have to be unique per instance for labels to resolve.
  const fieldId = useId();
  const showsIngredients =
    categories.find((c) => c.slug === form.category)?.showsIngredients ?? false;
  return (
    <>
      <div>
        <label
          htmlFor={`${fieldId}-name`}
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Name
        </label>
        <input
          id={`${fieldId}-name`}
          type="text"
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
          required
          className={inputClass}
        />
      </div>
      <div>
        <label
          htmlFor={`${fieldId}-description`}
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Description
        </label>
        <textarea
          id={`${fieldId}-description`}
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
          required
          rows={3}
          className={inputClass}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label
            htmlFor={`${fieldId}-price`}
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Price ($)
          </label>
          <input
            id={`${fieldId}-price`}
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
          <label
            htmlFor={`${fieldId}-quantity`}
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Quantity in stock
          </label>
          <input
            id={`${fieldId}-quantity`}
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
              Stock lives on this product&rsquo;s options.
            </p>
          )}
        </div>
      </div>
      <div>
        <label
          htmlFor={`${fieldId}-category`}
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Category
        </label>
        <select
          id={`${fieldId}-category`}
          value={form.category}
          onChange={(e) => update("category", e.target.value)}
          className={inputClass}
        >
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <ImageUpload
        value={form.image}
        onChange={(url) => update("image", url)}
      />

      <div>
        <span className="block text-sm font-medium text-gray-700 mb-1">
          Additional photos ({form.images.length}/8)
        </span>
        {form.images.length > 0 && (
          <div className="flex flex-wrap gap-3 mb-2">
            {form.images.map((src, i) => (
              <div key={`${src}-${i}`} className="relative">
                <StoreImage
                  src={src}
                  alt={`Additional photo ${i + 1}`}
                  width={64}
                  height={64}
                  className="w-16 h-16 rounded-lg object-cover bg-[#F5F0E8]"
                />
                <button
                  type="button"
                  onClick={() =>
                    update(
                      "images",
                      form.images.filter((_, j) => j !== i)
                    )
                  }
                  aria-label={`Remove additional photo ${i + 1}`}
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center hover:bg-red-600"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        {form.images.length < 8 && (
          <ImageUpload
            value=""
            label="Add another photo"
            onChange={(url) => update("images", [...form.images, url])}
          />
        )}
        <p className="text-xs text-gray-500 mt-1">
          Customers click through these on the product page.
        </p>
      </div>

      <div>
        <label
          htmlFor={`item-details-${variantProduct ? "edit" : "new"}`}
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {showsIngredients ? "Ingredients" : "Item Details"} (optional)
        </label>
        <textarea
          id={`item-details-${variantProduct ? "edit" : "new"}`}
          value={form.itemDetails}
          onChange={(e) => update("itemDetails", e.target.value)}
          rows={3}
          placeholder={
            showsIngredients
              ? "e.g. Organic peanut butter, oat flour, eggs, honey"
              : "Materials, sizing, care instructions…"
          }
          className={inputClass}
        />
        <p className="text-xs text-gray-500 mt-1">
          Shown on the product page under Add to Cart
          {showsIngredients
            ? " — this category always shows an Ingredients section."
            : ", only when filled in."}
        </p>
      </div>

      {showsIngredients ? (
        <NutritionFactsFields
          rows={form.nutritionFacts}
          onChange={(rows) => update("nutritionFacts", rows)}
          idSuffix={variantProduct ? "edit" : "new"}
        />
      ) : (
        form.nutritionFacts.length > 0 && (
          // Recategorized to a non-edible category: the rows are kept
          // (never silently destroyed) but hidden from the storefront,
          // so offer a way to clear them rather than stranding them.
          <div className="bg-yellow-50 rounded-lg p-3">
            <p className="text-xs text-yellow-800">
              This product has {form.nutritionFacts.length} nutrition fact
              {form.nutritionFacts.length === 1 ? "" : "s"}, hidden because this
              category has no Ingredients section.
            </p>
            <button
              type="button"
              onClick={() => update("nutritionFacts", [])}
              className="mt-2 min-h-11 px-3 rounded-lg text-sm font-medium border border-yellow-400 text-yellow-800 hover:bg-yellow-100 transition"
            >
              Clear nutrition facts
            </button>
          </div>
        )
      )}

      <OptionGroupsEditor
        groups={form.optionGroups}
        onChange={(next) => update("optionGroups", next)}
        idSuffix={variantProduct ? "edit" : "new"}
      />

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

function EditProductRow({ product, categories, onSaved, onDeleted, onError }) {
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
      images: product.images ?? [],
      itemDetails: product.itemDetails ?? "",
      nutritionFacts: product.nutritionFacts ?? [],
      optionGroups: (product.optionGroups ?? []).map((g) => ({
        name: g.name,
        inputType: g.inputType,
        required: g.required,
        choices: (g.choices ?? []).map((c) => ({
          label: c.label,
          image: c.image ?? null,
        })),
      })),
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
        images: form.images,
        itemDetails: form.itemDetails,
        nutritionFacts: cleanNutrition(form.nutritionFacts),
        optionGroups: cleanOptionGroups(form.optionGroups),
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
    if (!window.confirm(`Delete "${product.name}"? This can't be undone.`))
      return;
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
        <StoreImage
          src={product.image}
          alt={product.name}
          width={56}
          height={56}
          className="w-14 h-14 rounded-lg object-cover bg-[#F5F0E8] shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[#2A4A52] truncate">
            {product.name}
          </p>
          <p className="text-xs text-gray-500 capitalize">
            {product.category}
            {product.featured && " · Featured"}
            {product.limitedQuantity != null && " · Limited drop"}
            {product.variants.length > 0 &&
              ` · ${product.variants.length} options`}
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
        <form
          onSubmit={save}
          className="mt-4 pt-4 border-t border-gray-100 space-y-4"
        >
          <ProductFields
            form={form}
            update={update}
            variantProduct={variantProduct}
            categories={categories}
          />
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
            {saving ? "Saving…" : "Save Changes"}
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
  const [categories, setCategories] = useState([]);
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
      api
        .get("/categories")
        .then((res) => setCategories(res.data.categories))
        .catch(() => setCategories([]));
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
        images: form.images,
        itemDetails: form.itemDetails,
        nutritionFacts: cleanNutrition(form.nutritionFacts),
        optionGroups: cleanOptionGroups(form.optionGroups),
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
        <p
          role="alert"
          className="text-red-500 text-sm bg-red-50 p-3 rounded-lg mb-6"
        >
          {error}
        </p>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Creation form: the fields that make up a product card. */}
        <form
          onSubmit={handleCreate}
          className="bg-white rounded-xl shadow-sm p-4 sm:p-6 space-y-4 self-start"
        >
          <h2 className="text-xl font-semibold text-[#2A4A52]">New Product</h2>
          {success && (
            <p
              role="status"
              className="text-green-700 text-sm bg-green-50 p-3 rounded-lg"
            >
              {success}
            </p>
          )}
          <ProductFields
            form={form}
            update={update}
            variantProduct={false}
            categories={categories}
          />
          <p className="text-xs text-gray-500">
            Stock status is set automatically: products with quantity 0 show as
            out of stock.
          </p>
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#C8722A] hover:bg-[#A85D1F] active:bg-[#8A4D1A] text-white py-3 rounded-lg font-semibold transition disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Create Product"}
          </button>
        </form>

        {/* Full catalog, including items hidden from the storefront. */}
        <div>
          <h2 className="text-xl font-semibold text-[#2A4A52] mb-4">
            Catalog ({products?.length ?? "…"})
          </h2>
          {products === null ? (
            <p className="text-gray-500">Loading products…</p>
          ) : (
            <div className="space-y-3">
              {products.map((p) => (
                <EditProductRow
                  categories={categories}
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
