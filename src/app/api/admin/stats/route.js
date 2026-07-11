import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

// Counts backing the four dashboard panels.
export async function GET() {
  const auth = await getAuthUser();
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [
    totalOrders,
    pendingOrders,
    productsInStock,
    stockUnits,
    variantUnits,
    announcements,
    notifications,
  ] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { status: "pending" } }),
    prisma.product.count({ where: { inStock: true } }),
    prisma.product.aggregate({ _sum: { quantity: true } }),
    prisma.productVariant.aggregate({ _sum: { quantity: true } }),
    prisma.announcement.count(),
    prisma.notification.count(),
  ]);

  return NextResponse.json({
    stats: {
      orders: { total: totalOrders, pending: pendingOrders },
      products: {
        inStock: productsInStock,
        units: (stockUnits._sum.quantity ?? 0) + (variantUnits._sum.quantity ?? 0),
      },
      announcements,
      notifications,
    },
  });
}
