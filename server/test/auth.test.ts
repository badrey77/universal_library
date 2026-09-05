import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";

// NOTE ON RATE LIMITING: /login is capped at 10 requests / 15 min per IP
// (see server/src/routes/auth.ts). Supertest hits the app from a single
// local address, so this file keeps its total login call count comfortably
// under that ceiling by reusing fixtures across assertions.

function uniqueEmail(): string {
  return `user-${crypto.randomUUID()}@example.com`;
}

const VALID_PASSWORD = "correct-horse-battery";

// There is no self-registration endpoint -- patron accounts are created by
// staff (see server/test/members.test.ts for POST /api/members coverage).
// These tests create a member directly to set up login fixtures.
async function createPatron(email: string, password: string = VALID_PASSWORD) {
  const passwordHash = await bcrypt.hash(password, 12);
  return prisma.member.create({
    data: { name: "Test User", email, passwordHash, role: "PATRON" },
  });
}

describe("POST /api/auth/login and GET /api/auth/me", () => {
  // Shared fixture for the whole describe block: one member backs several
  // assertions below instead of each test creating its own.
  const email = uniqueEmail();
  let loggedInToken: string;

  it("logs in with correct credentials and returns a token (fixture setup)", async () => {
    await createPatron(email);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email, password: VALID_PASSWORD });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe("string");
    loggedInToken = res.body.token;
  });

  it("rejects a wrong password for a real email with INVALID_CREDENTIALS", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "totally-wrong-password" });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("INVALID_CREDENTIALS");
  });

  it("rejects a nonexistent email with the same INVALID_CREDENTIALS code (anti-enumeration)", async () => {
    // Deliberately the same code as a wrong password above -- this is by
    // design (prevents attackers from probing which emails are registered),
    // not a bug to fix.
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: uniqueEmail(), password: "whatever-password" });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("INVALID_CREDENTIALS");
  });

  it("GET /me rejects requests with no Authorization header", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("MISSING_TOKEN");
  });

  it("GET /me rejects a garbage bearer token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer not-a-real-jwt");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("INVALID_TOKEN");
  });

  it("GET /me returns the member's data for a valid token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${loggedInToken}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(email);
  });
});

describe("POST /api/auth/logout", () => {
  it("revokes the token immediately: reusing it afterward returns TOKEN_REVOKED", async () => {
    const email = uniqueEmail();
    await createPatron(email);

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email, password: VALID_PASSWORD });
    const token = loginRes.body.token as string;

    const logoutRes = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${token}`);
    expect(logoutRes.status).toBe(204);

    const meRes = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(meRes.status).toBe(401);
    expect(meRes.body.code).toBe("TOKEN_REVOKED");
  });
});
