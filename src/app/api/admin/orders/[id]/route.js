import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

const statusSchema = z.object({
  status: z.enum(["pending", "shipped", "delivered", "cancelled"]),
});

const STATUS_MESSAGES = {
  pending: "is being prepared",
  shipped: "has shipped",
  delivered: "has been delivered",
  cancelled: "has been cancelled",
};

export async function PATCH(req, { params }) {
  const auth = await getAuthUser();
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const parsed = statusSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    const { status } = parsed.data;

    const order = await prisma.order.update({
      where: { id },
      data: { status },
      include: {
        items: { include: { product: true, variant: true } },
        user: { select: { name: true, email: true } },
        pickupEvent: true,
      },
    });

    // Record a customer notification tied to the order's email (account
    // email for customers, guest email for guest checkouts).
    const email = order.user?.email ?? order.guestEmail;
    if (email) {
      await prisma.notification.create({
        data: {
          email,
          orderId: order.id,
          message: `Your order ${order.confirmationNumber} ${STATUS_MESSAGES[status]}.`,
        },
      });
    }

    return NextResponse.json({ order });
  } catch {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
}
