import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

const CATEGORIES = ["treats", "toys", "accessories", "food"];

// All card fields optional — PATCH applies only what was sent. inStock
// unchecked wipes the stock: quantity goes to 0 (all variant quantities
// for variant products).
const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().min(1).max(2000).optional(),
  price: z.number().positive().max(10000).optional(),
  image: z.string().trim().min(1).max(300).optional(),
  category: z.enum(CATEGORIES).optional(),
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

    const existing = await prisma.product.findUnique({
      where: { id },
      include: { variants: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const hasVariants = existing.variants.length > 0;

    const product = await prisma.$transaction(async (tx) => {
      const data = { ...fields };

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
        include: { variants: true },
      });
    });

    console.info(`[admin] product updated id=${id} by=${auth.userId}`);
    return NextResponse.json({ product });
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
