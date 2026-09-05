import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

const SETTINGS_ID = "global";

// Schema-level defaults, repeated here so getSettings' lazy-create upsert
// doesn't silently drift from schema.prisma's @default() values.
const DEFAULTS = {
  loanPeriodDays: 14,
  maxRenewals: 2,
  holdReadyDays: 3,
  defaultBorrowLimit: 5,
};

export interface SettingsData {
  loanPeriodDays: number;
  maxRenewals: number;
  holdReadyDays: number;
  defaultBorrowLimit: number;
}

// Accepts either the module-level PrismaClient or an interactive
// transaction's client, so callers already inside a $transaction can pass
// their `tx` through instead of getSettings grabbing a second connection
// from the pool -- on SQLite that second connection would otherwise have to
// wait for the enclosing transaction's connection to free up, which never
// happens since that transaction is itself awaiting this call. That's a
// real self-deadlock, not a theoretical one: it reproduces every time under
// the concurrent load of the test suite.
type PrismaClientOrTx = typeof prisma | Prisma.TransactionClient;

// Reads the singleton settings row, lazily creating it with schema defaults
// if it doesn't exist yet (e.g. a dev database from before this migration
// that hasn't been reseeded) -- callers never have to handle a missing row.
//
// This is called from inside circulation/hold transactions on the hot path,
// so it's a plain read (findUnique) in the common case rather than an
// always-write upsert -- an upsert issues a write query even when the row
// already exists (its @updatedAt bumps regardless), which would contend
// with the write lock an enclosing $transaction is already holding.
export async function getSettings(client: PrismaClientOrTx = prisma): Promise<SettingsData> {
  const existing = await client.setting.findUnique({ where: { id: SETTINGS_ID } });
  if (existing) return existing;
  return client.setting.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID, ...DEFAULTS },
  });
}

export async function updateSettings(
  partial: Partial<SettingsData>
): Promise<SettingsData> {
  return prisma.setting.upsert({
    where: { id: SETTINGS_ID },
    update: partial,
    create: { id: SETTINGS_ID, ...DEFAULTS, ...partial },
  });
}
