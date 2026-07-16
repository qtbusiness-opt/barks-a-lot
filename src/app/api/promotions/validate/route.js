import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { computeDiscounts } from "@/lib/promotions";
import { isWithinWindow } from "@/lib/catalog";

const schema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        variantId: z.string().min(1).optional(),
        quantity: z.number().int().min(1).max(100),
      })
    )
    .min(1),
  code: z.string().trim().max(40).optional(),
});

// Preview the discount for a cart (+ optional code) so checkout can show
// it before payment. Prices are resolved server-side; the authoritative
// re-computation happens again at order creation.
export async function POST(req) {
  if (!rateLimit("promo-validate", req)) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again in a minute." },
      { status: 429 }
    );
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid cart" }, { status: 400 });
  }
  const { items, code } = parsed.data;

  const products = await prisma.product.findMany({
    where: { id: { in: items.map((i) => i.productId) } },
    include: { variants: true },
  });
  const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

  // Resolve each line to its server price; silently skip anything that no
  // longer exists or is out of its availability window (a preview only).
  const lines = [];
  for (const item of items) {
    const product = productMap[item.productId];
    if (!product || !isWithinWindow(product)) continue;
    let price = product.price;
    if (product.variants.length > 0) {
      const variant = product.variants.find((v) => v.id === item.variantId);
      if (!variant) continue;
      price = variant.price ?? product.price;
    }
    lines.push({ productId: product.id, price, quantity: item.quantity });
  }

  if (lines.length === 0) {
    return NextResponse.json({
      subtotal: 0,
      discountTotal: 0,
      total: 0,
      applied: [],
      codeError: null,
    });
  }

  const promotions = await prisma.promotion.findMany({ where: { active: true } });
  const result = computeDiscounts({ lines, promotions, code });
  return NextResponse.json(result);
}
