import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app";

// NOTE ON RATE LIMITING: /register and /login share one express-rate-limit
// instance capped at 10 requests / 15 min per IP (see server/src/routes/auth.ts).
// Supertest hits the app from a single local address, so this file is careful
// to keep its total register+login call count comfortably under that ceiling
// by reusing fixtures across assertions instead of re-registering per test.

function uniqueEmail(): string {
  return `user-${crypto.randomUUID()}@example.com`;
}

const VALID_PASSWORD = "correct-horse-battery";

async function registerUser(email: string, password: string = VALID_PASSWORD) {
  return request(app)
    .post("/api/auth/register")
    .send({ name: "Test User", email, password });
}

describe("POST /api/auth/register", () => {
  it("registers a new member with valid data, then rejects re-registering the same email", async () => {
    const email = uniqueEmail();

    const res = await registerUser(email);
    expect(res.status).toBe(201);
    expect(typeof res.body.token).toBe("string");
    expect(res.body.member).toBeTruthy();
    expect(res.body.member.email).toBe(email);

    const dupe = await registerUser(email);
    expect(dupe.status).toBe(409);
    expect(dupe.body.code).toBe("EMAIL_TAKEN");
  });

  it("rejects a password under 10 characters with VALIDATION_ERROR", async () => {
    const res = await registerUser(uniqueEmail(), "short1");
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });
});

describe("POST /api/auth/login and GET /api/auth/me", () => {
  // Shared fixture for the whole describe block: one register call backs
  // several assertions below instead of each test registering its own user.
  const email = uniqueEmail();
  let registeredToken: string;

  it("logs in with correct credentials and returns a token (fixture setup)", async () => {
    const registerRes = await registerUser(email);
    expect(registerRes.status).toBe(201);
    registeredToken = registerRes.body.token;

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email, password: VALID_PASSWORD });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe("string");
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
      .set("Authorization", `Bearer ${registeredToken}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(email);
  });
});

describe("POST /api/auth/logout", () => {
  it("revokes the token immediately: reusing it afterward returns TOKEN_REVOKED", async () => {
    const email = uniqueEmail();
    const registerRes = await registerUser(email);
    const token = registerRes.body.token as string;

    const logoutRes = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${token}`);
    expect(logoutRes.status).toBe(204);

    const meRes = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(meRes.status).toBe(401);
    expect(meRes.body.code).toBe("TOKEN_REVOKED");
  });
});
