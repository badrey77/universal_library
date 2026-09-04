import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

const router = Router();

const createHoldSchema = z.object({
  bookId: z.string().min(1),
});

router.post("/", requireAuth, async (req, res) => {
  const parsed = createHoldSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten(), code: "VALIDATION_ERROR" });
  }
  const { bookId } = parsed.data;
  const memberId = req.user!.id;

  const book = await prisma.book.findUnique({ where: { id: bookId }, include: { copies: true } });
  if (!book) return res.status(404).json({ error: "Book not found", code: "BOOK_NOT_FOUND" });

  const existing = await prisma.hold.findFirst({
    where: { bookId, memberId, status: { in: ["WAITING", "READY"] } },
  });
  if (existing) {
    return res
      .status(409)
      .json({ error: "You already have a hold on this book", code: "HOLD_ALREADY_EXISTS" });
  }

  const hold = await prisma.hold.create({
    data: { bookId, memberId, status: "WAITING" },
  });

  res.status(201).json(hold);
});

router.delete("/:id", requireAuth, async (req, res) => {
  const hold = await prisma.hold.findUnique({ where: { id: req.params.id } });
  if (!hold) return res.status(404).json({ error: "Hold not found", code: "HOLD_NOT_FOUND" });

  const isOwner = hold.memberId === req.user!.id;
  if (!isOwner && req.user!.role !== "STAFF") {
    return res.status(403).json({ error: "Forbidden", code: "FORBIDDEN" });
  }
  if (hold.status === "FULFILLED") {
    return res
      .status(400)
      .json({ error: "Hold already fulfilled", code: "HOLD_ALREADY_FULFILLED" });
  }

  await prisma.$transaction(async (tx) => {
    await tx.hold.update({ where: { id: hold.id }, data: { status: "CANCELLED" } });
    if (hold.status === "READY" && hold.copyId) {
      await tx.copy.update({ where: { id: hold.copyId }, data: { status: "AVAILABLE" } });
    }
  });

  res.status(204).send();
});

export default router;
