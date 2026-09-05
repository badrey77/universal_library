-- CreateTable
CREATE TABLE "Setting" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'global',
    "loanPeriodDays" INTEGER NOT NULL DEFAULT 14,
    "maxRenewals" INTEGER NOT NULL DEFAULT 2,
    "holdReadyDays" INTEGER NOT NULL DEFAULT 3,
    "defaultBorrowLimit" INTEGER NOT NULL DEFAULT 5,
    "updatedAt" DATETIME NOT NULL
);
