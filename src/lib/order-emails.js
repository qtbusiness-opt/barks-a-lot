import { sendEmail, adminEmails } from "@/lib/mailer";
import { formatTimeRange } from "@/lib/pickup-window";

// event.date is a Date object when the order comes straight from Prisma
// and an ISO string when it has been through JSON — handle both.
const fmtEventDate = (event) => {
  const day =
    event.date instanceof Date
      ? event.date.toISOString().slice(0, 10)
      : String(event.date).slice(0, 10);
  return new Date(`${day}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
};

function deliveryLine(order) {
  if (order.fulfillmentType === "pickup") {
    if (!order.pickupEvent) return "Pickup at our next market/event";
    const times = formatTimeRange(order.pickupEvent);
    return `Pickup at ${order.pickupEvent.title} on ${fmtEventDate(order.pickupEvent)}${times ? `, ${times}` : ""}${order.pickupEvent.location ? ` (${order.pickupEvent.location})` : ""}`;
  }
  return `Shipping to ${order.address}, ${order.city}, ${order.state} ${order.zip}`;
}

function itemLines(order) {
  return order.items
    .map(
      (i) =>
        `  - ${i.product.name}${i.variant ? ` (${i.variant.name})` : ""} x ${i.quantity} — $${(i.price * i.quantity).toFixed(2)}`
    )
    .join("\n");
}

// Subtotal + discount lines, shown only when a promotion applied.
function totalsBlock(order) {
  if (order.discountTotal && order.discountTotal > 0) {
    const subtotal = order.total + order.discountTotal;
    return `Subtotal: $${subtotal.toFixed(2)}\nDiscount: -$${order.discountTotal.toFixed(2)}\nTotal: $${order.total.toFixed(2)}`;
  }
  return `Total: $${order.total.toFixed(2)}`;
}

// Confirmation sent when checkout completes. Email failures are logged,
// never surfaced — the order is already placed and paid.
export async function sendOrderConfirmationEmail(order) {
  const to = order.user?.email ?? order.guestEmail;
  if (!to) return;

  try {
    await sendEmail({
      to,
      subject: `Order confirmed — ${order.confirmationNumber}`,
      text: `Thanks for your order from Barks-A-Lot Treats & More!\n\nConfirmation number: ${order.confirmationNumber}\n\nItems:\n${itemLines(order)}\n\n${totalsBlock(order)}\n${deliveryLine(order)}\n\nWe'll email you when your order's status changes. If you have any questions, you can reach us at info@barks-a-lot.com.`,
      branded: true,
    });
  } catch (err) {
    console.error(`[mail] order confirmation failed order=${order.id}:`, err);
  }
}

// Internal heads-up to every admin whenever an order is placed. Failures
// are logged only — a mail hiccup must never fail a completed order.
export async function sendAdminOrderAlert(order) {
  try {
    const to = await adminEmails();
    if (to.length === 0) return;

    const customer = order.user
      ? `${order.user.name} (${order.user.email})`
      : `${order.guestName ? `${order.guestName} — ` : ""}${order.guestEmail} (guest)`;

    await sendEmail({
      to,
      subject: `New order ${order.confirmationNumber} — $${order.total.toFixed(2)}`,
      text: `A new order just came in.\n\nConfirmation number: ${order.confirmationNumber}\nCustomer: ${customer}\n\nItems:\n${itemLines(order)}\n\n${totalsBlock(order)}${order.promoCode ? `\nPromo code: ${order.promoCode}` : ""}\n${deliveryLine(order)}\n\nManage it in the admin dashboard under Orders.`,
    });
  } catch (err) {
    console.error(`[mail] admin order alert failed order=${order.id}:`, err);
  }
}

// Status-change email that accompanies the recorded customer notification.
export async function sendOrderStatusEmail(order, message) {
  const to = order.user?.email ?? order.guestEmail;
  if (!to) return;

  try {
    await sendEmail({
      to,
      subject: `Order update — ${order.confirmationNumber}`,
      text: `${message}\n\n${deliveryLine(order)}\n\nQuestions? You can reach us at info@barks-a-lot.com.`,
      branded: true,
    });
  } catch (err) {
    console.error(`[mail] status email failed order=${order.id}:`, err);
  }
}
