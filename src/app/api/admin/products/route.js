import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import {
  adminProduct,
  nutritionRowSchema,
  PRODUCT_DETAIL_INCLUDE,
} from "@/lib/catalog";
import { uniqueProductSlug } from "@/lib/slug";
import { optionGroupSchema, writeOptionGroups } from "@/lib/option-writes";

// The fields that make up a product card. inStock is derived from
// quantity rather than trusted from the client. Categories are
// admin-managed rows, so the slug is checked against the table in POST.
const productSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(2000),
  price: z.number().positive().max(10000),
  image: z.string().trim().min(1).max(300),
  // Additional gallery images beyond the cover.
  images: z.array(z.string().trim().min(1).max(300)).max(8).default([]),
  // Ingredients (treats/food) or item details (everything else).
  itemDetails: z.string().trim().max(5000).optional(),
  // Nutrition facts table rows, for edible categories.
  nutritionFacts: z.array(nutritionRowSchema).max(30).default([]),
  // Customer-facing choices (Size, Style, ...) shown on the product page.
  optionGroups: z.array(optionGroupSchema).max(6).default([]),
  category: z.string().trim().min(1).max(60),
  quantity: z.number().int().min(0).max(100000),
  featured: z.boolean().default(false),
});

export async function GET() {
  const auth = await getAuthUser();
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Admins see the full catalog: expired drops and sold-out limited items
  // included, unlike the public listing.
  const products = await prisma.product.findMany({
    include: PRODUCT_DETAIL_INCLUDE,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ products: products.map(adminProduct) });
}

export async function POST(req) {
  const auth = await getAuthUser();
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const parsed = productSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please fill out all product fields correctly" },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const known = await prisma.category.findUnique({
      where: { slug: data.category },
    });
    if (!known) {
      return NextResponse.json(
        { error: "Please choose a valid category" },
        { status: 400 }
      );
    }

    const { images, itemDetails, nutritionFacts, optionGroups, ...rest } = data;
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          ...rest,
          slug: await uniqueProductSlug(tx, data.name),
          images: images.length > 0 ? JSON.stringify(images) : null,
          itemDetails: itemDetails || null,
          nutritionFacts:
            nutritionFacts.length > 0 ? JSON.stringify(nutritionFacts) : null,
          inStock: data.quantity > 0,
        },
      });
      if (optionGroups.length > 0) {
        await writeOptionGroups(tx, created.id, optionGroups);
      }
      return tx.product.findUnique({
        where: { id: created.id },
        include: PRODUCT_DETAIL_INCLUDE,
      });
    });

    console.info(`[admin] product created id=${product.id} by=${auth.userId}`);
    return NextResponse.json(
      { product: adminProduct(product) },
      { status: 201 }
    );
  } catch (err) {
    console.error("[admin] product create error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
