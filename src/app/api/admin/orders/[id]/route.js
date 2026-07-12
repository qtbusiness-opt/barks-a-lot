import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { sendOrderStatusEmail } from "@/lib/order-emails";
import { SHIPPING_ENABLED } from "@/lib/features";

const statusSchema = z.object({
  status: z.enum(["pending", "shipped", "delivered", "cancelled"]),
});

// While pickup-only, the "shipped"/"delivered" statuses keep their raw
// values but read as pickup milestones in customer notifications.
const STATUS_MESSAGES = {
  pending: "is being prepared",
  shipped: SHIPPING_ENABLED ? "has shipped" : "is ready for pickup",
  delivered: SHIPPING_ENABLED ? "has been delivered" : "has been picked up",
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
      const message = `Your order ${order.confirmationNumber} ${STATUS_MESSAGES[status]}.`;
      await prisma.notification.create({
        data: { email, orderId: order.id, message },
      });
      // The recorded notification is the source of truth; the email is
      // best-effort delivery of the same message.
      await sendOrderStatusEmail(order, message);
    }

    return NextResponse.json({ order });
  } catch {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
}
