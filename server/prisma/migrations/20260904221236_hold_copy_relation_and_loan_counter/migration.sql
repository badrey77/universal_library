-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Hold" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "expiresAt" DATETIME,
    "bookId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "copyId" TEXT,
    CONSTRAINT "Hold_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Hold_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Hold_copyId_fkey" FOREIGN KEY ("copyId") REFERENCES "Copy" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Hold" ("bookId", "copyId", "expiresAt", "id", "memberId", "requestedAt", "status") SELECT "bookId", "copyId", "expiresAt", "id", "memberId", "requestedAt", "status" FROM "Hold";
DROP TABLE "Hold";
ALTER TABLE "new_Hold" RENAME TO "Hold";
CREATE INDEX "Hold_bookId_status_idx" ON "Hold"("bookId", "status");
CREATE INDEX "Hold_memberId_status_idx" ON "Hold"("memberId", "status");
CREATE INDEX "Hold_copyId_idx" ON "Hold"("copyId");
CREATE TABLE "new_Member" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'PATRON',
    "borrowLimit" INTEGER NOT NULL DEFAULT 5,
    "activeLoanCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Member" ("borrowLimit", "createdAt", "email", "id", "name", "passwordHash", "role") SELECT "borrowLimit", "createdAt", "email", "id", "name", "passwordHash", "role" FROM "Member";
DROP TABLE "Member";
ALTER TABLE "new_Member" RENAME TO "Member";
CREATE UNIQUE INDEX "Member_email_key" ON "Member"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
