import { app } from "./app";
import { sweepExpiredHolds } from "./lib/holdSweep";

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(port, () => {
  console.log(`Universal Library API listening on http://localhost:${port}`);
});

const HOLD_SWEEP_INTERVAL_MS = 5 * 60 * 1000;
sweepExpiredHolds().catch((err) => console.error("Hold sweep failed", err));
setInterval(() => {
  sweepExpiredHolds().catch((err) => console.error("Hold sweep failed", err));
}, HOLD_SWEEP_INTERVAL_MS);
