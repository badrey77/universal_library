import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";

function loadJwtSecret(): string {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32) {
    throw new Error(
      "JWT_SECRET environment variable must be set to a random string of at least 32 characters"
    );
  }
  return value;
}

const JWT_SECRET: string = loadJwtSecret();

// Kept short since a stolen token is otherwise valid until it expires —
// logout revokes immediately via tokenVersion (below), but a short TTL
// limits the blast radius for a token that's never explicitly logged out.
const TOKEN_TTL = "24h";

export interface AuthUser {
  id: string;
  role: "PATRON" | "STAFF";
  email: string;
  tokenVersion: number;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: AuthUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: TOKEN_TTL, algorithm: "HS256" });
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing bearer token", code: "MISSING_TOKEN" });
  }
  const token = header.slice("Bearer ".length);

  let payload: AuthUser;
  try {
    payload = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] }) as AuthUser;
  } catch {
    return res.status(401).json({ error: "Invalid or expired token", code: "INVALID_TOKEN" });
  }

  // A logout bumps the member's tokenVersion, instantly invalidating every
  // token issued before it even though the JWT itself is still unexpired.
  const member = await prisma.member.findUnique({
    where: { id: payload.id },
    select: { tokenVersion: true },
  });
  if (!member || member.tokenVersion !== payload.tokenVersion) {
    return res.status(401).json({ error: "Token has been revoked", code: "TOKEN_REVOKED" });
  }

  req.user = payload;
  next();
}

export function requireRole(...roles: Array<"PATRON" | "STAFF">) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden", code: "FORBIDDEN" });
    }
    next();
  };
}
