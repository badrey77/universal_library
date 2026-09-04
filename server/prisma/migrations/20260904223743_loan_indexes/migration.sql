-- CreateIndex
CREATE INDEX "Loan_memberId_returnedAt_idx" ON "Loan"("memberId", "returnedAt");

-- CreateIndex
CREATE INDEX "Loan_copyId_returnedAt_idx" ON "Loan"("copyId", "returnedAt");
