import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { signToken } from "../src/middleware/auth";
import { checkoutCopy, renewLoan } from "../src/services/circulationService";

async function createBook() {
  return prisma.book.create({
    data: {
      isbn: `isbn-${randomUUID()}`,
      title: "Test Book",
      author: "Test Author",
    },
  });
}

async function createCopy(bookId: string, status = "AVAILABLE") {
  return prisma.copy.create({
    data: {
      barcode: `barcode-${randomUUID()}`,
      bookId,
      status,
    },
  });
}

async function createMember(overrides: Partial<{ role: string }> = {}) {
  return prisma.member.create({
    data: {
      name: "Test Member",
      email: `member-${randomUUID()}@example.com`,
      passwordHash: "unused-hash",
      role: overrides.role ?? "PATRON",
    },
  });
}

function tokenFor(member: { id: string; role: string; email: string; tokenVersion: number }) {
  return signToken({
    id: member.id,
    role: member.role as "PATRON" | "STAFF",
    email: member.email,
    tokenVersion: member.tokenVersion,
  });
}

// Restores the singleton settings row to the schema defaults so a PUT in one
// test doesn't leak persisted state into a later, unrelated test.
async function resetSettings() {
  await prisma.setting.upsert({
    where: { id: "global" },
    update: {
      loanPeriodDays: 14,
      maxRenewals: 2,
      holdReadyDays: 3,
      defaultBorrowLimit: 5,
    },
    create: {
      id: "global",
      loanPeriodDays: 14,
      maxRenewals: 2,
      holdReadyDays: 3,
      defaultBorrowLimit: 5,
    },
  });
}

// Every test here shares one global Setting row (by design -- it's a
// singleton), so reset it before and after each test to keep the effect of
// a PUT scoped to the test that issued it.
beforeEach(resetSettings);
afterEach(resetSettings);

describe("GET /api/settings", () => {
  it("returns 401 with no auth", async () => {
    const res = await request(app).get("/api/settings");
    expect(res.status).toBe(401);
  });

  it("returns 403 for a PATRON token", async () => {
    const patron = await createMember({ role: "PATRON" });
    const res = await request(app)
      .get("/api/settings")
      .set("Authorization", `Bearer ${tokenFor(patron)}`);
    expect(res.status).toBe(403);
  });

  it("returns 200 with the current values for a STAFF token", async () => {
    const staff = await createMember({ role: "STAFF" });

    const res = await request(app)
      .get("/api/settings")
      .set("Authorization", `Bearer ${tokenFor(staff)}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      loanPeriodDays: 14,
      maxRenewals: 2,
      holdReadyDays: 3,
      defaultBorrowLimit: 5,
    });
  });
});

describe("PUT /api/settings", () => {
  it("updates a value and it's reflected in a subsequent GET", async () => {
    const staff = await createMember({ role: "STAFF" });
    const authHeader = `Bearer ${tokenFor(staff)}`;

    const putRes = await request(app)
      .put("/api/settings")
      .set("Authorization", authHeader)
      .send({ holdReadyDays: 7 });

    expect(putRes.status).toBe(200);
    expect(putRes.body.holdReadyDays).toBe(7);

    const getRes = await request(app).get("/api/settings").set("Authorization", authHeader);
    expect(getRes.status).toBe(200);
    expect(getRes.body.holdReadyDays).toBe(7);
  });

  it("rejects an out-of-range value with 400 VALIDATION_ERROR", async () => {
    const staff = await createMember({ role: "STAFF" });
    const authHeader = `Bearer ${tokenFor(staff)}`;

    const zeroRes = await request(app)
      .put("/api/settings")
      .set("Authorization", authHeader)
      .send({ loanPeriodDays: 0 });
    expect(zeroRes.status).toBe(400);
    expect(zeroRes.body.code).toBe("VALIDATION_ERROR");

    const negativeRes = await request(app)
      .put("/api/settings")
      .set("Authorization", authHeader)
      .send({ loanPeriodDays: -1 });
    expect(negativeRes.status).toBe(400);
    expect(negativeRes.body.code).toBe("VALIDATION_ERROR");
  });

  it("rejects a PATRON token with 403", async () => {
    const patron = await createMember({ role: "PATRON" });
    const res = await request(app)
      .put("/api/settings")
      .set("Authorization", `Bearer ${tokenFor(patron)}`)
      .send({ loanPeriodDays: 21 });
    expect(res.status).toBe(403);
  });

  it("actually changes checkoutCopy's dueAt: a new loanPeriodDays is used, not the old hardcoded 14", async () => {
    const staff = await createMember({ role: "STAFF" });

    const putRes = await request(app)
      .put("/api/settings")
      .set("Authorization", `Bearer ${tokenFor(staff)}`)
      .send({ loanPeriodDays: 21 });
    expect(putRes.status).toBe(200);
    expect(putRes.body.loanPeriodDays).toBe(21);

    const book = await createBook();
    const copy = await createCopy(book.id);
    const member = await createMember();

    const before = Date.now();
    const loan = await checkoutCopy(copy.barcode, member.id);
    const dueAt = new Date(loan.dueAt).getTime();

    const daysUntilDue = (dueAt - before) / (24 * 60 * 60 * 1000);
    // Should be ~21 days out, not ~14 (allow slack for test execution time).
    expect(daysUntilDue).toBeGreaterThan(20);
    expect(daysUntilDue).toBeLessThan(22);
  });

  it("actually changes renewLoan's renewal limit: a raised maxRenewals allows a renewal that would have failed at the old default of 2", async () => {
    const staff = await createMember({ role: "STAFF" });

    const putRes = await request(app)
      .put("/api/settings")
      .set("Authorization", `Bearer ${tokenFor(staff)}`)
      .send({ maxRenewals: 3 });
    expect(putRes.status).toBe(200);
    expect(putRes.body.maxRenewals).toBe(3);

    const book = await createBook();
    const copy = await createCopy(book.id);
    const member = await createMember();

    const loan = await checkoutCopy(copy.barcode, member.id);
    // Bring the loan to renewalCount 2 -- the old hardcoded MAX_RENEWALS,
    // which would have rejected a further renewal.
    await prisma.loan.update({ where: { id: loan.id }, data: { renewalCount: 2 } });

    const renewed = await renewLoan(loan.id, { id: member.id, role: "PATRON" });
    expect(renewed.renewalCount).toBe(3);
  });
});
