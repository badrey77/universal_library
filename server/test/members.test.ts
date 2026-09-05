import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { signToken } from "../src/middleware/auth";
import { checkoutCopy, returnCopy } from "../src/services/circulationService";

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

describe("POST /api/members", () => {
  it("creates a PATRON member and returns its public shape", async () => {
    const staff = await createMember({ role: "STAFF" });
    const email = `newpatron-${randomUUID()}@example.com`;

    const res = await request(app)
      .post("/api/members")
      .set("Authorization", `Bearer ${tokenFor(staff)}`)
      .send({ name: "New Patron", email, password: "supersecretpw" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: "New Patron", email, role: "PATRON" });
    expect(typeof res.body.id).toBe("string");
    expect(typeof res.body.borrowLimit).toBe("number");
    expect(res.body.passwordHash).toBeUndefined();

    const stored = await prisma.member.findUnique({ where: { id: res.body.id } });
    expect(stored?.role).toBe("PATRON");
  });

  it("honors an explicit borrowLimit override", async () => {
    const staff = await createMember({ role: "STAFF" });
    const email = `newpatron-${randomUUID()}@example.com`;

    const res = await request(app)
      .post("/api/members")
      .set("Authorization", `Bearer ${tokenFor(staff)}`)
      .send({ name: "Custom Limit Patron", email, password: "supersecretpw", borrowLimit: 12 });

    expect(res.status).toBe(201);
    expect(res.body.borrowLimit).toBe(12);
  });

  it("returns 409 EMAIL_TAKEN for a duplicate email", async () => {
    const staff = await createMember({ role: "STAFF" });
    const existing = await createMember();

    const res = await request(app)
      .post("/api/members")
      .set("Authorization", `Bearer ${tokenFor(staff)}`)
      .send({ name: "Someone", email: existing.email, password: "supersecretpw" });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("EMAIL_TAKEN");
  });

  it("returns 400 VALIDATION_ERROR for a password under 10 characters", async () => {
    const staff = await createMember({ role: "STAFF" });

    const res = await request(app)
      .post("/api/members")
      .set("Authorization", `Bearer ${tokenFor(staff)}`)
      .send({ name: "Someone", email: `short-${randomUUID()}@example.com`, password: "short" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("returns 403 for a non-staff (PATRON) token", async () => {
    const patron = await createMember({ role: "PATRON" });

    const res = await request(app)
      .post("/api/members")
      .set("Authorization", `Bearer ${tokenFor(patron)}`)
      .send({ name: "Someone", email: `blocked-${randomUUID()}@example.com`, password: "supersecretpw" });

    expect(res.status).toBe(403);
  });

  it("returns 401 with no auth", async () => {
    const res = await request(app)
      .post("/api/members")
      .send({ name: "Someone", email: `noauth-${randomUUID()}@example.com`, password: "supersecretpw" });

    expect(res.status).toBe(401);
  });
});

describe("GET /api/members/:id", () => {
  it("returns the member's detail shape for a staff caller", async () => {
    const staff = await createMember({ role: "STAFF" });
    const patron = await createMember();

    const res = await request(app)
      .get(`/api/members/${patron.id}`)
      .set("Authorization", `Bearer ${tokenFor(staff)}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: patron.id,
      name: patron.name,
      email: patron.email,
      role: "PATRON",
      borrowLimit: patron.borrowLimit,
      activeLoanCount: patron.activeLoanCount,
    });
  });

  it("returns 404 MEMBER_NOT_FOUND for a nonexistent id", async () => {
    const staff = await createMember({ role: "STAFF" });

    const res = await request(app)
      .get(`/api/members/nonexistent-${randomUUID()}`)
      .set("Authorization", `Bearer ${tokenFor(staff)}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("MEMBER_NOT_FOUND");
  });

  it("returns 403 for a patron token", async () => {
    const patron = await createMember();
    const other = await createMember();

    const res = await request(app)
      .get(`/api/members/${other.id}`)
      .set("Authorization", `Bearer ${tokenFor(patron)}`);

    expect(res.status).toBe(403);
  });
});

describe("GET /api/members/:id/loans and /:id/holds", () => {
  it("returns loans and holds for the given member id", async () => {
    const staff = await createMember({ role: "STAFF" });
    const patron = await createMember();
    const book = await createBook();
    const copy1 = await createCopy(book.id);
    const copy2 = await createCopy(book.id);

    await checkoutCopy(copy1.barcode, patron.id);
    await returnCopy(copy1.barcode);
    await checkoutCopy(copy2.barcode, patron.id);

    await prisma.hold.create({
      data: {
        bookId: book.id,
        memberId: patron.id,
        status: "WAITING",
      },
    });

    const loansRes = await request(app)
      .get(`/api/members/${patron.id}/loans`)
      .set("Authorization", `Bearer ${tokenFor(staff)}`);
    expect(loansRes.status).toBe(200);
    expect(Array.isArray(loansRes.body)).toBe(true);
    expect(loansRes.body.length).toBe(2);
    expect(loansRes.body.every((l: { memberId: string }) => l.memberId === patron.id)).toBe(true);
    expect(loansRes.body[0].copy.book.id).toBe(book.id);

    const holdsRes = await request(app)
      .get(`/api/members/${patron.id}/holds`)
      .set("Authorization", `Bearer ${tokenFor(staff)}`);
    expect(holdsRes.status).toBe(200);
    expect(Array.isArray(holdsRes.body)).toBe(true);
    expect(holdsRes.body.length).toBe(1);
    expect(holdsRes.body[0].memberId).toBe(patron.id);
    expect(holdsRes.body[0].book.id).toBe(book.id);
  });

  it("returns 404 MEMBER_NOT_FOUND for loans/holds of a nonexistent member id", async () => {
    const staff = await createMember({ role: "STAFF" });
    const badId = `nonexistent-${randomUUID()}`;

    const loansRes = await request(app)
      .get(`/api/members/${badId}/loans`)
      .set("Authorization", `Bearer ${tokenFor(staff)}`);
    expect(loansRes.status).toBe(404);
    expect(loansRes.body.code).toBe("MEMBER_NOT_FOUND");

    const holdsRes = await request(app)
      .get(`/api/members/${badId}/holds`)
      .set("Authorization", `Bearer ${tokenFor(staff)}`);
    expect(holdsRes.status).toBe(404);
    expect(holdsRes.body.code).toBe("MEMBER_NOT_FOUND");
  });

  it("does not shadow GET /api/members/me/loans: 'me' still resolves to the caller's own loans", async () => {
    const member = await createMember();
    const book = await createBook();
    const copy = await createCopy(book.id);
    await checkoutCopy(copy.barcode, member.id);

    const res = await request(app)
      .get("/api/members/me/loans")
      .set("Authorization", `Bearer ${tokenFor(member)}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0].memberId).toBe(member.id);
    // If the new /:id/loans route had been registered before /me/loans, this
    // request would instead be treated as a lookup for a member literally
    // named "me" and would 404 with MEMBER_NOT_FOUND.
    expect(res.body[0].code).toBeUndefined();
  });

  it("does not shadow GET /api/members/me/holds either", async () => {
    const member = await createMember();
    const book = await createBook();
    await prisma.hold.create({
      data: { bookId: book.id, memberId: member.id, status: "WAITING" },
    });

    const res = await request(app)
      .get("/api/members/me/holds")
      .set("Authorization", `Bearer ${tokenFor(member)}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0].memberId).toBe(member.id);
  });
});
