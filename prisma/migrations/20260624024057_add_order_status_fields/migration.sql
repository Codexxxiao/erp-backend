/*
  Warnings:

  - Added the required column `locationId` to the `Order` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orderNo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "totalAmount" DECIMAL NOT NULL,
    "receiverName" TEXT NOT NULL,
    "receiverPhone" TEXT NOT NULL,
    "receiverAddress" TEXT NOT NULL,
    "remark" TEXT,
    "warehouseId" INTEGER NOT NULL,
    "locationId" INTEGER NOT NULL,
    "createdBy" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "shippedAt" DATETIME,
    "completedAt" DATETIME,
    "cancelledAt" DATETIME,
    "cancelReason" TEXT,
    "refundReason" TEXT,
    "refundedAt" DATETIME,
    CONSTRAINT "Order_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "InventoryLocation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("completedAt", "createdAt", "createdBy", "id", "orderNo", "receiverAddress", "receiverName", "receiverPhone", "remark", "shippedAt", "status", "totalAmount", "updatedAt", "warehouseId") SELECT "completedAt", "createdAt", "createdBy", "id", "orderNo", "receiverAddress", "receiverName", "receiverPhone", "remark", "shippedAt", "status", "totalAmount", "updatedAt", "warehouseId" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_orderNo_key" ON "Order"("orderNo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
