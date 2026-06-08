"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { sendAssignmentDetails } from "@/lib/actions/gig-assign";

/**
 * Assigned provider reconfirms ("YES, I'll be there"). This is the hard
 * commitment that locks the gig. Only then do we:
 *   - flip gig → CONFIRMED
 *   - reveal full details to them (sendAssignmentDetails)
 *   - notify the standby bench that it's filled
 *
 * Guards: token must belong to the currently-assigned provider, and the
 * gig must still be ASSIGNED+AWAITING (not already confirmed/expired/
 * reassigned to someone else).
 */
export async function confirmGig(
  token: string,
): Promise<{ ok: boolean; status: string; message: string }> {
  const resp = await prisma.gigResponse.findUnique({
    where: { token },
    include: { gig: true },
  });
  if (!resp) return { ok: false, status: "UNKNOWN", message: "Request not found." };

  const gig = resp.gig;

  // Already confirmed by this provider.
  if (
    gig.status === "CONFIRMED" &&
    gig.assignedProviderId === resp.careProviderId
  ) {
    return {
      ok: true,
      status: "CONFIRMED",
      message: "You're confirmed. Details have been sent to you.",
    };
  }

  // This provider is no longer the assignee (reassigned / window lapsed).
  if (
    gig.assignedProviderId !== resp.careProviderId ||
    gig.assignmentStatus !== "AWAITING" ||
    gig.status !== "ASSIGNED"
  ) {
    return {
      ok: false,
      status: "LAPSED",
      message:
        "This assignment is no longer active — the slot may have moved on. We'll send you the next one.",
    };
  }

  // Past the deadline? Treat as lapsed (the scheduler may not have run yet).
  if (gig.confirmDeadline && gig.confirmDeadline.getTime() < Date.now()) {
    return {
      ok: false,
      status: "EXPIRED",
      message: "The confirmation window has closed. We'll send you the next one.",
    };
  }

  // Lock it in.
  await prisma.gig.update({
    where: { id: gig.id },
    data: {
      status: "CONFIRMED",
      assignmentStatus: "CONFIRMED",
      confirmedAt: new Date(),
    },
  });

  await prisma.careProviderEvent.create({
    data: {
      careProviderId: resp.careProviderId,
      type: "GIG_CONFIRMED",
      payload: { gigId: gig.id, gigTitle: gig.title },
    },
  });

  // Reveal full details to the confirmed provider.
  await sendAssignmentDetails(gig.id);

  // Notify the standby bench: filled this time. (Don't expire them silently;
  // a friendly "we'll ping you next time" keeps them responsive.)
  await notifyStandbyFilled(gig.id, resp.careProviderId);

  revalidatePath(`/admin/gigs/${gig.id}`);
  return {
    ok: true,
    status: "CONFIRMED",
    message:
      "You're confirmed! We've sent you the full address and patient details.",
  };
}

/**
 * Tell everyone who raised their hand but wasn't picked that the gig is
 * filled. Marks their responses EXPIRED (so they're no longer "live"
 * standby) and sends a short courtesy note.
 */
async function notifyStandbyFilled(
  gigId: string,
  selectedProviderId: string,
): Promise<void> {
  const bench = await prisma.gigResponse.findMany({
    where: {
      gigId,
      status: "INTERESTED",
      careProviderId: { not: selectedProviderId },
    },
    include: { careProvider: true },
  });
  if (bench.length === 0) return;

  // Mark them expired (no longer the active standby pool — the gig is locked).
  await prisma.gigResponse.updateMany({
    where: {
      gigId,
      status: "INTERESTED",
      careProviderId: { not: selectedProviderId },
    },
    data: { status: "EXPIRED" },
  });

  // Courtesy message — best-effort, only if a template exists.
  const tpl = await prisma.messageTemplate.findFirst({
    where: {
      code: "gig_filled",
      language: "en",
      active: true,
      channel: "WHATSAPP",
    },
  });
  if (!tpl) return;

  const { renderBody } = await import("@/lib/messageTemplate");
  const { SENDERS } = await import("@/lib/channels");
  for (const b of bench) {
    if (!b.careProvider.phone) continue;
    const body = renderBody(tpl.body, {
      name: b.careProvider.name ?? "there",
      first_name: (b.careProvider.name ?? "there").split(/\s+/)[0],
    });
    const r = await SENDERS.WHATSAPP.send({ to: b.careProvider.phone, body });
    await prisma.whatsAppMessage
      .create({
        data: {
          careProviderId: b.careProviderId,
          messageTemplateId: tpl.id,
          toPhone: b.careProvider.phone,
          body,
          status: r.ok ? "SENT" : "FAILED",
          ultramsgMessageId: r.ok ? r.messageId : null,
          errorMessage: !r.ok ? r.error : null,
          sentAt: r.ok ? new Date() : null,
        },
      })
      .catch(() => {});
  }
}
