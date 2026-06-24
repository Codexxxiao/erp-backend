-- CreateTable
CREATE TABLE "FinanceReceivable" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "receivableNo" TEXT NOT NULL,
    "orderId" INTEGER NOT NULL,
    "orderNo" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "totalAmount" DECIMAL NOT NULL,
    "receivedAmount" DECIMAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "remark" TEXT,
    "createdBy" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "paidAt" DATETIME,
    "voidAt" DATETIME,
    "voidReason" TEXT,
    CONSTRAINT "FinanceReceivable_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FinanceReceipt" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "receivableId" INTEGER NOT NULL,
    "amount" DECIMAL NOT NULL,
    "payMethod" TEXT NOT NULL,
    "payNo" TEXT,
    "operator" TEXT,
    "remark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinanceReceipt_receivableId_fkey" FOREIGN KEY ("receivableId") REFERENCES "FinanceReceivable" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "FinanceReceivable_receivableNo_key" ON "FinanceReceivable"("receivableNo");

-- CreateIndex
CREATE INDEX "FinanceReceivable_orderId_idx" ON "FinanceReceivable"("orderId");

-- CreateIndex
CREATE INDEX "FinanceReceivable_status_idx" ON "FinanceReceivable"("status");

-- CreateIndex
CREATE INDEX "FinanceReceipt_receivableId_idx" ON "FinanceReceipt"("receivableId");
