import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { categorySchema, slugify } from "@/lib/categories";

// PATCH must not silently reset the toggle when a client omits it.
const patchSchema = categorySchema.extend({
  showsIngredients: z.boolean().optional(),
});

export async function PATCH(req, { params }) {
  const auth = await getAuthUser();
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please enter a category name (and optional emoji)" },
        { status: 400 }
      );
    }

    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const slug = slugify(parsed.data.name);
    if (!slug) {
      return NextResponse.json(
        { error: "The category name needs at least one letter or number" },
        { status: 400 }
      );
    }
    if (slug !== existing.slug) {
      const clash = await prisma.category.findUnique({ where: { slug } });
      if (clash) {
        return NextResponse.json(
          { error: "A category with that name already exists" },
          { status: 409 }
        );
      }
    }

    // A rename cascades the new slug to every product in the category so
    // filters and product records never point at a slug that's gone.
    const [category] = await prisma.$transaction([
      prisma.category.update({
        where: { id },
        data: {
          name: parsed.data.name,
          icon: parsed.data.icon,
          ...(parsed.data.showsIngredients !== undefined
            ? { showsIngredients: parsed.data.showsIngredients }
            : {}),
          slug,
        },
      }),
      prisma.product.updateMany({
        where: { category: existing.slug },
        data: { category: slug },
      }),
    ]);

    return NextResponse.json({ category });
  } catch (err) {
    console.error("[admin] category update error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(_req, { params }) {
  const auth = await getAuthUser();
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  // Products keep their category slug as plain data — deleting the
  // category out from under them would break their storefront filters.
  const inUse = await prisma.product.count({
    where: { category: category.slug },
  });
  if (inUse > 0) {
    return NextResponse.json(
      {
        error: `Move or delete the ${inUse} product${inUse === 1 ? "" : "s"} in "${category.name}" first`,
      },
      { status: 409 }
    );
  }

  await prisma.category.delete({ where: { id } });
  console.info(`[admin] category deleted slug=${category.slug} by=${auth.userId}`);
  return NextResponse.json({ success: true });
}
