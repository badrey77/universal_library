import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthUser, requireAuth, signToken } from "../middleware/auth";

const router = Router();

// Credential-stuffing / brute-force guard: generous enough for a genuine
// user mistyping their password a few times, tight enough to make guessing
// impractical. Keyed by IP, which is what express-rate-limit does by default.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts, please try again later.", code: "RATE_LIMITED" },
});

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(10),
});

router.post("/register", authLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten(), code: "VALIDATION_ERROR" });
  }
  const { name, email, password } = parsed.data;

  const existing = await prisma.member.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "Email already registered", code: "EMAIL_TAKEN" });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const member = await prisma.member.create({
    data: { name, email, passwordHash, role: "PATRON" },
  });

  const token = signToken(toAuthUser(member));
  res.status(201).json({ token, member: toPublicMember(member) });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/login", authLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten(), code: "VALIDATION_ERROR" });
  }
  const { email, password } = parsed.data;

  const member = await prisma.member.findUnique({ where: { email } });
  if (!member) {
    return res.status(401).json({ error: "Invalid credentials", code: "INVALID_CREDENTIALS" });
  }
  const valid = await bcrypt.compare(password, member.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid credentials", code: "INVALID_CREDENTIALS" });
  }

  const token = signToken(toAuthUser(member));
  res.json({ token, member: toPublicMember(member) });
});

router.post("/logout", requireAuth, async (req, res) => {
  await prisma.member.update({
    where: { id: req.user!.id },
    data: { tokenVersion: { increment: 1 } },
  });
  res.status(204).send();
});

router.get("/me", requireAuth, async (req, res) => {
  const member = await prisma.member.findUnique({ where: { id: req.user!.id } });
  if (!member) return res.status(404).json({ error: "Not found", code: "MEMBER_NOT_FOUND" });
  res.json(toPublicMember(member));
});

function toPublicMember(m: {
  id: string;
  name: string;
  email: string;
  role: string;
  borrowLimit: number;
}) {
  return { id: m.id, name: m.name, email: m.email, role: m.role, borrowLimit: m.borrowLimit };
}

function toAuthUser(m: {
  id: string;
  email: string;
  role: string;
  tokenVersion: number;
}): AuthUser {
  return { id: m.id, email: m.email, role: m.role as AuthUser["role"], tokenVersion: m.tokenVersion };
}

export default router;
