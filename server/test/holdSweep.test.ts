import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "../src/lib/prisma";
import { sweepExpiredHolds } from "../src/lib/holdSweep";

async function createBook() {
  return prisma.book.create({
    data: {
      isbn: `isbn-${randomUUID()}`,
      title: "Test Book",
      author: "Test Author",
    },
  });
}

async function createCopy(bookId: string, status = "ON_HOLD") {
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

describe("sweepExpiredHolds", () => {
  it("expires a READY hold past its expiresAt and releases the copy to AVAILABLE when no other holds exist", async () => {
    const book = await createBook();
    const copy = await createCopy(book.id, "ON_HOLD");
    const holder = await createMember();

    const hold = await prisma.hold.create({
      data: {
        bookId: book.id,
        memberId: holder.id,
        status: "READY",
        copyId: copy.id,
        expiresAt: new Date(Date.now() - 60_000),
      },
    });

    const swept = await sweepExpiredHolds();
    expect(swept).toBeGreaterThanOrEqual(1);

    const updatedHold = await prisma.hold.findUnique({ where: { id: hold.id } });
    expect(updatedHold?.status).toBe("EXPIRED");

    const updatedCopy = await prisma.copy.findUnique({ where: { id: copy.id } });
    expect(updatedCopy?.status).toBe("AVAILABLE");
  });

  it("expires a READY hold and reassigns the copy to the next WAITING hold on the same book", async () => {
    const book = await createBook();
    const copy = await createCopy(book.id, "ON_HOLD");
    const expiredHolder = await createMember();
    const waitingHolder = await createMember();

    const expiredHold = await prisma.hold.create({
      data: {
        bookId: book.id,
        memberId: expiredHolder.id,
        status: "READY",
        copyId: copy.id,
        expiresAt: new Date(Date.now() - 60_000),
      },
    });
    const waitingHold = await prisma.hold.create({
      data: {
        bookId: book.id,
        memberId: waitingHolder.id,
        status: "WAITING",
        requestedAt: new Date(Date.now() - 30_000),
      },
    });

    const swept = await sweepExpiredHolds();
    expect(swept).toBeGreaterThanOrEqual(1);

    const updatedExpiredHold = await prisma.hold.findUnique({ where: { id: expiredHold.id } });
    expect(updatedExpiredHold?.status).toBe("EXPIRED");

    const updatedWaitingHold = await prisma.hold.findUnique({ where: { id: waitingHold.id } });
    expect(updatedWaitingHold?.status).toBe("READY");
    expect(updatedWaitingHold?.copyId).toBe(copy.id);

    const updatedCopy = await prisma.copy.findUnique({ where: { id: copy.id } });
    expect(updatedCopy?.status).toBe("ON_HOLD");
  });
});
