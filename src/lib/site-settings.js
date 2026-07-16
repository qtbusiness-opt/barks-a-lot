import { prisma } from "@/lib/prisma";

// Re-export the client-safe constants so server code has one import site.
export { ABOUT_IMAGE_KEYS, ALLOWED_SETTING_KEYS } from "@/lib/about-images";

// Returns a { key: value } map for the requested keys (missing → absent).
export async function getSettings(keys) {
  const rows = await prisma.siteSetting.findMany({
    where: { key: { in: keys } },
  });
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
