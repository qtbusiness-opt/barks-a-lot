import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { categorySchema, slugify } from "@/lib/categories";

export async function GET() {
  const auth = await getAuthUser();
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Include how many products use each slug so the UI can explain why a
  // category can't be deleted.
  const [categories, counts] = await Promise.all([
    prisma.category.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.product.groupBy({ by: ["category"], _count: { _all: true } }),
  ]);
  const countBySlug = Object.fromEntries(
    counts.map((c) => [c.category, c._count._all])
  );

  return NextResponse.json({
    categories: categories.map((c) => ({
      ...c,
      productCount: countBySlug[c.slug] ?? 0,
    })),
  });
}

export async function POST(req) {
  const auth = await getAuthUser();
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const parsed = categorySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please enter a category name (and optional emoji)" },
        { status: 400 }
      );
    }
    const slug = slugify(parsed.data.name);
    if (!slug) {
      return NextResponse.json(
        { error: "The category name needs at least one letter or number" },
        { status: 400 }
      );
    }

    const existing = await prisma.category.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json(
        { error: "A category with that name already exists" },
        { status: 409 }
      );
    }

    const category = await prisma.category.create({
      data: { name: parsed.data.name, icon: parsed.data.icon, slug },
    });
    console.info(`[admin] category created slug=${slug} by=${auth.userId}`);
    return NextResponse.json({ category }, { status: 201 });
  } catch (err) {
    console.error("[admin] category create error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
