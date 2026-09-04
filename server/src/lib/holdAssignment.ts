import { Prisma } from "@prisma/client";
import { HOLD_READY_DAYS, addDays } from "./policy";

// Claims the oldest waiting hold for a book onto a specific copy via CAS,
// retrying against the next hold in line if a concurrent process already
// claimed the one first tried. Falls back to releasing the copy if the
// queue is empty (or exhausted after a few retries).
export async function assignNextHoldOrRelease(
  tx: Prisma.TransactionClient,
  copyId: string,
  bookId: string
): Promise<{ copyStatus: "ON_HOLD" | "AVAILABLE"; reservedForMemberId: string | null }> {
  const triedHoldIds: string[] = [];

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = await tx.hold.findFirst({
      where: { bookId, status: "WAITING", id: { notIn: triedHoldIds } },
      orderBy: { requestedAt: "asc" },
    });
    if (!candidate) break;

    const claim = await tx.hold.updateMany({
      where: { id: candidate.id, status: "WAITING" },
      data: {
        status: "READY",
        copyId,
        expiresAt: addDays(new Date(), HOLD_READY_DAYS),
      },
    });
    if (claim.count === 1) {
      await tx.copy.update({ where: { id: copyId }, data: { status: "ON_HOLD" } });
      return { copyStatus: "ON_HOLD", reservedForMemberId: candidate.memberId };
    }
    triedHoldIds.push(candidate.id);
  }

  await tx.copy.update({ where: { id: copyId }, data: { status: "AVAILABLE" } });
  return { copyStatus: "AVAILABLE", reservedForMemberId: null };
}
