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

describe("GET /api/books/:id/history", () => {
  it("returns zero counts for a book with no loans ever", async () => {
    const book = await createBook();

    const res = await request(app).get(`/api/books/${book.id}/history`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ totalLoans: 0, currentlyOnLoan: 0 });
  });

  it("counts loans across all copies: one returned, one still out", async () => {
    const book = await createBook();
    const copy1 = await createCopy(book.id);
    const copy2 = await createCopy(book.id);
    const member = await createMember();

    await checkoutCopy(copy1.barcode, member.id);
    await returnCopy(copy1.barcode);
    await checkoutCopy(copy2.barcode, member.id);

    const res = await request(app).get(`/api/books/${book.id}/history`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ totalLoans: 2, currentlyOnLoan: 1 });
  });

  it("returns 404 BOOK_NOT_FOUND for a nonexistent book id", async () => {
    const res = await request(app).get(`/api/books/nonexistent-${randomUUID()}/history`);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("BOOK_NOT_FOUND");
  });
});

describe("GET /api/books/:id/history/detail", () => {
  it("returns 401 with no auth", async () => {
    const book = await createBook();
    const res = await request(app).get(`/api/books/${book.id}/history/detail`);
    expect(res.status).toBe(401);
  });

  it("returns 403 for a PATRON token", async () => {
    const book = await createBook();
    const patron = await createMember({ role: "PATRON" });

    const res = await request(app)
      .get(`/api/books/${book.id}/history/detail`)
      .set("Authorization", `Bearer ${tokenFor(patron)}`);
    expect(res.status).toBe(403);
  });

  it("returns 200 for a STAFF token, with expected fields and most-recent-first ordering", async () => {
    const book = await createBook();
    const copy1 = await createCopy(book.id);
    const copy2 = await createCopy(book.id);
    const member = await createMember();
    const staff = await createMember({ role: "STAFF" });

    const firstLoan = await checkoutCopy(copy1.barcode, member.id);
    await returnCopy(copy1.barcode);
    const secondLoan = await checkoutCopy(copy2.barcode, member.id);

    const res = await request(app)
      .get(`/api/books/${book.id}/history/detail`)
      .set("Authorization", `Bearer ${tokenFor(staff)}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);

    // Most recent checkout first.
    expect(res.body[0].loanId).toBe(secondLoan.id);
    expect(res.body[1].loanId).toBe(firstLoan.id);

    const [mostRecent, older] = res.body;
    expect(mostRecent.memberName).toBe(member.name);
    expect(mostRecent.memberEmail).toBe(member.email);
    expect(mostRecent.copyBarcode).toBe(copy2.barcode);
    expect(mostRecent.returnedAt).toBeNull();
    expect(typeof mostRecent.checkedOutAt).toBe("string");
    expect(mostRecent.renewalCount).toBe(0);

    expect(older.copyBarcode).toBe(copy1.barcode);
    expect(typeof older.returnedAt).toBe("string");
  });

  it("returns 404 BOOK_NOT_FOUND for a nonexistent book id as staff", async () => {
    const staff = await createMember({ role: "STAFF" });

    const res = await request(app)
      .get(`/api/books/nonexistent-${randomUUID()}/history/detail`)
      .set("Authorization", `Bearer ${tokenFor(staff)}`);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("BOOK_NOT_FOUND");
  });
});
