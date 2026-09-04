import { prisma } from "./prisma";
import { assignNextHoldOrRelease } from "./holdAssignment";

// A hold left READY past its expiresAt means the patron never picked up the
// copy — sweep it to EXPIRED and hand the copy to the next person waiting
// (or release it) instead of leaving it stuck ON_HOLD forever.
export async function sweepExpiredHolds(): Promise<number> {
  const expired = await prisma.hold.findMany({
    where: { status: "READY", expiresAt: { lt: new Date() } },
    select: { id: true, copyId: true, bookId: true },
  });

  let swept = 0;
  for (const hold of expired) {
    if (!hold.copyId) continue;
    await prisma.$transaction(async (tx) => {
      const claim = await tx.hold.updateMany({
        where: { id: hold.id, status: "READY" },
        data: { status: "EXPIRED" },
      });
      if (claim.count !== 1) return;
      await assignNextHoldOrRelease(tx, hold.copyId as string, hold.bookId);
    });
    swept++;
  }
  return swept;
}
