"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { renderBody } from "@/lib/messageTemplate";
import { SENDERS } from "@/lib/channels";
import { gigTaskLabel } from "@/lib/gigs/labels";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user;
}

/**
 * Compute the reconfirm deadline: min(now + 3h, scheduledFor - 2h).
 * For a gig far out → 3h to confirm. For one close to its slot → must
 * confirm by T-minus-2h so there's still buffer to fall back.
 */
function computeConfirmDeadline(scheduledFor: Date): Date {
  const threeHours = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const tMinus2 = new Date(scheduledFor.getTime() - 2 * 60 * 60 * 1000);
  // If the slot is already <2h away, give a short 30-min window rather than
  // a past timestamp.
  if (tMinus2.getTime() <= Date.now()) {
    return new Date(Date.now() + 30 * 60 * 1000);
  }
  return threeHours < tMinus2 ? threeHours : tMinus2;
}

/**
 * Assign a gig to a chosen provider from the willing pool. Sets the gig to
 * ASSIGNED + AWAITING reconfirmation, sends the reconfirm message (still no
 * address — that's revealed only on confirm). Does NOT notify the standby
 * bench yet (they stay warm until this provider confirms).
 */
export async function assignGig(
  gigId: string,
  careProviderId: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();

  const gig = await prisma.gig.findUnique({ where: { id: gigId } });
  if (!gig) return { ok: false, error: "Gig not found" };
  if (gig.status !== "OPEN" && gig.status !== "ASSIGNED") {
    return { ok: false, error: `Can't assign a ${gig.status} gig` };
  }

  // The provider must be in the willing pool.
  const resp = await prisma.gigResponse.findUnique({
    where: { gigId_careProviderId: { gigId, careProviderId } },
    include: { careProvider: true },
  });
  if (!resp || resp.status !== "INTERESTED") {
    return { ok: false, error: "That provider hasn't said they're available" };
  }

  const confirmDeadline = computeConfirmDeadline(gig.scheduledFor);

  await prisma.gig.update({
    where: { id: gigId },
    data: {
      status: "ASSIGNED",
      assignedProviderId: careProviderId,
      assignmentStatus: "AWAITING",
      assignedAt: new Date(),
      confirmDeadline,
      confirmedAt: null,
    },
  });

  await sendReconfirmMessage(gigId, careProviderId, confirmDeadline);

  revalidatePath(`/admin/gigs/${gigId}`);
  return { ok: true };
}

/**
 * Fire the reconfirm message to the assigned provider. Reused by the
 * scheduler when it promotes a standby. Carries the reconfirm link.
 */
export async function sendReconfirmMessage(
  gigId: string,
  careProviderId: string,
  confirmDeadline: Date,
): Promise<void> {
  const gig = await prisma.gig.findUnique({
    where: { id: gigId },
    include: { profileType: true },
  });
  const resp = await prisma.gigResponse.findUnique({
    where: { gigId_careProviderId: { gigId, careProviderId } },
    include: { careProvider: true },
  });
  if (!gig || !resp) return;

  const baseUrl = process.env.APP_BASE_URL || process.env.NEXTAUTH_URL || "";
  const link = `${baseUrl}/confirm/${resp.token}`;
  const by = new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(confirmDeadline);

  const templates = await prisma.messageTemplate.findMany({
    where: { code: "gig_reconfirm", language: "en", active: true },
  });
  const waTpl = templates.find((t) => t.channel === "WHATSAPP");
  const emailTpl = templates.find((t) => t.channel === "EMAIL");

  const vars: Record<string, string> = {
    name: resp.careProvider.name ?? "there",
    first_name: (resp.careProvider.name ?? "there").split(/\s+/)[0],
    task: gigTaskLabel(gig.type),
    confirm_by: by,
    confirm_link: link,
  };

  const cp = resp.careProvider;
  if (cp.phone && waTpl) {
    const body = renderBody(waTpl.body, vars);
    const r = await SENDERS.WHATSAPP.send({ to: cp.phone, body });
    await prisma.whatsAppMessage.create({
      data: {
        careProviderId: cp.id,
        messageTemplateId: waTpl.id,
        toPhone: cp.phone,
        body,
        status: r.ok ? "SENT" : "FAILED",
        ultramsgMessageId: r.ok ? r.messageId : null,
        errorMessage: !r.ok ? r.error : null,
        sentAt: r.ok ? new Date() : null,
      },
    });
  } else if (cp.email && emailTpl) {
    const subject = renderBody(emailTpl.subject ?? "", vars);
    const body = renderBody(emailTpl.body, vars);
    const html = emailTpl.html ? renderBody(emailTpl.html, vars) : undefined;
    const draft = await prisma.emailMessage.create({
      data: {
        careProviderId: cp.id,
        messageTemplateId: emailTpl.id,
        toEmail: cp.email,
        subject,
        body,
        status: "SENDING",
      },
    });
    const r = await SENDERS.EMAIL.send({
      to: cp.email,
      subject,
      body,
      html,
      trackingId: draft.id,
    });
    await prisma.emailMessage.update({
      where: { id: draft.id },
      data: {
        status: r.ok ? "SENT" : "FAILED",
        providerMessageId: r.ok ? r.messageId : null,
        errorMessage: !r.ok ? r.error : null,
        sentAt: r.ok ? new Date() : null,
      },
    });
  }
}

/**
 * Send the full-details message to a now-CONFIRMED provider (address,
 * patient, requester contact). Called from the confirm action.
 */
export async function sendAssignmentDetails(gigId: string): Promise<void> {
  const gig = await prisma.gig.findUnique({
    where: { id: gigId },
    include: { profileType: true, assignedProvider: true },
  });
  if (!gig || !gig.assignedProvider) return;
  const cp = gig.assignedProvider;

  const baseUrl = process.env.APP_BASE_URL || process.env.NEXTAUTH_URL || "";
  // Link to the completion form if an SOP form is configured.
  const completeLink = gig.sopFormTemplateId
    ? `${baseUrl}/gig-complete/${gig.id}`
    : "";

  const templates = await prisma.messageTemplate.findMany({
    where: { code: "gig_assigned", language: "en", active: true },
  });
  const waTpl = templates.find((t) => t.channel === "WHATSAPP");

  const when = new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(gig.scheduledFor);

  const vars: Record<string, string> = {
    name: cp.name ?? "there",
    first_name: (cp.name ?? "there").split(/\s+/)[0],
    task: gigTaskLabel(gig.type),
    when,
    patient_name: gig.patientName ?? "",
    address: gig.siteAddress ?? gig.siteArea ?? "",
    requester_phone: gig.requesterPhone ?? "",
    complete_link: completeLink,
  };

  if (cp.phone && waTpl) {
    const body = renderBody(waTpl.body, vars);
    const r = await SENDERS.WHATSAPP.send({ to: cp.phone, body });
    await prisma.whatsAppMessage.create({
      data: {
        careProviderId: cp.id,
        messageTemplateId: waTpl.id,
        toPhone: cp.phone,
        body,
        status: r.ok ? "SENT" : "FAILED",
        ultramsgMessageId: r.ok ? r.messageId : null,
        errorMessage: !r.ok ? r.error : null,
        sentAt: r.ok ? new Date() : null,
      },
    });
  }
}
