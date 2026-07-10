import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isWithinWindow } from "@/lib/catalog";

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
  // uses `available` to disable purchase.
  return NextResponse.json({
    product: { ...product, available: isWithinWindow(product) },
  });
}
