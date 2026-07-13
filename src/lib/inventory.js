// Returns a cancelled order's line items to stock inside the caller's
// transaction — the exact mirror of the decrement in checkout, so a
// cancellation never leaks inventory.
export async function restockOrderItems(tx, items) {
  for (const item of items) {
    if (item.variantId) {
      await tx.productVariant.update({
        where: { id: item.variantId },
        data: { quantity: { increment: item.quantity } },
      });
      // At least one variant has stock again.
      await tx.product.update({
        where: { id: item.productId },
        data: { inStock: true },
      });
    } else {
      await tx.product.update({
        where: { id: item.productId },
        data: { quantity: { increment: item.quantity }, inStock: true },
      });
    }
  }
}
