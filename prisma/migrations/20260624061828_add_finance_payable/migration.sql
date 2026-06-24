-- CreateTable
CREATE TABLE "FinancePayable" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "payableNo" TEXT NOT NULL,
    "purchaseOrderId" INTEGER NOT NULL,
    "purchaseOrderNo" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "totalAmount" DECIMAL NOT NULL,
    "paidAmount" DECIMAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "remark" TEXT,
    "createdBy" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "paidAt" DATETIME,
    "voidAt" DATETIME,
    "voidReason" TEXT,
    CONSTRAINT "FinancePayable_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FinancePayment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "payableId" INTEGER NOT NULL,
    "amount" DECIMAL NOT NULL,
    "payMethod" TEXT NOT NULL,
    "payNo" TEXT,
    "operator" TEXT,
    "remark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinancePayment_payableId_fkey" FOREIGN KEY ("payableId") REFERENCES "FinancePayable" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "FinancePayable_payableNo_key" ON "FinancePayable"("payableNo");

-- CreateIndex
CREATE INDEX "FinancePayable_purchaseOrderId_idx" ON "FinancePayable"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "FinancePayable_status_idx" ON "FinancePayable"("status");

-- CreateIndex
CREATE INDEX "FinancePayment_payableId_idx" ON "FinancePayment"("payableId");
