import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

const CATEGORIES = ["treats", "toys", "accessories", "food"];

// The fields that make up a product card. inStock is derived from
// quantity rather than trusted from the client.
const productSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(2000),
  price: z.number().positive().max(10000),
  image: z.string().trim().min(1).max(300),
  category: z.enum(CATEGORIES),
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
    include: { variants: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ products });
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
    const product = await prisma.product.create({
      data: { ...data, inStock: data.quantity > 0 },
      include: { variants: true },
    });

    console.info(`[admin] product created id=${product.id} by=${auth.userId}`);
    return NextResponse.json({ product }, { status: 201 });
  } catch (err) {
    console.error("[admin] product create error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
