import { execSync } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";

// Same env vars as test/setup.ts — needed here too so the `prisma migrate
// deploy` child process below targets the test database, not dev.db.
const TEST_DATABASE_URL = "file:./test.db";

// Vitest calls this once, in the main process, before any worker/test file
// runs. It gives every test file a freshly migrated, empty-of-stale-runs
// test database to start from. Individual tests must not otherwise assume
// an empty DB (they may run in parallel against tables with other tests'
// fixtures already in them) — they should use unique emails/barcodes/ISBNs.
export default async function globalSetup() {
  process.env.JWT_SECRET = "test-only-jwt-secret-do-not-use-in-prod-0000";
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.CORS_ORIGIN = "http://localhost:5173";

  // DATABASE_URL="file:./test.db" resolves relative to prisma/schema.prisma,
  // NOT the process cwd — so the real file lives at server/prisma/test.db.
  const prismaDir = resolve(__dirname, "..", "prisma");
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    const file = resolve(prismaDir, `test.db${suffix}`);
    if (existsSync(file)) unlinkSync(file);
  }

  execSync("npx prisma migrate deploy", {
    cwd: resolve(__dirname, ".."),
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "inherit",
  });
}
