import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

router.get("/me/loans", requireAuth, async (req, res) => {
  const loans = await prisma.loan.findMany({
    where: { memberId: req.user!.id },
    include: { copy: { include: { book: true } } },
    orderBy: { checkedOutAt: "desc" },
  });
  res.json(loans);
});

router.get("/me/holds", requireAuth, async (req, res) => {
  const holds = await prisma.hold.findMany({
    where: { memberId: req.user!.id },
    include: { book: true },
    orderBy: { requestedAt: "desc" },
  });
  res.json(holds);
});

// Staff directory lookup, used at the circulation desk to find a member by email.
router.get("/", requireAuth, requireRole("STAFF"), async (req, res) => {
  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const members = await prisma.member.findMany({
    where: query
      ? { OR: [{ email: { contains: query } }, { name: { contains: query } }] }
      : undefined,
    select: { id: true, name: true, email: true, role: true, borrowLimit: true },
    take: 20,
  });
  res.json(members);
});

export default router;
