import { NextResponse } from "next/server";
import { getListedProducts } from "@/lib/storefront";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const featured = searchParams.get("featured");

  // The listing rules (option groups included, availability windows and
  // sold-out limited drops filtered, stock counts stripped to booleans)
  // live in src/lib/storefront.js and src/lib/catalog.js, shared with the
  // home page.
  const products = await getListedProducts({
    category,
    featured: featured === "true",
  });
  return NextResponse.json({ products });
}
