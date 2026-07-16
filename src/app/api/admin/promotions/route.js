import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import {
  promotionSchema,
  toPromotionData,
  serializePromotion,
} from "@/lib/promotion-input";

export async function GET() {
  const auth = await getAuthUser();
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const promotions = await prisma.promotion.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ promotions: promotions.map(serializePromotion) });
}

export async function POST(req) {
  const auth = await getAuthUser();
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const parsed = promotionSchema.safeParse(await req.json());
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message || "Please check the fields";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const data = toPromotionData(parsed.data);

    if (data.type === "code") {
      const clash = await prisma.promotion.findUnique({
        where: { code: data.code },
      });
      if (clash) {
        return NextResponse.json(
          { error: "That code is already in use" },
          { status: 409 }
        );
      }
    }

    const promotion = await prisma.promotion.create({ data });
    console.info(`[admin] promotion created id=${promotion.id} by=${auth.userId}`);
    return NextResponse.json(
      { promotion: serializePromotion(promotion) },
      { status: 201 }
    );
  } catch (err) {
    console.error("[admin] promotion create error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
