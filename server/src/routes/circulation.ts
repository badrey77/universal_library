import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth";
import { sendHttpError } from "../lib/httpError";
import { checkoutCopy, returnCopy, renewLoan } from "../services/circulationService";

const router = Router();

const checkoutSchema = z.object({
  barcode: z.string().min(1),
  memberId: z.string().min(1),
});

router.post("/checkout", requireAuth, requireRole("STAFF"), async (req, res) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten(), code: "VALIDATION_ERROR" });
  }

  try {
    const loan = await checkoutCopy(parsed.data.barcode, parsed.data.memberId);
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

  try {
    const result = await returnCopy(parsed.data.barcode);
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

  try {
    const loan = await renewLoan(parsed.data.loanId, req.user!);
    res.json(loan);
  } catch (err) {
    sendHttpError(res, err);
  }
});

export default router;
