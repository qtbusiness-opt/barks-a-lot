-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "trackOptionStock" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ProductOptionChoice" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "price" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "ProductOptionGroup" ADD COLUMN     "setsPrice" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ProductVariant" DROP COLUMN "attributes",
ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ProductVariantChoice" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "choiceId" TEXT NOT NULL,

    CONSTRAINT "ProductVariantChoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductVariantChoice_choiceId_idx" ON "ProductVariantChoice"("choiceId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariantChoice_variantId_choiceId_key" ON "ProductVariantChoice"("variantId", "choiceId");

-- CreateIndex
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");

-- AddForeignKey
ALTER TABLE "ProductVariantChoice" ADD CONSTRAINT "ProductVariantChoice_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariantChoice" ADD CONSTRAINT "ProductVariantChoice_choiceId_fkey" FOREIGN KEY ("choiceId") REFERENCES "ProductOptionChoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

