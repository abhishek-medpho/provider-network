"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

/**
 * Record that a provider opened their offer link. Fire-and-forget from the
 * public offer page. Sets VIEWED + viewedAt the first time only — doesn't
 * downgrade a more-terminal status (ACCEPTED/DECLINED).
 */
export async function recordOfferViewed(token: string): Promise<void> {
  const offer = await prisma.jobOffer.findUnique({
    where: { token },
    select: { id: true, status: true, viewedAt: true },
  });
  if (!offer) return;
  if (offer.viewedAt) return;
  // Only bump SENT → VIEWED. Leave PENDING / ACCEPTED / DECLINED alone.
  if (offer.status !== "SENT") {
    await prisma.jobOffer.update({
      where: { id: offer.id },
      data: { viewedAt: new Date() },
    });
    return;
  }
  await prisma.jobOffer.update({
    where: { id: offer.id },
    data: { status: "VIEWED", viewedAt: new Date() },
  });
}

/**
 * Provider responds to an offer. Guards against:
 *   - unknown / expired tokens
 *   - already-responded offers (idempotent — returns current state)
 *   - the job being full (auto-flips to FILLED when slots are met)
 */
export async function respondToOffer(
  token: string,
  decision: "ACCEPTED" | "DECLINED",
): Promise<{ ok: boolean; status: string; message: string }> {
  const offer = await prisma.jobOffer.findUnique({
    where: { token },
    include: { job: true },
  });
  if (!offer) {
    return { ok: false, status: "UNKNOWN", message: "Offer not found." };
  }

  // Terminal states — don't re-process.
  if (offer.status === "ACCEPTED" || offer.status === "DECLINED") {
    return {
      ok: true,
      status: offer.status,
      message:
        offer.status === "ACCEPTED"
          ? "You've already accepted this job."
          : "You've already declined this job.",
    };
  }
  if (offer.status === "EXPIRED" || offer.status === "WITHDRAWN") {
    return {
      ok: false,
      status: offer.status,
      message: "This offer is no longer available.",
    };
  }
  if (offer.expiresAt && offer.expiresAt.getTime() < Date.now()) {
    await prisma.jobOffer.update({
      where: { id: offer.id },
      data: { status: "EXPIRED" },
    });
    return {
      ok: false,
      status: "EXPIRED",
      message: "This offer has expired.",
    };
  }

  if (decision === "ACCEPTED") {
    // Is the job already full?
    const acceptedCount = await prisma.jobOffer.count({
      where: { jobId: offer.jobId, status: "ACCEPTED" },
    });
    if (acceptedCount >= offer.job.slots) {
      // Race: filled before this provider accepted.
      await prisma.jobOffer.update({
        where: { id: offer.id },
        data: { status: "EXPIRED", respondedAt: new Date() },
      });
      return {
        ok: false,
        status: "FILLED",
        message:
          "Sorry, this job has just been filled. We'll send you the next one.",
      };
    }
  }

  await prisma.jobOffer.update({
    where: { id: offer.id },
    data: { status: decision, respondedAt: new Date() },
  });

  // Log a provider event for the admin timeline.
  await prisma.careProviderEvent.create({
    data: {
      careProviderId: offer.careProviderId,
      type: decision === "ACCEPTED" ? "JOB_ACCEPTED" : "JOB_DECLINED",
      payload: { jobId: offer.jobId, jobTitle: offer.job.title },
    },
  });

  // If accepting filled the job, flip it.
  if (decision === "ACCEPTED") {
    const acceptedCount = await prisma.jobOffer.count({
      where: { jobId: offer.jobId, status: "ACCEPTED" },
    });
    if (acceptedCount >= offer.job.slots && offer.job.status === "OPEN") {
      await prisma.job.update({
        where: { id: offer.jobId },
        data: { status: "FILLED" },
      });
    }
  }

  revalidatePath(`/admin/jobs/${offer.jobId}`);
  return {
    ok: true,
    status: decision,
    message:
      decision === "ACCEPTED"
        ? "You've accepted the job. Our team will reach out with details."
        : "You've declined. We'll send you other opportunities.",
  };
}
