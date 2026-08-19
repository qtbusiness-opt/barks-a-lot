import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  isWithinWindow,
  publicProduct,
  PRODUCT_DETAIL_INCLUDE,
} from "@/lib/catalog";

export async function GET(_req, { params }) {
  const { id } = await params;

  // Products are addressed by their name slug. Ids still resolve so
  // links shared before slugs existed — and anything pointing at an
  // order's product id — keep working.
  const product =
    (await prisma.product.findUnique({
      where: { slug: id },
      include: PRODUCT_DETAIL_INCLUDE,
    })) ??
    (await prisma.product.findUnique({
      where: { id },
      include: PRODUCT_DETAIL_INCLUDE,
    }));

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  // The category's toggle decides whether the details section reads as
  // "Ingredients" (always shown) or "Item Details" (only when filled).
  const category = await prisma.category.findUnique({
    where: { slug: product.category },
  });

  // Direct links to an expired/not-yet-open drop still resolve; the UI
  // uses `available` to disable purchase. Stock counts are stripped to
  // booleans on the way out.
  return NextResponse.json({
    product: {
      ...publicProduct(product),
      available: isWithinWindow(product),
      categoryShowsIngredients: category?.showsIngredients ?? false,
    },
  });
}
