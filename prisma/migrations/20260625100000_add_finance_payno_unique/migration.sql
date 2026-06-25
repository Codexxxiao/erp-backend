-- CreateIndex
CREATE UNIQUE INDEX "FinanceReceipt_payNo_key" ON "FinanceReceipt"("payNo");

-- CreateIndex
CREATE UNIQUE INDEX "FinancePayment_payNo_key" ON "FinancePayment"("payNo");
