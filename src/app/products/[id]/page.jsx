"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { useCart } from "@/context/CartContext";
import ProductOptions from "@/components/ProductOptions";
import {
  formatSelectedOptions,
  pickedImageChoice,
  isChoiceSelected,
} from "@/lib/options";
import GalleryColumn from "./_components/GalleryColumn";
import PriceAndStock from "./_components/PriceAndStock";
import PurchaseControls from "./_components/PurchaseControls";
import ProductDetails from "./_components/ProductDetails";
import {
  buildGallery,
  deriveSelectionState,
  productPhotosOf,
  slotFor,
} from "./_lib/product-view";

export default function ProductDetailPage() {
  const { id } = useParams();
  const { addItem } = useCart();
  const [product, setProduct] = useState(null);
  const [qty, setQuantity] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);
  // The photo belonging to the option choice the customer picked most
  // recently, or null when they haven't picked one with a photo:
  // { choiceId, src, label }.
  const [optionImage, setOptionImage] = useState(null);
  // { [groupId]: [choiceId, ...] }
  const [optionChoices, setOptionChoices] = useState({});
  const [optionError, setOptionError] = useState("");

  useEffect(() => {
    if (id) {
      api.get(`/products/${id}`).then((res) => {
        setProduct(res.data.product);
        setImageIndex(0);
        setOptionImage(null);
        setOptionChoices({});
      });
    }
  }, [id]);

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center text-gray-600">
        Loading...
      </div>
    );
  }

  const productPhotos = productPhotosOf(product);
  const photos = buildGallery(productPhotos, optionImage);
  const {
    optionGroups,
    missingGroup,
    combination,
    price,
    inStock,
    purchasable,
    chosenOptions,
  } = deriveSelectionState(product, optionChoices);

  // Picking a carousel thumbnail (or any choice with a photo) brings that
  // photo up as the main image — the customer sees the style they chose
  // at full size instead of at 64px. The product's own photos stay one
  // click away in the strip beneath it.
  const handleOptionChange = (next) => {
    setOptionError("");
    const picked = pickedImageChoice(optionGroups, optionChoices, next);
    if (picked) {
      setOptionImage(picked);
      setImageIndex(slotFor(productPhotos, picked.src));
    } else if (optionImage && !isChoiceSelected(next, optionImage.choiceId)) {
      // Its choice was unticked, so the photo goes with it. Only the
      // appended slot can dangle; an index into the product's own photos
      // is still valid.
      setOptionImage(null);
      setImageIndex((i) => (i >= productPhotos.length ? 0 : i));
    }
    setOptionChoices(next);
  };

  // The added-to-cart notice (drawer/bottom sheet) provides the feedback.
  const handleAdd = () => {
    if (missingGroup) {
      setOptionError(`Please choose a ${missingGroup.name}.`);
      return;
    }
    setOptionError("");
    addItem(
      {
        productId: product.id,
        variantId: combination?.id,
        name: combination
          ? `${product.name} — ${combination.name}`
          : product.name,
        price,
        // The chosen style's photo, when it has one, so the cart line and
        // the added-to-cart notice show what was actually picked rather
        // than the generic cover shot.
        image: optionImage?.src ?? product.image,
        options: chosenOptions.map((o) => ({
          groupId: o.groupId,
          choiceIds: o.choiceIds,
        })),
        optionsLabel: formatSelectedOptions(chosenOptions),
      },
      qty
    );
  };

  return (
    <div className="max-w-7xl mx-auto safe-x py-6 sm:py-10">
      <Link
        href="/products"
        className="inline-flex items-center min-h-11 text-[#3A6270] hover:underline mb-2 sm:mb-6"
      >
        &larr; Back to Products
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <GalleryColumn
          productName={product.name}
          photos={photos}
          imageIndex={imageIndex}
          setImageIndex={setImageIndex}
        />

        <div>
          <span className="text-sm text-[#3A6270] font-medium uppercase tracking-wide">
            {product.category}
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#2A4A52] mt-2">
            {product.name}
          </h1>

          {product.limitedQuantity != null && (
            <p className="inline-block bg-[#A85D1F] text-white text-sm font-semibold px-3 py-1 rounded-full mt-2">
              {inStock
                ? "Limited edition drop — get yours before it's gone"
                : "This limited drop has sold out"}
            </p>
          )}

          <PriceAndStock
            price={price}
            inStock={inStock}
            available={product.available}
          />
          <p className="text-brand-ink-2 mt-4 leading-relaxed">
            {product.description}
          </p>

          {/* Admin-defined choices — Size, Style, and so on — each shown
              the way the admin picked. When the product tracks option
              stock, the price above and availability below both follow
              these selections; there's no separate variant picker. */}
          <ProductOptions
            groups={optionGroups}
            selections={optionChoices}
            onChange={handleOptionChange}
          />

          {optionError && (
            <p
              role="alert"
              className="text-red-700 text-sm bg-red-50 p-3 rounded-lg mt-4"
            >
              {optionError}
            </p>
          )}

          <PurchaseControls
            qty={qty}
            onQtyChange={setQuantity}
            onAdd={handleAdd}
            available={product.available}
            missingGroup={missingGroup}
            purchasable={purchasable}
          />

          <ProductDetails
            showsIngredients={product.categoryShowsIngredients}
            itemDetails={product.itemDetails}
            nutritionFacts={product.nutritionFacts}
          />
        </div>
      </div>
    </div>
  );
}
