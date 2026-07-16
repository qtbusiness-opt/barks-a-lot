import { z } from "zod";
import { normalizeCode } from "@/lib/promotions";

// Shared validation for admin promotion create/edit. A promotion is
// either a percent-off code or a mix-and-match bundle.
export const promotionSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    type: z.enum(["code", "bundle"]),
    active: z.boolean().default(true),
    code: z.string().trim().max(40).optional(),
    percentOff: z.number().int().min(1).max(100).optional(),
    bundleQuantity: z.number().int().min(2).max(50).optional(),
    bundlePrice: z.number().positive().max(100000).optional(),
    productIds: z.array(z.string().min(1)).max(50).optional(),
  })
  .superRefine((d, ctx) => {
    if (d.type === "code") {
      if (!d.code || normalizeCode(d.code).length === 0) {
        ctx.addIssue({ code: "custom", message: "A code is required", path: ["code"] });
      }
      if (d.percentOff === undefined) {
        ctx.addIssue({ code: "custom", message: "A percentage is required", path: ["percentOff"] });
      }
    } else {
      if (d.bundleQuantity === undefined) {
        ctx.addIssue({ code: "custom", message: "Set the bundle quantity", path: ["bundleQuantity"] });
      }
      if (d.bundlePrice === undefined) {
        ctx.addIssue({ code: "custom", message: "Set the bundle price", path: ["bundlePrice"] });
      }
      if (!d.productIds || d.productIds.length === 0) {
        ctx.addIssue({ code: "custom", message: "Choose at least one product", path: ["productIds"] });
      }
    }
  });

// Maps validated input to the Prisma row shape (clears fields that don't
// belong to the chosen type).
export function toPromotionData(data) {
  if (data.type === "code") {
    return {
      name: data.name,
      type: "code",
      active: data.active,
      code: normalizeCode(data.code),
      percentOff: data.percentOff,
      bundleQuantity: null,
      bundlePrice: null,
      productIds: null,
    };
  }
  return {
    name: data.name,
    type: "bundle",
    active: data.active,
    code: null,
    percentOff: null,
    bundleQuantity: data.bundleQuantity,
    bundlePrice: data.bundlePrice,
    productIds: JSON.stringify(data.productIds),
  };
}

// Turns a stored row into the client shape (productIds as an array).
export function serializePromotion(promo) {
  let productIds = [];
  try {
    const arr = JSON.parse(promo.productIds ?? "[]");
    if (Array.isArray(arr)) productIds = arr;
  } catch {
    productIds = [];
  }
  return { ...promo, productIds };
}
