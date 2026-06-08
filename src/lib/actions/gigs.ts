"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { type Prisma, type MessageChannel, type GigType } from "@prisma/client";
import { matchForWave } from "@/lib/gigs/matching";
import { gigTaskLabel } from "@/lib/gigs/labels";
import { renderBody } from "@/lib/messageTemplate";
import { SENDERS } from "@/lib/channels";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user;
}

function parseRequiredSkills(formData: FormData): Prisma.InputJsonValue {
  const raw = String(formData.get("requiredSkills") ?? "").trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (r) =>
          r &&
          typeof r.attributeKey === "string" &&
          Array.isArray(r.values) &&
          r.values.length > 0,
      )
      .map((r) => ({
        attributeKey: String(r.attributeKey),
        values: r.values.map(String),
      }));
  } catch {
    return [];
  }
}

function commonGigFields(formData: FormData) {
  const latRaw = String(formData.get("lat") ?? "").trim();
  const lngRaw = String(formData.get("lng") ?? "").trim();
  const scheduledRaw = String(formData.get("scheduledFor") ?? "").trim();
  return {
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || null,
    requesterName: String(formData.get("requesterName") ?? "").trim() || null,
    requesterPhone: String(formData.get("requesterPhone") ?? "").trim() || null,
    patientName: String(formData.get("patientName") ?? "").trim() || null,
    siteAddress: String(formData.get("siteAddress") ?? "").trim() || null,
    siteArea: String(formData.get("siteArea") ?? "").trim() || null,
    pincode: String(formData.get("pincode") ?? "").trim() || null,
    lat: latRaw ? Number(latRaw) : null,
    lng: lngRaw ? Number(lngRaw) : null,
    radiusKm: Number(formData.get("radiusKm") ?? 8) || 8,
    payText: String(formData.get("payText") ?? "").trim() || null,
    sopFormTemplateId:
      String(formData.get("sopFormTemplateId") ?? "").trim() || null,
    scheduledFor: scheduledRaw ? new Date(scheduledRaw) : null,
    requiredSkills: parseRequiredSkills(formData),
  };
}

export async function createGig(formData: FormData) {
  await requireAdmin();
  const f = commonGigFields(formData);
  if (!f.title) throw new Error("Title is required");
  if (!f.scheduledFor || isNaN(f.scheduledFor.getTime()))
    throw new Error("Scheduled date/time is required");

  const profileTypeId = String(formData.get("profileTypeId") ?? "").trim();
  if (!profileTypeId) throw new Error("Role is required");
  const typeRaw = String(formData.get("type") ?? "SAMPLE_COLLECTION");
  const type = (
    ["SAMPLE_COLLECTION", "HOME_NURSING_VISIT", "OTHER"].includes(typeRaw)
      ? typeRaw
      : "SAMPLE_COLLECTION"
  ) as GigType;

  const gig = await prisma.gig.create({
    data: {
      ...f,
      scheduledFor: f.scheduledFor,
      type,
      profileTypeId,
      status: "DRAFT",
    },
  });
  revalidatePath("/admin/gigs");
  redirect(`/admin/gigs/${gig.id}`);
}

export async function updateGig(id: string, formData: FormData) {
  await requireAdmin();
  const f = commonGigFields(formData);
  if (!f.title) throw new Error("Title is required");
  if (!f.scheduledFor || isNaN(f.scheduledFor.getTime()))
    throw new Error("Scheduled date/time is required");

  await prisma.gig.update({
    where: { id },
    data: { ...f, scheduledFor: f.scheduledFor },
  });
  revalidatePath(`/admin/gigs/${id}`);
}

export async function cancelGig(id: string, reason?: string) {
  await requireAdmin();
  await prisma.gig.update({
    where: { id },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelReason: reason ?? null,
    },
  });
  // Expire any open responses so nobody acts on a dead gig.
  await prisma.gigResponse.updateMany({
    where: { gigId: id, status: { in: ["NOTIFIED", "INTERESTED"] } },
    data: { status: "EXPIRED" },
  });
  revalidatePath(`/admin/gigs/${id}`);
  revalidatePath("/admin/gigs");
}

/**
 * Broadcast one wave for a gig. Matches fresh providers (excluding anyone
 * already reached), creates a GigResponse per provider, and fires the
 * lightweight broadcast message (area/task/time/pay — NO patient address).
 * Flips DRAFT → OPEN. Increments currentWave.
 */
export async function broadcastWave(
  gigId: string,
  opts: { relaxSkills?: boolean; limit?: number } = {},
): Promise<{ ok: boolean; wave: number; reached: number; error?: string }> {
  await requireAdmin();

  const gig = await prisma.gig.findUnique({
    where: { id: gigId },
    include: { profileType: true },
  });
  if (!gig) return { ok: false, wave: 0, reached: 0, error: "Gig not found" };
  if (gig.status === "CANCELLED" || gig.status === "COMPLETED")
    return { ok: false, wave: gig.currentWave, reached: 0, error: "Gig is closed" };

  const nextWave = gig.currentWave + 1;
  // Wave 1 = base radius/full skills. Each later wave widens radius x1.6
  // and (from wave 3) relaxes skills.
  const radiusMultiplier = Math.pow(1.6, nextWave - 1);
  const relaxSkills = opts.relaxSkills ?? nextWave >= 3;

  const candidates = await matchForWave(
    {
      id: gig.id,
      profileTypeId: gig.profileTypeId,
      pincode: gig.pincode,
      lat: gig.lat,
      lng: gig.lng,
      radiusKm: gig.radiusKm,
      requiredSkills: gig.requiredSkills,
    },
    { wave: nextWave, radiusMultiplier, relaxSkills, limit: opts.limit },
  );

  if (candidates.length === 0) {
    return { ok: true, wave: gig.currentWave, reached: 0 };
  }

  const templates = await prisma.messageTemplate.findMany({
    where: { code: "gig_broadcast", language: "en", active: true },
  });
  const waTpl = templates.find((t) => t.channel === "WHATSAPP");
  const emailTpl = templates.find((t) => t.channel === "EMAIL");

  const baseUrl = process.env.APP_BASE_URL || process.env.NEXTAUTH_URL || "";
  const when = formatWhen(gig.scheduledFor);
  let reached = 0;

  for (const cand of candidates) {
    const resp = await prisma.gigResponse.create({
      data: {
        gigId: gig.id,
        careProviderId: cand.careProviderId,
        status: "NOTIFIED",
        wave: nextWave,
        distanceKm: cand.distanceKm,
        notifiedAt: new Date(),
      },
    });

    const link = `${baseUrl}/respond/${resp.token}`;
    const vars: Record<string, string> = {
      name: cand.name ?? "there",
      first_name: (cand.name ?? "there").split(/\s+/)[0],
      task: gigTaskLabel(gig.type),
      area: gig.siteArea ?? gig.pincode ?? "",
      when,
      pay: gig.payText ?? "",
      respond_link: link,
    };

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

    await prisma.gigResponse.update({
      where: { id: resp.id },
      data: { channel },
    });
    if (ok) reached++;
  }

  await prisma.gig.update({
    where: { id: gig.id },
    data: {
      currentWave: nextWave,
      ...(gig.status === "DRAFT" ? { status: "OPEN" } : {}),
    },
  });

  revalidatePath(`/admin/gigs/${gigId}`);
  return { ok: true, wave: nextWave, reached };
}

// ───────────── helpers ─────────────

function formatWhen(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(new Date(d));
}
