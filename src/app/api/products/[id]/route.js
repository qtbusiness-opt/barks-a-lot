import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isWithinWindow, publicProduct } from "@/lib/catalog";

export async function GET(_req, { params }) {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    include: { variants: true },
  });

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  // Direct links to an expired/not-yet-open drop still resolve; the UI
  // uses `available` to disable purchase. Stock counts are stripped to
  // booleans on the way out.
  return NextResponse.json({
    product: { ...publicProduct(product), available: isWithinWindow(product) },
  });
}
