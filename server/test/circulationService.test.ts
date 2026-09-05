import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "../src/lib/prisma";
import { HttpError } from "../src/lib/httpError";
import { checkoutCopy, returnCopy, renewLoan } from "../src/services/circulationService";
import { getSettings } from "../src/lib/settings";

async function expectHttpErrorCode(promise: Promise<unknown>, code: string) {
  try {
    await promise;
    expect.fail(`expected promise to reject with HttpError code ${code}`);
  } catch (err) {
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).code).toBe(code);
  }
}

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

async function createMember(overrides: Partial<{ borrowLimit: number; activeLoanCount: number; role: string }> = {}) {
  return prisma.member.create({
    data: {
      name: "Test Member",
      email: `member-${randomUUID()}@example.com`,
      passwordHash: "unused-hash",
      borrowLimit: overrides.borrowLimit ?? 5,
      activeLoanCount: overrides.activeLoanCount ?? 0,
      role: overrides.role ?? "PATRON",
    },
  });
}

describe("checkoutCopy", () => {
  it("creates a Loan, sets Copy to ON_LOAN, and increments activeLoanCount by 1", async () => {
    const book = await createBook();
    const copy = await createCopy(book.id);
    const member = await createMember({ activeLoanCount: 0 });

    const loan = await checkoutCopy(copy.barcode, member.id);
    expect(loan).toBeTruthy();
    expect(loan.copyId).toBe(copy.id);
    expect(loan.memberId).toBe(member.id);

    const updatedCopy = await prisma.copy.findUnique({ where: { id: copy.id } });
    expect(updatedCopy?.status).toBe("ON_LOAN");

    const updatedMember = await prisma.member.findUnique({ where: { id: member.id } });
    expect(updatedMember?.activeLoanCount).toBe(1);
  });

  it("throws COPY_NOT_FOUND for an unknown barcode", async () => {
    const member = await createMember();
    await expectHttpErrorCode(checkoutCopy(`nonexistent-${randomUUID()}`, member.id), "COPY_NOT_FOUND");
  });

  it("throws MEMBER_NOT_FOUND for an unknown memberId with a valid copy", async () => {
    const book = await createBook();
    const copy = await createCopy(book.id);
    await expectHttpErrorCode(checkoutCopy(copy.barcode, `nonexistent-${randomUUID()}`), "MEMBER_NOT_FOUND");
  });

  it("throws COPY_NOT_AVAILABLE when the copy is already ON_LOAN", async () => {
    const book = await createBook();
    const copy = await createCopy(book.id);
    const member1 = await createMember();
    const member2 = await createMember();

    await checkoutCopy(copy.barcode, member1.id);
    await expectHttpErrorCode(checkoutCopy(copy.barcode, member2.id), "COPY_NOT_AVAILABLE");
  });

  it("throws BORROW_LIMIT_REACHED when member is already at their limit, and does not increment past it", async () => {
    const book = await createBook();
    const copy = await createCopy(book.id);
    const member = await createMember({ borrowLimit: 1, activeLoanCount: 1 });

    await expectHttpErrorCode(checkoutCopy(copy.barcode, member.id), "BORROW_LIMIT_REACHED");

    const updatedMember = await prisma.member.findUnique({ where: { id: member.id } });
    expect(updatedMember?.activeLoanCount).toBe(1);
  });

  it("throws COPY_RESERVED_FOR_HOLD when a different member tries to check out a copy held for someone else", async () => {
    const book = await createBook();
    const copy = await createCopy(book.id, "ON_HOLD");
    const heldForMember = await createMember();
    const otherMember = await createMember();

    await prisma.hold.create({
      data: {
        bookId: book.id,
        memberId: heldForMember.id,
        copyId: copy.id,
        status: "READY",
        expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      },
    });

    await expectHttpErrorCode(checkoutCopy(copy.barcode, otherMember.id), "COPY_RESERVED_FOR_HOLD");
  });

  it("succeeds when the correct held-for member checks out the copy, and marks the hold FULFILLED", async () => {
    const book = await createBook();
    const copy = await createCopy(book.id, "ON_HOLD");
    const heldForMember = await createMember();

    const hold = await prisma.hold.create({
      data: {
        bookId: book.id,
        memberId: heldForMember.id,
        copyId: copy.id,
        status: "READY",
        expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      },
    });

    const loan = await checkoutCopy(copy.barcode, heldForMember.id);
    expect(loan.memberId).toBe(heldForMember.id);

    const updatedHold = await prisma.hold.findUnique({ where: { id: hold.id } });
    expect(updatedHold?.status).toBe("FULFILLED");
  });
});

describe("returnCopy", () => {
  it("sets Copy to AVAILABLE and decrements activeLoanCount when there are no pending holds", async () => {
    const book = await createBook();
    const copy = await createCopy(book.id);
    const member = await createMember({ activeLoanCount: 0 });

    await checkoutCopy(copy.barcode, member.id);
    const memberAfterCheckout = await prisma.member.findUnique({ where: { id: member.id } });
    expect(memberAfterCheckout?.activeLoanCount).toBe(1);

    await returnCopy(copy.barcode);

    const updatedCopy = await prisma.copy.findUnique({ where: { id: copy.id } });
    expect(updatedCopy?.status).toBe("AVAILABLE");

    const memberAfterReturn = await prisma.member.findUnique({ where: { id: member.id } });
    expect(memberAfterReturn?.activeLoanCount).toBe(0);
  });

  it("assigns the oldest WAITING hold on return: Copy -> ON_HOLD, Hold -> READY with copyId set and expiresAt in the future", async () => {
    const book = await createBook();
    const copy = await createCopy(book.id);
    const borrower = await createMember();
    const olderHolder = await createMember();
    const newerHolder = await createMember();

    await checkoutCopy(copy.barcode, borrower.id);

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

    const result = await returnCopy(copy.barcode);
    expect(result).toMatchObject({ reservedForMemberId: olderHolder.id });

    const updatedCopy = await prisma.copy.findUnique({ where: { id: copy.id } });
    expect(updatedCopy?.status).toBe("ON_HOLD");

    const updatedHold = await prisma.hold.findUnique({ where: { id: olderHold.id } });
    expect(updatedHold?.status).toBe("READY");
    expect(updatedHold?.copyId).toBe(copy.id);
    expect(updatedHold?.expiresAt).toBeTruthy();
    expect((updatedHold?.expiresAt as Date).getTime()).toBeGreaterThan(Date.now());
  });

  it("throws NOT_ON_LOAN for a copy that is not currently on loan", async () => {
    const book = await createBook();
    const copy = await createCopy(book.id, "AVAILABLE");
    await expectHttpErrorCode(returnCopy(copy.barcode), "NOT_ON_LOAN");
  });

  it("throws NOT_ON_LOAN for a copy whose only loan already has a returnedAt", async () => {
    const book = await createBook();
    const copy = await createCopy(book.id);
    const member = await createMember();

    await checkoutCopy(copy.barcode, member.id);
    await returnCopy(copy.barcode);

    await expectHttpErrorCode(returnCopy(copy.barcode), "NOT_ON_LOAN");
  });
});

describe("renewLoan", () => {
  it("increments renewalCount and pushes dueAt further into the future on success", async () => {
    const book = await createBook();
    const copy = await createCopy(book.id);
    const member = await createMember();

    const loan = await checkoutCopy(copy.barcode, member.id);
    const oldDueAt = loan.dueAt;

    const renewed = await renewLoan(loan.id, { id: member.id, role: "PATRON" });
    expect(renewed.renewalCount).toBe(1);
    expect(renewed.dueAt.getTime()).toBeGreaterThan(oldDueAt.getTime());
  });

  it("throws RENEWAL_LIMIT_REACHED when the loan is already at maxRenewals", async () => {
    const book = await createBook();
    const copy = await createCopy(book.id);
    const member = await createMember();

    const loan = await checkoutCopy(copy.barcode, member.id);
    const { maxRenewals } = await getSettings();
    await prisma.loan.update({ where: { id: loan.id }, data: { renewalCount: maxRenewals } });

    await expectHttpErrorCode(renewLoan(loan.id, { id: member.id, role: "PATRON" }), "RENEWAL_LIMIT_REACHED");
  });

  it("throws HOLD_BLOCKS_RENEWAL when another member has a WAITING hold on the book", async () => {
    const book = await createBook();
    const copy = await createCopy(book.id);
    const member = await createMember();
    const otherMember = await createMember();

    const loan = await checkoutCopy(copy.barcode, member.id);
    await prisma.hold.create({
      data: {
        bookId: book.id,
        memberId: otherMember.id,
        status: "WAITING",
        requestedAt: new Date(Date.now() - 60_000),
      },
    });

    await expectHttpErrorCode(renewLoan(loan.id, { id: member.id, role: "PATRON" }), "HOLD_BLOCKS_RENEWAL");
  });

  it("throws FORBIDDEN when requester is neither the owner nor STAFF", async () => {
    const book = await createBook();
    const copy = await createCopy(book.id);
    const member = await createMember();
    const stranger = await createMember();

    const loan = await checkoutCopy(copy.barcode, member.id);

    await expectHttpErrorCode(renewLoan(loan.id, { id: stranger.id, role: "PATRON" }), "FORBIDDEN");
  });

  it("succeeds when requester is STAFF renewing someone else's loan", async () => {
    const book = await createBook();
    const copy = await createCopy(book.id);
    const member = await createMember();
    const staff = await createMember({ role: "STAFF" });

    const loan = await checkoutCopy(copy.barcode, member.id);

    const renewed = await renewLoan(loan.id, { id: staff.id, role: "STAFF" });
    expect(renewed.renewalCount).toBe(1);
  });

  it("succeeds when requester is the loan's own owner (PATRON)", async () => {
    const book = await createBook();
    const copy = await createCopy(book.id);
    const member = await createMember();

    const loan = await checkoutCopy(copy.barcode, member.id);

    const renewed = await renewLoan(loan.id, { id: member.id, role: "PATRON" });
    expect(renewed.renewalCount).toBe(1);
  });
});
