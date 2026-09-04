import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthUser, requireAuth, signToken } from "../middleware/auth";

const router = Router();

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
});

router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { name, email, password } = parsed.data;

  const existing = await prisma.member.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "Email already registered" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
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

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { email, password } = parsed.data;

  const member = await prisma.member.findUnique({ where: { email } });
  if (!member) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const valid = await bcrypt.compare(password, member.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = signToken(toAuthUser(member));
  res.json({ token, member: toPublicMember(member) });
});

router.get("/me", requireAuth, async (req, res) => {
  const member = await prisma.member.findUnique({ where: { id: req.user!.id } });
  if (!member) return res.status(404).json({ error: "Not found" });
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

function toAuthUser(m: { id: string; email: string; role: string }): AuthUser {
  return { id: m.id, email: m.email, role: m.role as AuthUser["role"] };
}

export default router;
