import { SHIPPING_ENABLED } from "@/lib/features";

// Raw status values ("shipped", "delivered") stay in the database so no
// migration is needed when shipping returns — only the words shown to
// people change while the store is pickup-only.
export const ORDER_STATUS_LABELS = SHIPPING_ENABLED
  ? {
      pending: "Pending",
      shipped: "In Transit",
      delivered: "Complete",
      cancelled: "Cancelled",
    }
  : {
      pending: "Pending",
      shipped: "Ready for Pickup",
      delivered: "Picked Up",
      cancelled: "Cancelled",
    };

export const orderStatusLabel = (status) =>
  ORDER_STATUS_LABELS[status] ?? status;
