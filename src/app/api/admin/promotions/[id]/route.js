import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import {
  promotionSchema,
  toPromotionData,
  serializePromotion,
} from "@/lib/promotion-input";

export async function PATCH(req, { params }) {
  const auth = await getAuthUser();
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const parsed = promotionSchema.safeParse(await req.json());
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message || "Please check the fields";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const data = toPromotionData(parsed.data);

    const existing = await prisma.promotion.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Promotion not found" }, { status: 404 });
    }

    // A code moving to a code already used by a different promotion clashes.
    if (data.type === "code") {
      const clash = await prisma.promotion.findUnique({
        where: { code: data.code },
      });
      if (clash && clash.id !== id) {
        return NextResponse.json(
          { error: "That code is already in use" },
          { status: 409 }
        );
      }
    }

    const promotion = await prisma.promotion.update({ where: { id }, data });
    return NextResponse.json({ promotion: serializePromotion(promotion) });
  } catch (err) {
    console.error("[admin] promotion update error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(_req, { params }) {
  const auth = await getAuthUser();
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await prisma.promotion.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Promotion not found" }, { status: 404 });
  }
}
