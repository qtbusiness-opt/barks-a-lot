"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { useCart } from "@/context/CartContext";

// Cover image plus any gallery extras. Clicking the photo advances to
// the next one; thumbnails jump straight to an image.
function GalleryColumn({ product, imageIndex, setImageIndex }) {
  const gallery = [product.image, ...(product.images ?? [])];
  const current = gallery[imageIndex] ?? gallery[0];
  const advance = () =>
    setImageIndex((i) => (i + 1) % gallery.length);

  if (gallery.length <= 1) {
    return (
      <div className="bg-[#F5F0E8] rounded-xl overflow-hidden self-start">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div className="self-start">
      <button
        type="button"
        onClick={advance}
        aria-label={`${product.name} photo ${imageIndex + 1} of ${gallery.length} — show next photo`}
        className="block w-full bg-[#F5F0E8] rounded-xl overflow-hidden cursor-pointer"
      >
        <img
          src={current}
          alt={`${product.name} — photo ${imageIndex + 1} of ${gallery.length}`}
          className="w-full aspect-square object-cover"
        />
      </button>
      <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
        {gallery.map((src, i) => (
          <button
            key={`${src}-${i}`}
            type="button"
            onClick={() => setImageIndex(i)}
            aria-label={`Show photo ${i + 1} of ${gallery.length}`}
            aria-current={imageIndex === i ? "true" : undefined}
            className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition ${
              imageIndex === i
                ? "border-[#4A7C8A]"
                : "border-transparent opacity-70 hover:opacity-100"
            }`}
          >
            <img src={src} alt="" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
      <p className="text-center text-xs text-gray-500 mt-2">
        Click the photo to see the next one
      </p>
    </div>
  );
}

function variantLabel(variant) {
  // attributes is a JSON string of tags, e.g. {"size":"small","pattern":"plaid"}
  try {
    const attrs = JSON.parse(variant.attributes || "{}");
    const dietary = Array.isArray(attrs.dietary) ? ` (${attrs.dietary.join(", ")})` : "";
    return `${variant.name}${dietary}`;
  } catch {
    return variant.name;
  }
}

export default function ProductDetailPage() {
  const { id } = useParams();
  const { addItem } = useCart();
  const [product, setProduct] = useState(null);
  const [variantId, setVariantId] = useState(null);
  const [qty, setQuantity] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);

  useEffect(() => {
    if (id) {
      api.get(`/products/${id}`).then((res) => {
        setProduct(res.data.product);
        setImageIndex(0);
      });
    }
  }, [id]);

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center text-gray-500">
        Loading...
      </div>
    );
  }

  const hasVariants = product.variants?.length > 0;
  const variant = hasVariants
    ? product.variants.find((v) => v.id === variantId) ?? null
    : null;
  const price = variant ? variant.price ?? product.price : product.price;
  // Availability is boolean-only on the storefront; exact counts live on
  // the admin side.
  const inStock = hasVariants
    ? variant
      ? variant.inStock
      : product.variants.some((v) => v.inStock)
    : product.inStock;
  const purchasable =
    product.available && inStock && (!hasVariants || variant !== null);

  // The added-to-cart notice (drawer/bottom sheet) provides the feedback.
  const handleAdd = () => {
    addItem(
      {
        productId: product.id,
        variantId: variant?.id,
        name: variant ? `${product.name} — ${variant.name}` : product.name,
        price,
        image: product.image,
      },
      qty
    );
  };

  return (
    <div className="max-w-7xl mx-auto safe-x py-6 sm:py-10">
      <Link href="/products" className="inline-flex items-center min-h-11 text-[#4A7C8A] hover:underline mb-2 sm:mb-6">
        &larr; Back to Products
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <GalleryColumn
          product={product}
          imageIndex={imageIndex}
          setImageIndex={setImageIndex}
        />

        <div>
          <span className="text-sm text-[#4A7C8A] font-medium uppercase tracking-wide">
            {product.category}
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#2A4A52] mt-2">{product.name}</h1>

          {product.limitedQuantity != null && (
            <p className="inline-block bg-[#C8722A] text-white text-sm font-semibold px-3 py-1 rounded-full mt-2">
              {inStock
                ? "Limited edition drop — get yours before it's gone"
                : "This limited drop has sold out"}
            </p>
          )}

          <p className="text-xl sm:text-2xl font-bold mt-4 justify-between flex items-center gap-4">
            <span className="text-[#C8722A]">${price.toFixed(2)}</span>
            <span className={inStock ? "text-green-600" : "text-red-600"}>
              {!product.available
                ? "Not currently available"
                : inStock
                ? "In Stock"
                : "Out of Stock"}
            </span>
          </p>
          <p className="text-gray-600 mt-4 leading-relaxed">{product.description}</p>

          {hasVariants && (
            <fieldset className="mt-6">
              <legend className="text-sm font-medium text-gray-700 mb-2">
                Options
              </legend>
              <div className="space-y-2">
                {product.variants.map((v) => (
                  <label
                    key={v.id}
                    className={`flex items-center justify-between gap-3 border rounded-lg px-4 py-3 cursor-pointer ${
                      variantId === v.id
                        ? "border-[#4A7C8A] bg-[#F5F0E8]"
                        : "border-gray-300"
                    } ${!v.inStock ? "opacity-50" : ""}`}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="variant"
                        value={v.id}
                        checked={variantId === v.id}
                        onChange={() => setVariantId(v.id)}
                        disabled={!v.inStock}
                      />
                      <span className="text-sm font-medium">{variantLabel(v)}</span>
                    </span>
                    <span className="text-sm text-gray-600">
                      ${(v.price ?? product.price).toFixed(2)}
                      {!v.inStock && " · Sold out"}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div className="mt-6 flex items-center gap-4">
            <label htmlFor="qty" className="text-sm font-medium text-gray-700">
              Qty:
            </label>
            <select
              id="qty"
              value={qty}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-2 min-h-11 text-base sm:text-sm"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleAdd}
            disabled={!purchasable}
            className={`mt-6 w-full sm:w-auto px-8 py-3 rounded-lg font-semibold text-white transition ${
              purchasable
                ? "bg-[#C8722A] hover:bg-[#A85D1F]"
                : "bg-gray-400 cursor-not-allowed"
            }`}
          >
            {!product.available
              ? "Not Available"
              : !inStock
              ? "Out of Stock"
              : hasVariants && !variant
              ? "Choose an Option"
              : "Add to Cart"}
          </button>

          {/* The category's admin-set toggle decides the flavor: an
              always-visible Ingredients section, or an Item Details
              section that only appears when filled in. */}
          {(product.categoryShowsIngredients || product.itemDetails) && (
            <div className="mt-8 bg-white rounded-xl shadow-sm p-4 sm:p-6">
              <h2 className="text-lg font-semibold text-[#2A4A52] mb-2">
                {product.categoryShowsIngredients
                  ? "Ingredients"
                  : "Item Details"}
              </h2>
              {product.itemDetails ? (
                <p className="text-gray-600 leading-relaxed whitespace-pre-line">
                  {product.itemDetails}
                </p>
              ) : (
                <p className="text-gray-500 text-sm">
                  Full ingredient list coming soon — ask us at the booth or
                  email info@barks-a-lot.com.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
