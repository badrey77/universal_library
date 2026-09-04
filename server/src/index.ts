import express from "express";
import cors from "cors";
import helmet from "helmet";
import authRouter from "./routes/auth";
import booksRouter from "./routes/books";
import circulationRouter from "./routes/circulation";
import holdsRouter from "./routes/holds";
import membersRouter from "./routes/members";
import { sweepExpiredHolds } from "./lib/holdSweep";

const app = express();
app.use(helmet());
// Restrict to the known frontend origin(s) rather than reflecting any
// origin — CORS_ORIGIN can be a comma-separated list for multiple deploys.
const allowedOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);
app.use("/api/books", booksRouter);
app.use("/api/circulation", circulationRouter);
app.use("/api/holds", holdsRouter);
app.use("/api/members", membersRouter);

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(port, () => {
  console.log(`Universal Library API listening on http://localhost:${port}`);
});

const HOLD_SWEEP_INTERVAL_MS = 5 * 60 * 1000;
sweepExpiredHolds().catch((err) => console.error("Hold sweep failed", err));
setInterval(() => {
  sweepExpiredHolds().catch((err) => console.error("Hold sweep failed", err));
}, HOLD_SWEEP_INTERVAL_MS);
