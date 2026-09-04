import express from "express";
import cors from "cors";
import authRouter from "./routes/auth";
import booksRouter from "./routes/books";
import circulationRouter from "./routes/circulation";
import holdsRouter from "./routes/holds";
import membersRouter from "./routes/members";

const app = express();
app.use(cors());
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
