import { Prisma } from "@prisma/client";

// Row-locks the products an order touches, for the rest of the caller's
// transaction. Every path that moves stock (checkout's decrement and every
// restock) takes this lock FIRST, before reading or writing any product or
// variant quantity.
//
// Why it's needed: Postgres runs these transactions at READ COMMITTED, so
// without a lock two checkouts for the last bag both read "1 left", both
// pass the stock check, and the second write lands on top of the first —
// the batch oversells (tests/api.test.mjs, "concurrent checkouts can't
// oversell"). With it, the second checkout waits, then reads the stock the
// first one left behind. Variant stock needs no lock of its own: it is
// only ever written by a transaction holding its product's lock.
//
// ORDER BY id makes every transaction lock in the same order, so a
// two-product checkout and a cancellation can't deadlock on each other.
// Parameterized through Prisma.join — never string-built SQL.
export async function lockProducts(tx, productIds) {
  const ids = [...new Set(productIds)];
  if (ids.length === 0) return;
  await tx.$queryRaw`SELECT id FROM "Product" WHERE id IN (${Prisma.join(
    ids
  )}) ORDER BY id FOR UPDATE`;
}

// Returns a cancelled order's line items to stock inside the caller's
// transaction — the exact mirror of the decrement in checkout, so a
// cancellation never leaks inventory.
export async function restockOrderItems(tx, items) {
  await lockProducts(
    tx,
    items.map((item) => item.productId)
  );
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
