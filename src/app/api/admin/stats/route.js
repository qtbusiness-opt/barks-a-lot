import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

// Counts backing the four dashboard panels.
export async function GET() {
  const auth = await getAuthUser();
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);

  const [
    totalOrders,
    pendingOrders,
    productsInStock,
    stockUnits,
    variantUnits,
    announcements,
    notifications,
    upcomingEvents,
    adminUsers,
    customers,
    categories,
    unreadMessages,
  ] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { status: "pending" } }),
    prisma.product.count({ where: { inStock: true } }),
    prisma.product.aggregate({ _sum: { quantity: true } }),
    prisma.productVariant.aggregate({ _sum: { quantity: true } }),
    prisma.announcement.count(),
    prisma.notification.count({ where: { archivedAt: null } }),
    prisma.event.count({ where: { date: { gte: startOfToday } } }),
    prisma.user.count({ where: { role: "admin" } }),
    prisma.user.count({ where: { role: "customer" } }),
    prisma.category.count(),
    prisma.contactMessage.count({ where: { readAt: null } }),
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
      upcomingEvents,
      adminUsers,
      customers,
      categories,
      unreadMessages,
    },
  });
}
