-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "options" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "slug" TEXT;

-- Backfill slugs for products created before this column existed, so
-- existing links and the storefront switch over without a manual step.
-- Duplicate names get a numeric suffix; a name with no usable characters
-- is left NULL and keeps resolving by id.
UPDATE "Product" p
SET "slug" = s.candidate
FROM (
  SELECT id,
         base || CASE WHEN rn = 1 THEN '' ELSE '-' || rn END AS candidate
  FROM (
    SELECT id,
           NULLIF(trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')), '') AS base,
           row_number() OVER (
             PARTITION BY NULLIF(trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')), '')
             ORDER BY "createdAt", id
           ) AS rn
    FROM "Product"
  ) t
  WHERE base IS NOT NULL
) s
WHERE p.id = s.id;


-- CreateTable
CREATE TABLE "ProductOptionGroup" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inputType" TEXT NOT NULL DEFAULT 'radio',
    "required" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductOptionGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductOptionChoice" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "image" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductOptionChoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductOptionGroup_productId_idx" ON "ProductOptionGroup"("productId");

-- CreateIndex
CREATE INDEX "ProductOptionChoice_groupId_idx" ON "ProductOptionChoice"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- AddForeignKey
ALTER TABLE "ProductOptionGroup" ADD CONSTRAINT "ProductOptionGroup_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOptionChoice" ADD CONSTRAINT "ProductOptionChoice_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ProductOptionGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

