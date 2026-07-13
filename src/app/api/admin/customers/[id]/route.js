import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { issuePasswordResetEmail } from "@/lib/verification";

// Sends the customer the same password reset email they could request
// themselves — for when they call/ask at the market instead.
export async function POST(req, { params }) {
  const auth = await getAuthUser();
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const customer = await prisma.user.findUnique({ where: { id } });
    if (!customer || customer.role !== "customer") {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    await issuePasswordResetEmail(customer, new URL(req.url).origin);
    console.info(
      `[admin] password reset sent to customer=${customer.id} by=${auth.userId}`
    );

    return NextResponse.json({
      message: `Reset link sent to ${customer.email}.`,
    });
  } catch (err) {
    console.error("[admin] customer reset error:", err);
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
    const customer = await prisma.user.findUnique({ where: { id } });
    // Only customer accounts — admins are never deletable through this
    // endpoint, no matter what id gets posted.
    if (!customer || customer.role !== "customer") {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    await prisma.$transaction([
      // Order history is business data — keep it, re-labelled as guest
      // records that retain the contact details.
      prisma.order.updateMany({
        where: { userId: id },
        data: {
          userId: null,
          guestEmail: customer.email,
          guestName: customer.name,
        },
      }),
      // Verification/reset tokens cascade with the user row.
      prisma.user.delete({ where: { id } }),
    ]);

    console.info(`[admin] customer deleted id=${id} by=${auth.userId}`);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin] customer delete error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
