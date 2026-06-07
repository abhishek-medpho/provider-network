/**
 * Offer-expiry tick. Marks JobOffers EXPIRED once their offer window
 * passes with no terminal response. Run by both:
 *   - the in-process scheduler loop (every dispatch tick), and
 *   - the HTTP cron route /api/cron/expire-offers (external scheduler).
 *
 * "No terminal response" = status is still PENDING / SENT / VIEWED. We
 * deliberately leave ACCEPTED / DECLINED / WITHDRAWN alone.
 */

import { prisma } from "@/lib/db";

export type ExpiryTickResult = { expired: number };

export async function runExpiryTick(): Promise<ExpiryTickResult> {
  const now = new Date();

  const result = await prisma.jobOffer.updateMany({
    where: {
      status: { in: ["PENDING", "SENT", "VIEWED"] },
      expiresAt: { not: null, lt: now },
    },
    data: { status: "EXPIRED" },
  });

  if (result.count > 0) {
    console.log(`[expiry] marked ${result.count} offer(s) EXPIRED`);
  }
  return { expired: result.count };
}
