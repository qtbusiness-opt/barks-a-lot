import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public, read-only: drives the homepage tiles and the shop filter chips.
export async function GET() {
  const categories = await prisma.category.findMany({
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ categories });
}
