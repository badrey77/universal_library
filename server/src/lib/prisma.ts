import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

// SQLite locks the whole database file for writers; under concurrent access
// this makes readers/writers fail fast with SQLITE_BUSY instead of waiting.
// Setting a busy_timeout tells SQLite to retry internally for up to 5s before
// giving up, which smooths over brief overlaps between requests.
//
// Note: PRAGMA busy_timeout = N returns a row (the new timeout value), so it
// must go through $queryRawUnsafe -- $executeRawUnsafe rejects any raw call
// that returns results.
void prisma.$queryRawUnsafe("PRAGMA busy_timeout = 5000").catch((err) => {
  console.error("Failed to set SQLite busy_timeout pragma", err);
});
