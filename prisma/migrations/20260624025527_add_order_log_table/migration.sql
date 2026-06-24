-- CreateTable
CREATE TABLE "OrderLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orderId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "operator" TEXT,
    "beforeStatus" TEXT,
    "afterStatus" TEXT,
    "remark" TEXT,
    "ip" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "OrderLog_orderId_idx" ON "OrderLog"("orderId");
