"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

/**
 * Provider expresses willingness for a broadcast gig. This is NOT an
 * assignment — it just adds them to the willing pool. Ops picks one later.
 *
 * Idempotent + guarded:
 *   - unknown token → noop result
 *   - gig already assigned/closed → can't express interest anymore
 *   - already responded → returns current state
 */
export async function respondToGig(
  token: string,
  decision: "INTERESTED" | "DECLINED",
): Promise<{ ok: boolean; status: string; message: string }> {
  const resp = await prisma.gigResponse.findUnique({
    where: { token },
    include: { gig: true },
  });
  if (!resp) {
    return { ok: false, status: "UNKNOWN", message: "Request not found." };
  }

  // Terminal personal states.
  if (resp.status === "INTERESTED" || resp.status === "DECLINED") {
    return {
      ok: true,
      status: resp.status,
      message:
        resp.status === "INTERESTED"
          ? "Thanks — you've said you're available. We'll confirm if you're selected."
          : "You've passed on this one. We'll send you the next.",
    };
  }
  if (resp.status === "EXPIRED") {
    return {
      ok: false,
      status: "EXPIRED",
      message: "This request is no longer open.",
    };
  }

  // Gig-level guards: once the gig has moved past collecting interest, no
  // new hands. (Assigned/confirmed/completed/cancelled.)
  if (resp.gig.status !== "OPEN" && resp.gig.status !== "DRAFT") {
    await prisma.gigResponse.update({
      where: { id: resp.id },
      data: { status: "EXPIRED" },
    });
    return {
      ok: false,
      status: "CLOSED",
      message: "This request has already been assigned. We'll send you the next one.",
    };
  }

  await prisma.gigResponse.update({
    where: { id: resp.id },
    data: { status: decision, respondedAt: new Date() },
  });

  await prisma.careProviderEvent.create({
    data: {
      careProviderId: resp.careProviderId,
      type: decision === "INTERESTED" ? "GIG_INTERESTED" : "GIG_DECLINED",
      payload: { gigId: resp.gigId, gigTitle: resp.gig.title },
    },
  });

  revalidatePath(`/admin/gigs/${resp.gigId}`);
  return {
    ok: true,
    status: decision,
    message:
      decision === "INTERESTED"
        ? "Thanks — you're on the list. We'll confirm shortly if you're selected."
        : "No problem — we'll send you the next one.",
  };
}
