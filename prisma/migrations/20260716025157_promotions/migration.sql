-- CreateTable
CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "code" TEXT,
    "percentOff" INTEGER,
    "bundleQuantity" INTEGER,
    "bundlePrice" REAL,
    "productIds" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "confirmationNumber" TEXT NOT NULL,
    "userId" TEXT,
    "guestEmail" TEXT,
    "guestName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "channel" TEXT NOT NULL DEFAULT 'online',
    "fulfillmentType" TEXT NOT NULL DEFAULT 'shipping',
    "pickupEventId" TEXT,
    "total" REAL NOT NULL,
    "paymentId" TEXT,
    "refunded" BOOLEAN NOT NULL DEFAULT false,
    "discountTotal" REAL NOT NULL DEFAULT 0,
    "promoCode" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_pickupEventId_fkey" FOREIGN KEY ("pickupEventId") REFERENCES "Event" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("address", "channel", "city", "confirmationNumber", "createdAt", "fulfillmentType", "guestEmail", "guestName", "id", "paymentId", "pickupEventId", "refunded", "state", "status", "total", "updatedAt", "userId", "zip") SELECT "address", "channel", "city", "confirmationNumber", "createdAt", "fulfillmentType", "guestEmail", "guestName", "id", "paymentId", "pickupEventId", "refunded", "state", "status", "total", "updatedAt", "userId", "zip" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_confirmationNumber_key" ON "Order"("confirmationNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Promotion_code_key" ON "Promotion"("code");
