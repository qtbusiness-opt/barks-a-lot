import { sendEmail } from "@/lib/mailer";

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
    return order.pickupEvent
      ? `Pickup at ${order.pickupEvent.title} on ${fmtEventDate(order.pickupEvent)}${order.pickupEvent.location ? ` (${order.pickupEvent.location})` : ""}`
      : "Pickup at our next market/event";
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

// Confirmation sent when checkout completes. Email failures are logged,
// never surfaced — the order is already placed and paid.
export async function sendOrderConfirmationEmail(order) {
  const to = order.user?.email ?? order.guestEmail;
  if (!to) return;

  try {
    await sendEmail({
      to,
      subject: `Order confirmed — ${order.confirmationNumber}`,
      text: `Thanks for your order from Barks-A-Lot Treats & More!\n\nConfirmation number: ${order.confirmationNumber}\n\nItems:\n${itemLines(order)}\n\nTotal: $${order.total.toFixed(2)}\n${deliveryLine(order)}\n\nWe'll email you when your order's status changes.`,
    });
  } catch (err) {
    console.error(`[mail] order confirmation failed order=${order.id}:`, err);
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
      text: `${message}\n\n${deliveryLine(order)}\n\nQuestions? Reply to this email or reach us at info@barks-a-lot.com.`,
    });
  } catch (err) {
    console.error(`[mail] status email failed order=${order.id}:`, err);
  }
}
