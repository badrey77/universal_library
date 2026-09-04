import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "../src/lib/prisma";
import { assignNextHoldOrRelease } from "../src/lib/holdAssignment";

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

async function createMember() {
  return prisma.member.create({
    data: {
      name: "Test Member",
      email: `member-${randomUUID()}@example.com`,
      passwordHash: "unused-hash",
    },
  });
}

describe("assignNextHoldOrRelease", () => {
  it("claims the oldest WAITING hold onto the given copy and sets Copy ON_HOLD", async () => {
    const book = await createBook();
    const copy = await createCopy(book.id);
    const olderHolder = await createMember();
    const newerHolder = await createMember();

    const olderHold = await prisma.hold.create({
      data: {
        bookId: book.id,
        memberId: olderHolder.id,
        status: "WAITING",
        requestedAt: new Date(Date.now() - 2 * 60_000),
      },
    });
    await prisma.hold.create({
      data: {
        bookId: book.id,
        memberId: newerHolder.id,
        status: "WAITING",
        requestedAt: new Date(Date.now() - 60_000),
      },
    });

    const result = await prisma.$transaction((tx) => assignNextHoldOrRelease(tx, copy.id, book.id));

    expect(result).toEqual({ copyStatus: "ON_HOLD", reservedForMemberId: olderHolder.id });

    const updatedHold = await prisma.hold.findUnique({ where: { id: olderHold.id } });
    expect(updatedHold?.status).toBe("READY");
    expect(updatedHold?.copyId).toBe(copy.id);

    const updatedCopy = await prisma.copy.findUnique({ where: { id: copy.id } });
    expect(updatedCopy?.status).toBe("ON_HOLD");
  });

  it("releases the copy to AVAILABLE when there are zero WAITING holds on the book", async () => {
    const book = await createBook();
    const copy = await createCopy(book.id, "ON_LOAN");

    const result = await prisma.$transaction((tx) => assignNextHoldOrRelease(tx, copy.id, book.id));

    expect(result).toEqual({ copyStatus: "AVAILABLE", reservedForMemberId: null });

    const updatedCopy = await prisma.copy.findUnique({ where: { id: copy.id } });
    expect(updatedCopy?.status).toBe("AVAILABLE");
  });

  it("releases the copy to AVAILABLE when all holds on the book are in a terminal state", async () => {
    const book = await createBook();
    const copy = await createCopy(book.id, "ON_LOAN");
    const holder = await createMember();

    await prisma.hold.create({
      data: {
        bookId: book.id,
        memberId: holder.id,
        status: "CANCELLED",
        requestedAt: new Date(Date.now() - 60_000),
      },
    });

    const result = await prisma.$transaction((tx) => assignNextHoldOrRelease(tx, copy.id, book.id));

    expect(result).toEqual({ copyStatus: "AVAILABLE", reservedForMemberId: null });

    const updatedCopy = await prisma.copy.findUnique({ where: { id: copy.id } });
    expect(updatedCopy?.status).toBe("AVAILABLE");
  });
});
