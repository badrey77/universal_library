import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth";
import { getSettings, updateSettings } from "../lib/settings";

const router = Router();

router.get("/", requireAuth, requireRole("STAFF"), async (_req, res) => {
  const settings = await getSettings();
  res.json({
    loanPeriodDays: settings.loanPeriodDays,
    maxRenewals: settings.maxRenewals,
    holdReadyDays: settings.holdReadyDays,
    defaultBorrowLimit: settings.defaultBorrowLimit,
  });
});

const updateSettingsSchema = z.object({
  loanPeriodDays: z.number().int().min(1).max(365).optional(),
  maxRenewals: z.number().int().min(0).max(10).optional(),
  holdReadyDays: z.number().int().min(1).max(365).optional(),
  defaultBorrowLimit: z.number().int().min(1).max(50).optional(),
});

router.put("/", requireAuth, requireRole("STAFF"), async (req, res) => {
  const parsed = updateSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten(), code: "VALIDATION_ERROR" });
  }

  const settings = await updateSettings(parsed.data);
  res.json({
    loanPeriodDays: settings.loanPeriodDays,
    maxRenewals: settings.maxRenewals,
    holdReadyDays: settings.holdReadyDays,
    defaultBorrowLimit: settings.defaultBorrowLimit,
  });
});

export default router;
