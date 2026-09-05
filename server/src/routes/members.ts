import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
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

// Everything below this point uses a dynamic /:id param and MUST stay
// registered after /me/loans and /me/holds above — otherwise Express would
// match a literal request to /me/loans against /:id/loans first (since "me"
// satisfies :id), shadowing the "own loans" route for every authenticated user.

const createMemberSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(10),
  borrowLimit: z.number().int().positive().optional(),
});

// Staff-only direct account creation for a patron, e.g. a walk-in registering
// at the circulation desk without self-service signup.
router.post("/", requireAuth, requireRole("STAFF"), async (req, res) => {
  const parsed = createMemberSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten(), code: "VALIDATION_ERROR" });
  }
  const { name, email, password, borrowLimit } = parsed.data;

  const existing = await prisma.member.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "Email already registered", code: "EMAIL_TAKEN" });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const member = await prisma.member.create({
    data: {
      name,
      email,
      passwordHash,
      role: "PATRON",
      ...(borrowLimit !== undefined ? { borrowLimit } : {}),
    },
  });

  res.status(201).json({
    id: member.id,
    name: member.name,
    email: member.email,
    role: member.role,
    borrowLimit: member.borrowLimit,
  });
});

router.get("/:id", requireAuth, requireRole("STAFF"), async (req, res) => {
  const member = await prisma.member.findUnique({ where: { id: req.params.id } });
  if (!member) {
    return res.status(404).json({ error: "Member not found", code: "MEMBER_NOT_FOUND" });
  }
  res.json({
    id: member.id,
    name: member.name,
    email: member.email,
    role: member.role,
    borrowLimit: member.borrowLimit,
    activeLoanCount: member.activeLoanCount,
  });
});

router.get("/:id/loans", requireAuth, requireRole("STAFF"), async (req, res) => {
  const member = await prisma.member.findUnique({ where: { id: req.params.id } });
  if (!member) {
    return res.status(404).json({ error: "Member not found", code: "MEMBER_NOT_FOUND" });
  }
  const loans = await prisma.loan.findMany({
    where: { memberId: member.id },
    include: { copy: { include: { book: true } } },
    orderBy: { checkedOutAt: "desc" },
  });
  res.json(loans);
});

router.get("/:id/holds", requireAuth, requireRole("STAFF"), async (req, res) => {
  const member = await prisma.member.findUnique({ where: { id: req.params.id } });
  if (!member) {
    return res.status(404).json({ error: "Member not found", code: "MEMBER_NOT_FOUND" });
  }
  const holds = await prisma.hold.findMany({
    where: { memberId: member.id },
    include: { book: true },
    orderBy: { requestedAt: "desc" },
  });
  res.json(holds);
});

export default router;
