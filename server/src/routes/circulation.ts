import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { LOAN_PERIOD_DAYS, MAX_RENEWALS, addDays } from "../lib/policy";
import { HttpError, sendHttpError } from "../lib/httpError";
import { assignNextHoldOrRelease } from "../lib/holdAssignment";

const router = Router();

const checkoutSchema = z.object({
  barcode: z.string().min(1),
  memberId: z.string().min(1),
});

// Staff scans a copy's barcode out to a member. Transactional so two staff
// desks can never check the same physical copy out twice.
router.post("/checkout", requireAuth, requireRole("STAFF"), async (req, res) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten(), code: "VALIDATION_ERROR" });
  }
  const { barcode, memberId } = parsed.data;

  try {
    const loan = await prisma.$transaction(async (tx) => {
      const copy = await tx.copy.findUnique({ where: { barcode }, include: { book: true } });
      if (!copy) throw new HttpError(404, "COPY_NOT_FOUND", "Copy not found");

      const member = await tx.member.findUnique({ where: { id: memberId } });
      if (!member) throw new HttpError(404, "MEMBER_NOT_FOUND", "Member not found");

      let holdToFulfill: { id: string } | null = null;

      if (copy.status === "ON_HOLD") {
        const heldFor = await tx.hold.findFirst({
          where: { copyId: copy.id, status: "READY" },
        });
        if (!heldFor || heldFor.memberId !== memberId) {
          throw new HttpError(
            409,
            "COPY_RESERVED_FOR_HOLD",
            "Copy is reserved for another member's hold"
          );
        }
        holdToFulfill = heldFor;
      } else if (copy.status !== "AVAILABLE") {
        throw new HttpError(
          409,
          "COPY_NOT_AVAILABLE",
          `Copy is not available (status: ${copy.status})`
        );
      }

      // Compare-and-swap against the member's own row instead of a separate
      // count-then-compare: two concurrent checkouts racing near the limit
      // can't both pass, since only one UPDATE can match the WHERE clause.
      const memberClaim = await tx.member.updateMany({
        where: { id: memberId, activeLoanCount: { lt: member.borrowLimit } },
        data: { activeLoanCount: { increment: 1 } },
      });
      if (memberClaim.count !== 1) {
        throw new HttpError(
          409,
          "BORROW_LIMIT_REACHED",
          "Member has reached their borrowing limit"
        );
      }

      const updateResult = await tx.copy.updateMany({
        where: { id: copy.id, status: copy.status },
        data: { status: "ON_LOAN" },
      });
      if (updateResult.count !== 1) {
        throw new HttpError(
          409,
          "COPY_STATUS_CONFLICT",
          "Copy status changed concurrently, please retry"
        );
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
    sendHttpError(res, err);
  }
});

const returnSchema = z.object({
  barcode: z.string().min(1),
});

router.post("/return", requireAuth, requireRole("STAFF"), async (req, res) => {
  const parsed = returnSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten(), code: "VALIDATION_ERROR" });
  }
  const { barcode } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const copy = await tx.copy.findUnique({ where: { barcode } });
      if (!copy) throw new HttpError(404, "COPY_NOT_FOUND", "Copy not found");

      const loan = await tx.loan.findFirst({
        where: { copyId: copy.id, returnedAt: null },
      });
      if (!loan) throw new HttpError(400, "NOT_ON_LOAN", "This copy is not currently on loan");

      await tx.loan.update({
        where: { id: loan.id },
        data: { returnedAt: new Date() },
      });
      await tx.member.update({
        where: { id: loan.memberId },
        data: { activeLoanCount: { decrement: 1 } },
      });

      return assignNextHoldOrRelease(tx, copy.id, copy.bookId);
    });

    res.json(result);
  } catch (err) {
    sendHttpError(res, err);
  }
});

const renewSchema = z.object({
  loanId: z.string().min(1),
});

router.post("/renew", requireAuth, async (req, res) => {
  const parsed = renewSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten(), code: "VALIDATION_ERROR" });
  }
  const { loanId } = parsed.data;

  try {
    const loan = await prisma.$transaction(async (tx) => {
      const loan = await tx.loan.findUnique({ where: { id: loanId }, include: { copy: true } });
      if (!loan) throw new HttpError(404, "LOAN_NOT_FOUND", "Loan not found");
      if (loan.returnedAt) {
        throw new HttpError(400, "LOAN_ALREADY_RETURNED", "Loan already returned");
      }

      const isOwner = req.user!.id === loan.memberId;
      if (!isOwner && req.user!.role !== "STAFF") {
        throw new HttpError(403, "FORBIDDEN", "Forbidden");
      }
      if (loan.renewalCount >= MAX_RENEWALS) {
        throw new HttpError(409, "RENEWAL_LIMIT_REACHED", "Renewal limit reached");
      }

      const pendingHold = await tx.hold.findFirst({
        where: { bookId: loan.copy.bookId, status: "WAITING" },
      });
      if (pendingHold) {
        throw new HttpError(
          409,
          "HOLD_BLOCKS_RENEWAL",
          "Cannot renew: another member is waiting for this book"
        );
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
    sendHttpError(res, err);
  }
});

export default router;
