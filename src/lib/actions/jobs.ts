"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { type Prisma, type MessageChannel } from "@prisma/client";
import { matchProvidersForJob } from "@/lib/jobs/matching";
import { renderBody } from "@/lib/messageTemplate";
import { SENDERS } from "@/lib/channels";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user;
}

export async function createJob(formData: FormData) {
  await requireAdmin();

  const title = String(formData.get("title") ?? "").trim();
  if (!title) throw new Error("Title is required");
  const profileTypeId = String(formData.get("profileTypeId") ?? "").trim();
  if (!profileTypeId) throw new Error("Profile type is required");

  const pincode = String(formData.get("pincode") ?? "").trim() || null;
  const latRaw = String(formData.get("lat") ?? "").trim();
  const lngRaw = String(formData.get("lng") ?? "").trim();
  const lat = latRaw ? Number(latRaw) : null;
  const lng = lngRaw ? Number(lngRaw) : null;
  const radiusKm = Number(formData.get("radiusKm") ?? 10) || 10;
  const slots = Math.max(1, Number(formData.get("slots") ?? 1) || 1);

  const job = await prisma.job.create({
    data: {
      title,
      description: String(formData.get("description") ?? "").trim() || null,
      profileTypeId,
      pincode,
      lat,
      lng,
      radiusKm,
      shiftType: String(formData.get("shiftType") ?? "").trim() || null,
      payText: String(formData.get("payText") ?? "").trim() || null,
      slots,
      offerTTLHours: Number(formData.get("offerTTLHours") ?? 48) || 48,
      status: "DRAFT",
    },
  });

  revalidatePath("/admin/jobs");
  redirect(`/admin/jobs/${job.id}`);
}

export async function updateJob(id: string, formData: FormData) {
  await requireAdmin();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) throw new Error("Title is required");

  const latRaw = String(formData.get("lat") ?? "").trim();
  const lngRaw = String(formData.get("lng") ?? "").trim();

  await prisma.job.update({
    where: { id },
    data: {
      title,
      description: String(formData.get("description") ?? "").trim() || null,
      pincode: String(formData.get("pincode") ?? "").trim() || null,
      lat: latRaw ? Number(latRaw) : null,
      lng: lngRaw ? Number(lngRaw) : null,
      radiusKm: Number(formData.get("radiusKm") ?? 10) || 10,
      shiftType: String(formData.get("shiftType") ?? "").trim() || null,
      payText: String(formData.get("payText") ?? "").trim() || null,
      slots: Math.max(1, Number(formData.get("slots") ?? 1) || 1),
      offerTTLHours: Number(formData.get("offerTTLHours") ?? 48) || 48,
    },
  });
  revalidatePath(`/admin/jobs/${id}`);
}

export async function setJobStatus(id: string, status: string) {
  await requireAdmin();
  await prisma.job.update({
    where: { id },
    data: { status: status as Prisma.JobUpdateInput["status"] },
  });
  revalidatePath(`/admin/jobs/${id}`);
  revalidatePath("/admin/jobs");
}

/**
 * Dispatch offers to the matched candidate set. Creates a JobOffer per
 * provider, fires a transactional "job_offer" message with the accept/
 * decline link, and flips the job to OPEN. Channel selection: WhatsApp if
 * the provider has a phone, else email.
 *
 * Respects offer TTL — each offer gets an expiresAt the scheduler can use
 * to mark stale offers EXPIRED later.
 */
export async function dispatchJobOffers(
  jobId: string,
  opts: { limit?: number } = {},
): Promise<{ ok: boolean; created: number; sent: number; error?: string }> {
  await requireAdmin();

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { profileType: true },
  });
  if (!job) return { ok: false, created: 0, sent: 0, error: "Job not found" };

  const candidates = await matchProvidersForJob(jobId, { limit: opts.limit });
  if (candidates.length === 0) {
    return { ok: true, created: 0, sent: 0 };
  }

  const baseUrl = process.env.APP_BASE_URL || process.env.NEXTAUTH_URL || "";
  const expiresAt = new Date(Date.now() + job.offerTTLHours * 60 * 60 * 1000);

  // Look up the offer template once (WhatsApp + email variants).
  const templates = await prisma.messageTemplate.findMany({
    where: { code: "job_offer", language: "en", active: true },
  });
  const waTpl = templates.find((t) => t.channel === "WHATSAPP");
  const emailTpl = templates.find((t) => t.channel === "EMAIL");

  let created = 0;
  let sent = 0;

  for (const cand of candidates) {
    // Create the offer first so we have the token for the link.
    const offer = await prisma.jobOffer.create({
      data: {
        jobId: job.id,
        careProviderId: cand.careProviderId,
        status: "PENDING",
        distanceKm: cand.distanceKm,
        expiresAt,
      },
    });
    created++;

    const offerLink = `${baseUrl}/offer/${offer.token}`;
    const vars: Record<string, string> = {
      name: cand.name ?? "there",
      first_name: (cand.name ?? "there").split(/\s+/)[0],
      job_title: job.title,
      pay: job.payText ?? "",
      shift: job.shiftType ?? "",
      pincode: job.pincode ?? "",
      offer_link: offerLink,
    };

    // Channel pick: WhatsApp if phone, else email.
    let channel: MessageChannel | null = null;
    let ok = false;
    if (cand.phone && waTpl) {
      channel = "WHATSAPP";
      const body = renderBody(waTpl.body, vars);
      const r = await SENDERS.WHATSAPP.send({ to: cand.phone, body });
      await prisma.whatsAppMessage.create({
        data: {
          careProviderId: cand.careProviderId,
          messageTemplateId: waTpl.id,
          toPhone: cand.phone,
          body,
          status: r.ok ? "SENT" : "FAILED",
          ultramsgMessageId: r.ok ? r.messageId : null,
          errorMessage: !r.ok ? r.error : null,
          sentAt: r.ok ? new Date() : null,
        },
      });
      ok = r.ok;
    } else if (cand.email && emailTpl) {
      channel = "EMAIL";
      const subject = renderBody(emailTpl.subject ?? "", vars);
      const body = renderBody(emailTpl.body, vars);
      const html = emailTpl.html ? renderBody(emailTpl.html, vars) : undefined;
      const draft = await prisma.emailMessage.create({
        data: {
          careProviderId: cand.careProviderId,
          messageTemplateId: emailTpl.id,
          toEmail: cand.email,
          subject,
          body,
          status: "SENDING",
        },
      });
      const r = await SENDERS.EMAIL.send({
        to: cand.email,
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
      ok = r.ok;
    }

    await prisma.jobOffer.update({
      where: { id: offer.id },
      data: {
        status: ok ? "SENT" : "PENDING",
        channel,
        sentAt: ok ? new Date() : null,
      },
    });
    if (ok) sent++;
  }

  // Flip job to OPEN once offers are out.
  if (job.status === "DRAFT") {
    await prisma.job.update({ where: { id: job.id }, data: { status: "OPEN" } });
  }

  revalidatePath(`/admin/jobs/${jobId}`);
  return { ok: true, created, sent };
}
