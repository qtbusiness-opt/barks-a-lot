import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { visibleInListing, publicProduct } from "@/lib/catalog";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const featured = searchParams.get("featured");

  const where = {};
  if (category) where.category = category;
  if (featured === "true") where.featured = true;

  const products = await prisma.product.findMany({
    where,
    include: { variants: true },
    orderBy: { createdAt: "desc" },
  });

  // Availability windows and sold-out limited drops are filtered here
  // rather than in SQL — the catalog is small and the rules live in one
  // place (src/lib/catalog.js) shared with checkout. Stock counts are
  // stripped to booleans on the way out.
  return NextResponse.json({
    products: products.filter((p) => visibleInListing(p)).map(publicProduct),
  });
}
