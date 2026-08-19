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

// All card fields optional — PATCH applies only what was sent. inStock
// unchecked wipes the stock: quantity goes to 0 (all variant quantities
// for variant products). Categories are admin-managed rows now, so the
// slug is validated against the table below rather than a fixed enum.
const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().min(1).max(2000).optional(),
  price: z.number().positive().max(10000).optional(),
  image: z.string().trim().min(1).max(300).optional(),
  images: z.array(z.string().trim().min(1).max(300)).max(8).optional(),
  // "" clears the field.
  itemDetails: z.string().trim().max(5000).optional(),
  // An empty array clears the nutrition table.
  nutritionFacts: z.array(nutritionRowSchema).max(30).optional(),
  // Omitted leaves the option groups alone; an empty array removes them.
  optionGroups: z.array(optionGroupSchema).max(6).optional(),
  category: z.string().trim().min(1).max(60).optional(),
  quantity: z.number().int().min(0).max(100000).optional(),
  featured: z.boolean().optional(),
  inStock: z.boolean().optional(),
});

export async function PATCH(req, { params }) {
  const auth = await getAuthUser();
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const parsed = updateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please check the product fields and try again" },
        { status: 400 }
      );
    }
    const { inStock, ...fields } = parsed.data;

    if (fields.category) {
      const known = await prisma.category.findUnique({
        where: { slug: fields.category },
      });
      if (!known) {
        return NextResponse.json(
          { error: "Please choose a valid category" },
          { status: 400 }
        );
      }
    }

    const existing = await prisma.product.findUnique({
      where: { id },
      include: { variants: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const hasVariants = existing.variants.length > 0;

    const product = await prisma.$transaction(async (tx) => {
      const { optionGroups, ...rest } = fields;
      const data = { ...rest };
      // Renaming a product moves its URL with it; old links keep working
      // because the detail route still resolves a bare id.
      if (fields.name !== undefined && fields.name !== existing.name) {
        data.slug = await uniqueProductSlug(tx, fields.name, id);
      } else if (!existing.slug) {
        // Backfill anything that predates slugs.
        data.slug = await uniqueProductSlug(tx, existing.name, id);
      }
      if (optionGroups !== undefined) {
        await writeOptionGroups(tx, id, optionGroups);
      }
      // Arrays/blank strings map to the stored representation.
      if (fields.images !== undefined) {
        data.images =
          fields.images.length > 0 ? JSON.stringify(fields.images) : null;
      }
      if (fields.itemDetails !== undefined) {
        data.itemDetails = fields.itemDetails || null;
      }
      if (fields.nutritionFacts !== undefined) {
        data.nutritionFacts =
          fields.nutritionFacts.length > 0
            ? JSON.stringify(fields.nutritionFacts)
            : null;
      }

      if (inStock === false) {
        // Unchecking In Stock wipes the stock everywhere.
        data.quantity = 0;
        data.inStock = false;
        if (hasVariants) {
          await tx.productVariant.updateMany({
            where: { productId: id },
            data: { quantity: 0 },
          });
        }
      } else {
        // Otherwise the flag follows the actual stock level.
        const quantity = data.quantity ?? existing.quantity;
        const variantStock = hasVariants
          ? existing.variants.reduce((sum, v) => sum + v.quantity, 0)
          : 0;
        data.inStock = hasVariants ? variantStock > 0 : quantity > 0;
      }

      return tx.product.update({
        where: { id },
        data,
        include: PRODUCT_DETAIL_INCLUDE,
      });
    });

    console.info(`[admin] product updated id=${id} by=${auth.userId}`);
    return NextResponse.json({ product: adminProduct(product) });
  } catch (err) {
    console.error("[admin] product update error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(_req, { params }) {
  const auth = await getAuthUser();
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const orderHistory = await prisma.orderItem.count({
      where: { productId: id },
    });
    if (orderHistory > 0) {
      // Order records must keep pointing at the product they sold —
      // hide it by unchecking In Stock instead of deleting.
      return NextResponse.json(
        {
          error:
            "This product has order history and can't be deleted. Uncheck In Stock to hide it instead.",
        },
        { status: 409 }
      );
    }

    await prisma.$transaction([
      prisma.productVariant.deleteMany({ where: { productId: id } }),
      prisma.product.delete({ where: { id } }),
    ]);

    console.info(`[admin] product deleted id=${id} by=${auth.userId}`);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin] product delete error:", err);
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
}
