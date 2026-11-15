-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "pickupTime" TEXT;

-- CreateIndex
CREATE INDEX "Order_pickupDate_pickupTime_idx" ON "Order"("pickupDate", "pickupTime");
