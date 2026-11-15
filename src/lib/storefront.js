import { prisma } from "@/lib/prisma";
import {
  visibleInListing,
  publicProduct,
  PRODUCT_DETAIL_INCLUDE,
} from "@/lib/catalog";
import { storeTodayStartUtc } from "@/lib/pickup-window";

// Public read helpers shared by the storefront pages and the matching
// /api routes, so the rules (what counts as listable, newest first) live
// in one place and the page cannot drift from the API.

// Listable products, newest first. Option groups are included so a card
// knows a product has required choices before it ever renders. Availability
// windows and sold-out limited drops are filtered here, and stock counts are
// stripped to booleans on the way out.
export async function getListedProducts({ category, featured } = {}) {
  const where = {};
  if (category) where.category = category;
  if (featured) where.featured = true;

  const products = await prisma.product.findMany({
    where,
    include: PRODUCT_DETAIL_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return products.filter((p) => visibleInListing(p)).map(publicProduct);
}

export function getCategories() {
  return prisma.category.findMany({ orderBy: { createdAt: "asc" } });
}

// The newest announcement, or null. The storefront shows it as a banner.
export function getLatestAnnouncement() {
  return prisma.announcement.findFirst({
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, body: true, createdAt: true },
  });
}

// The next market/event from today on (store time), or null.
export function getNextEvent() {
  return prisma.event.findFirst({
    where: { date: { gte: storeTodayStartUtc() } },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });
}

// Only the fields ProductCard reads. Keeps descriptions, nutrition facts
// and the like out of the serialized props that cross into the client.
export function cardProps(product) {
  const {
    id,
    slug,
    name,
    price,
    image,
    category,
    inStock,
    variants,
    optionGroups,
    trackOptionStock,
    limitedQuantity,
  } = product;
  return {
    id,
    slug,
    name,
    price,
    image,
    category,
    inStock,
    variants,
    optionGroups,
    trackOptionStock,
    limitedQuantity,
  };
}
