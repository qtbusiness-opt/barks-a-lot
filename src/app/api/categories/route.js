import { NextResponse } from "next/server";
import { getCategories } from "@/lib/storefront";

// Public, read-only: drives the homepage tiles and the shop filter chips.
export async function GET() {
  const categories = await getCategories();
  return NextResponse.json({ categories });
}
