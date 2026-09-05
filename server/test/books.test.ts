import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { signToken } from "../src/middleware/auth";

async function createBook(overrides: Partial<{ category: string | null; theme: string | null }> = {}) {
  return prisma.book.create({
    data: {
      isbn: `isbn-${randomUUID()}`,
      title: "Test Book",
      author: "Test Author",
      category: overrides.category,
      theme: overrides.theme,
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

describe("GET /api/books", () => {
  it("includes category and theme in the summary shape", async () => {
    const book = await createBook({ category: "Fiction", theme: "War and homecoming" });

    const res = await request(app).get("/api/books").query({ q: book.isbn });
    expect(res.status).toBe(200);
    const found = res.body.find((b: { id: string }) => b.id === book.id);
    expect(found).toBeDefined();
    expect(found.category).toBe("Fiction");
    expect(found.theme).toBe("War and homecoming");
  });

  it("returns null category/theme when not set", async () => {
    const book = await createBook();

    const res = await request(app).get("/api/books").query({ q: book.isbn });
    expect(res.status).toBe(200);
    const found = res.body.find((b: { id: string }) => b.id === book.id);
    expect(found).toBeDefined();
    expect(found.category).toBeNull();
    expect(found.theme).toBeNull();
  });
});

describe("GET /api/books/:id", () => {
  it("includes category and theme in the detail shape", async () => {
    const book = await createBook({ category: "Poetry", theme: "Loss and memory" });

    const res = await request(app).get(`/api/books/${book.id}`);
    expect(res.status).toBe(200);
    expect(res.body.category).toBe("Poetry");
    expect(res.body.theme).toBe("Loss and memory");
  });

  it("returns null category/theme when not set", async () => {
    const book = await createBook();

    const res = await request(app).get(`/api/books/${book.id}`);
    expect(res.status).toBe(200);
    expect(res.body.category).toBeNull();
    expect(res.body.theme).toBeNull();
  });
});

describe("POST /api/books", () => {
  it("persists category and theme when provided", async () => {
    const staff = await createMember({ role: "STAFF" });
    const isbn = `isbn-${randomUUID()}`;

    const res = await request(app)
      .post("/api/books")
      .set("Authorization", `Bearer ${tokenFor(staff)}`)
      .send({
        isbn,
        title: "New Book",
        author: "New Author",
        category: "Non-fiction",
        theme: "Resilience and survival",
        initialCopies: 0,
      });

    expect(res.status).toBe(201);
    expect(res.body.category).toBe("Non-fiction");
    expect(res.body.theme).toBe("Resilience and survival");

    const stored = await prisma.book.findUnique({ where: { isbn } });
    expect(stored?.category).toBe("Non-fiction");
    expect(stored?.theme).toBe("Resilience and survival");
  });

  it("omits category/theme gracefully (stored as null) when not provided", async () => {
    const staff = await createMember({ role: "STAFF" });
    const isbn = `isbn-${randomUUID()}`;

    const res = await request(app)
      .post("/api/books")
      .set("Authorization", `Bearer ${tokenFor(staff)}`)
      .send({
        isbn,
        title: "Another Book",
        author: "Another Author",
        initialCopies: 0,
      });

    expect(res.status).toBe(201);
    expect(res.body.category).toBeNull();
    expect(res.body.theme).toBeNull();

    const stored = await prisma.book.findUnique({ where: { isbn } });
    expect(stored?.category).toBeNull();
    expect(stored?.theme).toBeNull();
  });
});
