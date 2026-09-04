import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { LOAN_PERIOD_DAYS, MAX_RENEWALS, HOLD_READY_DAYS, addDays } from "../lib/policy";

const router = Router();

const checkoutSchema = z.object({
  barcode: z.string().min(1),
  memberId: z.string().min(1),
});

// Staff scans a copy's barcode out to a member. Transactional so two staff
// desks can never check the same physical copy out twice.
router.post("/checkout", requireAuth, requireRole("STAFF"), async (req, res) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { barcode, memberId } = parsed.data;

  try {
    const loan = await prisma.$transaction(async (tx) => {
      const copy = await tx.copy.findUnique({ where: { barcode }, include: { book: true } });
      if (!copy) throw new HttpError(404, "Copy not found");

      const member = await tx.member.findUnique({ where: { id: memberId } });
      if (!member) throw new HttpError(404, "Member not found");

      let holdToFulfill: { id: string } | null = null;

      if (copy.status === "ON_HOLD") {
        const heldFor = await tx.hold.findFirst({
          where: { copyId: copy.id, status: "READY" },
        });
        if (!heldFor || heldFor.memberId !== memberId) {
          throw new HttpError(409, "Copy is reserved for another member's hold");
        }
        holdToFulfill = heldFor;
      } else if (copy.status !== "AVAILABLE") {
        throw new HttpError(409, `Copy is not available (status: ${copy.status})`);
      }

      // Compare-and-swap against the member's own row instead of a separate
      // count-then-compare: two concurrent checkouts racing near the limit
      // can't both pass, since only one UPDATE can match the WHERE clause.
      const memberClaim = await tx.member.updateMany({
        where: { id: memberId, activeLoanCount: { lt: member.borrowLimit } },
        data: { activeLoanCount: { increment: 1 } },
      });
      if (memberClaim.count !== 1) {
        throw new HttpError(409, "Member has reached their borrowing limit");
      }

      const updateResult = await tx.copy.updateMany({
        where: { id: copy.id, status: copy.status },
        data: { status: "ON_LOAN" },
      });
      if (updateResult.count !== 1) {
        throw new HttpError(409, "Copy status changed concurrently, please retry");
      }

      if (holdToFulfill) {
        await tx.hold.update({
          where: { id: holdToFulfill.id },
          data: { status: "FULFILLED" },
        });
      }

      return tx.loan.create({
        data: {
          copyId: copy.id,
          memberId,
          dueAt: addDays(new Date(), LOAN_PERIOD_DAYS),
        },
        include: { copy: { include: { book: true } } },
      });
    });

    res.status(201).json(loan);
  } catch (err) {
    handleHttpError(res, err);
  }
});

const returnSchema = z.object({
  barcode: z.string().min(1),
});

router.post("/return", requireAuth, requireRole("STAFF"), async (req, res) => {
  const parsed = returnSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { barcode } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const copy = await tx.copy.findUnique({ where: { barcode } });
      if (!copy) throw new HttpError(404, "Copy not found");

      const loan = await tx.loan.findFirst({
        where: { copyId: copy.id, returnedAt: null },
      });
      if (!loan) throw new HttpError(400, "This copy is not currently on loan");

      await tx.loan.update({
        where: { id: loan.id },
        data: { returnedAt: new Date() },
      });
      await tx.member.update({
        where: { id: loan.memberId },
        data: { activeLoanCount: { decrement: 1 } },
      });

      // Claim the oldest waiting hold via CAS, retrying against the next one
      // in line if a concurrent return already claimed it first — prevents
      // two returns from double-assigning the same hold.
      const triedHoldIds: string[] = [];
      let claimed: { id: string; memberId: string } | null = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = await tx.hold.findFirst({
          where: { bookId: copy.bookId, status: "WAITING", id: { notIn: triedHoldIds } },
          orderBy: { requestedAt: "asc" },
        });
        if (!candidate) break;

        const claim = await tx.hold.updateMany({
          where: { id: candidate.id, status: "WAITING" },
          data: {
            status: "READY",
            copyId: copy.id,
            expiresAt: addDays(new Date(), HOLD_READY_DAYS),
          },
        });
        if (claim.count === 1) {
          claimed = { id: candidate.id, memberId: candidate.memberId };
          break;
        }
        triedHoldIds.push(candidate.id);
      }

      if (claimed) {
        await tx.copy.update({ where: { id: copy.id }, data: { status: "ON_HOLD" } });
        return { copyStatus: "ON_HOLD", reservedForMemberId: claimed.memberId };
      }

      await tx.copy.update({ where: { id: copy.id }, data: { status: "AVAILABLE" } });
      return { copyStatus: "AVAILABLE", reservedForMemberId: null };
    });

    res.json(result);
  } catch (err) {
    handleHttpError(res, err);
  }
});

const renewSchema = z.object({
  loanId: z.string().min(1),
});

router.post("/renew", requireAuth, async (req, res) => {
  const parsed = renewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { loanId } = parsed.data;

  try {
    const loan = await prisma.$transaction(async (tx) => {
      const loan = await tx.loan.findUnique({ where: { id: loanId }, include: { copy: true } });
      if (!loan) throw new HttpError(404, "Loan not found");
      if (loan.returnedAt) throw new HttpError(400, "Loan already returned");

      const isOwner = req.user!.id === loan.memberId;
      if (!isOwner && req.user!.role !== "STAFF") {
        throw new HttpError(403, "Forbidden");
      }
      if (loan.renewalCount >= MAX_RENEWALS) {
        throw new HttpError(409, "Renewal limit reached");
      }

      const pendingHold = await tx.hold.findFirst({
        where: { bookId: loan.copy.bookId, status: "WAITING" },
      });
      if (pendingHold) {
        throw new HttpError(409, "Cannot renew: another member is waiting for this book");
      }

      return tx.loan.update({
        where: { id: loan.id },
        data: {
          dueAt: addDays(new Date(), LOAN_PERIOD_DAYS),
          renewalCount: { increment: 1 },
        },
      });
    });

    res.json(loan);
  } catch (err) {
    handleHttpError(res, err);
  }
});

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function handleHttpError(res: import("express").Response, err: unknown) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
}

export default router;
