// Runs inside each test worker BEFORE that worker's test file is imported,
// so any app module (auth middleware, prisma client, etc.) that reads these
// env vars at import time always sees them already set.
//
// JWT_SECRET must be >= 32 chars or server/src/middleware/auth.ts throws at
// import time. DATABASE_URL is resolved by Prisma relative to
// prisma/schema.prisma, NOT the process cwd, so "file:./test.db" actually
// points at server/prisma/test.db (see globalSetup.ts, which prepares it).
process.env.JWT_SECRET = "test-only-jwt-secret-do-not-use-in-prod-0000";
process.env.DATABASE_URL = "file:./test.db";
process.env.CORS_ORIGIN = "http://localhost:5173";
