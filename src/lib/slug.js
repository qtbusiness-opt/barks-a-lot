// URL-friendly product names for /products/<slug>.

// Lowercase, strip accents, collapse anything that isn't a letter or
// digit into single dashes. Mirrors the SQL used to backfill existing
// rows in the product_slugs_and_option_groups migration.
export function slugify(name) {
  return String(name ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// A slug no other product is using. Two products may legitimately share a
// name, so clashes get a numeric suffix rather than being rejected.
export async function uniqueProductSlug(db, name, excludeId) {
  const base = slugify(name) || "product";
  for (let n = 1; n <= 50; n += 1) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    const clash = await db.product.findFirst({
      where: {
        slug: candidate,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (!clash) return candidate;
  }
  // Absurdly unlikely; fall back to something guaranteed free.
  return `${base}-${Date.now()}`;
}
