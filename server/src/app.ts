import express from "express";
import cors from "cors";
import helmet from "helmet";
import authRouter from "./routes/auth";
import booksRouter from "./routes/books";
import circulationRouter from "./routes/circulation";
import holdsRouter from "./routes/holds";
import membersRouter from "./routes/members";
import settingsRouter from "./routes/settings";

// Builds the configured Express app with no side effects (no listen(),
// no timers). Exported so tests can drive it directly with supertest
// instead of binding a real port.
export function createApp() {
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
  app.use("/api/settings", settingsRouter);

  return app;
}

export const app = createApp();
