import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().trim().min(1).max(40),
  icon: z.string().trim().min(1).max(8).default("🐾"),
  // Products in the category show an always-on "Ingredients" section
  // instead of the optional "Item Details" one.
  showsIngredients: z.boolean().default(false),
});

// The slug is what products store; it's derived from the name so the
// two can't disagree.
export const slugify = (name) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
