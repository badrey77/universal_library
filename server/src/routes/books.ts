import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

router.get("/", async (req, res) => {
  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";

  const books = await prisma.book.findMany({
    where: query
      ? {
          OR: [
            { title: { contains: query } },
            { author: { contains: query } },
            { isbn: { contains: query } },
          ],
        }
      : undefined,
    include: { copies: true },
    orderBy: { title: "asc" },
  });

  res.json(
    books.map((b) => ({
      id: b.id,
      isbn: b.isbn,
      title: b.title,
      author: b.author,
      description: b.description,
      category: b.category,
      theme: b.theme,
      totalCopies: b.copies.length,
      availableCopies: b.copies.filter((c) => c.status === "AVAILABLE").length,
    }))
  );
});

router.get("/:id", async (req, res) => {
  const book = await prisma.book.findUnique({
    where: { id: req.params.id },
    include: { copies: true },
  });
  if (!book) return res.status(404).json({ error: "Book not found", code: "BOOK_NOT_FOUND" });

  res.json({
    id: book.id,
    isbn: book.isbn,
    title: book.title,
    author: book.author,
    description: book.description,
    category: book.category,
    theme: book.theme,
    copies: book.copies.map((c) => ({ id: c.id, barcode: c.barcode, status: c.status })),
  });
});

// Public aggregate stats only -- how popular the book is, not who borrowed
// it (that's staff-only, see /:id/history/detail below).
router.get("/:id/history", async (req, res) => {
  const book = await prisma.book.findUnique({ where: { id: req.params.id } });
  if (!book) return res.status(404).json({ error: "Book not found", code: "BOOK_NOT_FOUND" });

  const [totalLoans, currentlyOnLoan] = await Promise.all([
    prisma.loan.count({ where: { copy: { bookId: book.id } } }),
    prisma.loan.count({ where: { copy: { bookId: book.id }, returnedAt: null } }),
  ]);

  res.json({ totalLoans, currentlyOnLoan });
});

// Staff-only detail: who borrowed which copy and when. Other members'
// borrowing activity is private, so this is gated behind requireRole("STAFF").
router.get("/:id/history/detail", requireAuth, requireRole("STAFF"), async (req, res) => {
  const book = await prisma.book.findUnique({ where: { id: req.params.id } });
  if (!book) return res.status(404).json({ error: "Book not found", code: "BOOK_NOT_FOUND" });

  const loans = await prisma.loan.findMany({
    where: { copy: { bookId: book.id } },
    include: { copy: true, member: true },
    orderBy: { checkedOutAt: "desc" },
    take: 100,
  });

  res.json(
    loans.map((loan) => ({
      loanId: loan.id,
      memberName: loan.member.name,
      memberEmail: loan.member.email,
      copyBarcode: loan.copy.barcode,
      checkedOutAt: loan.checkedOutAt,
      returnedAt: loan.returnedAt,
      renewalCount: loan.renewalCount,
    }))
  );
});

const createBookSchema = z.object({
  isbn: z.string().min(1),
  title: z.string().min(1),
  author: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  theme: z.string().optional(),
  initialCopies: z.number().int().min(0).max(50).default(1),
});

router.post("/", requireAuth, requireRole("STAFF"), async (req, res) => {
  const parsed = createBookSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten(), code: "VALIDATION_ERROR" });
  }
  const { isbn, title, author, description, category, theme, initialCopies } = parsed.data;

  const existing = await prisma.book.findUnique({ where: { isbn } });
  if (existing) {
    return res.status(409).json({ error: "ISBN already exists", code: "ISBN_TAKEN" });
  }

  const book = await prisma.book.create({
    data: {
      isbn,
      title,
      author,
      description,
      category,
      theme,
      copies: {
        create: Array.from({ length: initialCopies }, (_, i) => ({
          barcode: `${isbn}-C${i + 1}`,
        })),
      },
    },
    include: { copies: true },
  });

  res.status(201).json(book);
});

const addCopySchema = z.object({
  barcode: z.string().min(1).optional(),
});

router.post("/:id/copies", requireAuth, requireRole("STAFF"), async (req, res) => {
  const parsed = addCopySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten(), code: "VALIDATION_ERROR" });
  }

  const book = await prisma.book.findUnique({
    where: { id: req.params.id },
    include: { copies: true },
  });
  if (!book) return res.status(404).json({ error: "Book not found", code: "BOOK_NOT_FOUND" });

  const barcode = parsed.data.barcode ?? `${book.isbn}-C${book.copies.length + 1}`;
  const copy = await prisma.copy.create({
    data: { barcode, bookId: book.id },
  });

  res.status(201).json(copy);
});

export default router;
