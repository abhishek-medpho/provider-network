"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CampaignStatus, type Prisma } from "@prisma/client";
import Papa from "papaparse";
import { normalizePhone } from "@/lib/phone";
import { renderBody } from "@/lib/messageTemplate";
import { pacedSleep } from "@/lib/ultramsg";
import { SENDERS, type Channel } from "@/lib/channels";
import type { CareProvider, MessageTemplate, CampaignMember } from "@prisma/client";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user;
}

// ---------------------------------------------------------------------------
// Campaign CRUD
// ---------------------------------------------------------------------------

export async function createCampaign(formData: FormData) {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name is required");

  const profileTypeId = String(formData.get("profileTypeId") ?? "").trim();
  if (!profileTypeId) throw new Error("Profile type is required");

  const formTemplateIdRaw = String(formData.get("formTemplateId") ?? "").trim();
  const formTemplateId = formTemplateIdRaw === "" ? null : formTemplateIdRaw;

  const inviteMessageTemplateIdRaw = String(
    formData.get("inviteMessageTemplateId") ?? "",
  ).trim();
  const inviteMessageTemplateId =
    inviteMessageTemplateIdRaw === "" ? null : inviteMessageTemplateIdRaw;

  // Reminder rules — parse repeating fields
  const reminderRules = parseReminderRulesFromForm(formData);

  // Throttling
  // Accept both new and legacy form field names so an in-flight form submit
  // from an older client still works.
  const maxSendsPerLaunch = Number(
    formData.get("maxSendsPerLaunch") ?? formData.get("maxSendsPerDay") ?? 100,
  );
  const maxSendsPerProvider = Number(formData.get("maxSendsPerProvider") ?? 4);

  const created = await prisma.campaign.create({
    data: {
      name,
      profileTypeId,
      formTemplateId,
      inviteMessageTemplateId,
      reminderRules: reminderRules as unknown as Prisma.InputJsonValue,
      throttle: {
        maxSendsPerLaunch,
        maxSendsPerProvider,
      } as Prisma.InputJsonValue,
      stopConditions: [
        "status>=VERIFIED",
        "optedOut=true",
      ] as unknown as Prisma.InputJsonValue,
      status: CampaignStatus.DRAFT,
    },
  });

  revalidatePath("/admin/campaigns");
  redirect(`/admin/campaigns/${created.id}`);
}

export async function updateCampaignSettings(id: string, formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name is required");

  const formTemplateIdRaw = String(formData.get("formTemplateId") ?? "").trim();
  const formTemplateId = formTemplateIdRaw === "" ? null : formTemplateIdRaw;

  const inviteMessageTemplateIdRaw = String(
    formData.get("inviteMessageTemplateId") ?? "",
  ).trim();
  const inviteMessageTemplateId =
    inviteMessageTemplateIdRaw === "" ? null : inviteMessageTemplateIdRaw;

  const reminderRules = parseReminderRulesFromForm(formData);
  // Accept both new and legacy form field names so an in-flight form submit
  // from an older client still works.
  const maxSendsPerLaunch = Number(
    formData.get("maxSendsPerLaunch") ?? formData.get("maxSendsPerDay") ?? 100,
  );
  const maxSendsPerProvider = Number(formData.get("maxSendsPerProvider") ?? 4);

  await prisma.campaign.update({
    where: { id },
    data: {
      name,
      formTemplateId,
      inviteMessageTemplateId,
      reminderRules: reminderRules as unknown as Prisma.InputJsonValue,
      throttle: {
        maxSendsPerLaunch,
        maxSendsPerProvider,
      } as Prisma.InputJsonValue,
    },
  });
  revalidatePath(`/admin/campaigns/${id}`);
}

function parseReminderRulesFromForm(formData: FormData) {
  const rules: Array<{
    triggerAfterHours: number;
    messageTemplateId: string;
    maxSends: number;
  }> = [];
  const indices = new Set<number>();
  for (const key of formData.keys()) {
    const m = /^reminder_(hours|template|maxsends)_(\d+)$/.exec(key);
    if (m) indices.add(Number(m[2]));
  }
  for (const i of Array.from(indices).sort((a, b) => a - b)) {
    const h = Number(formData.get(`reminder_hours_${i}`));
    const t = String(formData.get(`reminder_template_${i}`) ?? "").trim();
    const m = Number(formData.get(`reminder_maxsends_${i}`) ?? 1);
    if (Number.isFinite(h) && h > 0 && t) {
      rules.push({ triggerAfterHours: h, messageTemplateId: t, maxSends: m || 1 });
    }
  }
  return rules;
}

// ---------------------------------------------------------------------------
// Lead upload (CSV)
// ---------------------------------------------------------------------------

const PHONE_COLUMN_HINTS = [
  "phone",
  "phone number",
  "phone_number",
  "mobile",
  "mobile number",
  "whatsapp",
  "whatsapp number",
  "contact",
  "contact number",
];

const NAME_COLUMN_HINTS = [
  "name",
  "full name",
  "full_name",
  "candidate name",
  "first name",
];

const EMAIL_COLUMN_HINTS = ["email", "email id", "email_id", "e-mail"];

function pickColumn(headers: string[], hints: string[]): string | null {
  const lower = headers.map((h) => h.trim().toLowerCase());
  for (const hint of hints) {
    const idx = lower.indexOf(hint);
    if (idx >= 0) return headers[idx];
  }
  return null;
}

export async function uploadLeads(
  campaignId: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string; created?: number; matched?: number; skipped?: number }> {
  const user = await requireAdmin();

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0)
    return { ok: false, error: "No file uploaded" };

  const source = String(formData.get("source") ?? "").trim() || null;

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, profileTypeId: true, status: true },
  });
  if (!campaign) return { ok: false, error: "Campaign not found" };

  const text = await file.text();

  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (parsed.errors.length > 0) {
    return {
      ok: false,
      error: `CSV parse error: ${parsed.errors[0].message}`,
    };
  }

  const rows = parsed.data;
  if (rows.length === 0)
    return { ok: false, error: "CSV has no data rows" };

  const headers = parsed.meta.fields ?? [];
  const phoneCol = pickColumn(headers, PHONE_COLUMN_HINTS);
  if (!phoneCol) {
    return {
      ok: false,
      error: `No phone column found. Expected one of: ${PHONE_COLUMN_HINTS.join(", ")}`,
    };
  }
  const nameCol = pickColumn(headers, NAME_COLUMN_HINTS);
  const emailCol = pickColumn(headers, EMAIL_COLUMN_HINTS);

  // Create LeadBatch
  const batch = await prisma.leadBatch.create({
    data: {
      name: source ?? `Upload ${new Date().toISOString().slice(0, 10)}`,
      source,
      filename: file.name,
      uploadedById: user.id,
      rowCount: rows.length,
      columnMapping: {
        phone: phoneCol,
        name: nameCol,
        email: emailCol,
      } as Prisma.InputJsonValue,
    },
  });

  let created = 0;
  let matched = 0;
  let skipped = 0;

  for (const row of rows) {
    const rawPhone = (row[phoneCol] ?? "").trim();
    if (!rawPhone) {
      skipped++;
      continue;
    }
    let phone: string;
    try {
      phone = normalizePhone(rawPhone);
    } catch {
      skipped++;
      continue;
    }

    const name = nameCol ? (row[nameCol] ?? "").trim() || null : null;
    const email = emailCol
      ? (row[emailCol] ?? "").trim().toLowerCase() || null
      : null;

    // Upsert CareProvider by phone
    const existing = await prisma.careProvider.findUnique({
      where: { phone },
      select: { id: true },
    });

    let careProviderId: string;
    if (existing) {
      careProviderId = existing.id;
      matched++;
      // Only enrich name/email if currently blank
      await prisma.careProvider.update({
        where: { id: existing.id },
        data: {
          name: name ? { set: name } : undefined,
          email: email ? { set: email } : undefined,
          profileTypeId: campaign.profileTypeId,
          leadBatchId: batch.id,
        },
      });
    } else {
      const newCp = await prisma.careProvider.create({
        data: {
          phone,
          name,
          email,
          profileTypeId: campaign.profileTypeId,
          status: "LEAD",
          source: source ?? batch.name,
          leadBatchId: batch.id,
        },
      });
      careProviderId = newCp.id;
      created++;
    }

    // Create CampaignMember (idempotent)
    await prisma.campaignMember.upsert({
      where: {
        campaignId_careProviderId: {
          campaignId: campaign.id,
          careProviderId,
        },
      },
      create: {
        campaignId: campaign.id,
        careProviderId,
        status: "PENDING",
      },
      update: {},
    });
  }

  await prisma.leadBatch.update({
    where: { id: batch.id },
    data: { newCount: created, matchedCount: matched },
  });

  // Link batch to campaign if first upload
  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { leadBatchId: batch.id },
  });

  revalidatePath(`/admin/campaigns/${campaign.id}`);

  return { ok: true, created, matched, skipped };
}

// ---------------------------------------------------------------------------
// Launch (send invites)
// ---------------------------------------------------------------------------

/**
 * Launch a campaign — sends the WhatsApp invite to all PENDING members.
 *
 * Non-blocking: validates config, claims the launch lock, then returns
 * immediately. The actual send loop runs as a fire-and-forget async task
 * that streams progress into Campaign.launchSent / launchFailed. The UI
 * polls /api/campaigns/[id]/launch-status to render a progress bar.
 *
 * Lock guarantees only one launch loop can run per campaign at a time.
 */
export async function launchCampaign(
  id: string,
): Promise<{
  ok: boolean;
  total?: number;
  started?: boolean;
  error?: string;
}> {
  await requireAdmin();

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      inviteMessageTemplate: { select: { id: true } },
      formTemplate: { select: { id: true } },
    },
  });
  if (!campaign) return { ok: false, error: "Campaign not found" };
  if (!campaign.inviteMessageTemplate)
    return { ok: false, error: "No invite message template configured" };
  if (!campaign.formTemplate)
    return { ok: false, error: "No form template configured" };

  // How many PENDING members would actually receive a send?
  const throttle =
    (campaign.throttle as { maxSendsPerLaunch?: number; maxSendsPerDay?: number } | null) ?? {};
  const cap = throttle.maxSendsPerLaunch ?? throttle.maxSendsPerDay ?? 100;

  const eligible = await prisma.campaignMember.count({
    where: {
      campaignId: id,
      status: "PENDING",
      lastSentAt: null,
      careProvider: { optedOutAt: null },
    },
  });
  if (eligible === 0) {
    return { ok: true, total: 0, started: false };
  }

  const total = Math.min(eligible, cap);

  // Claim the lock atomically. updateMany with `where: launchInProgress: false`
  // prevents a second launch click from spawning a parallel loop.
  const claim = await prisma.campaign.updateMany({
    where: { id, launchInProgress: false },
    data: {
      launchInProgress: true,
      launchStartedAt: new Date(),
      launchCompletedAt: null,
      launchTotal: total,
      launchSent: 0,
      launchFailed: 0,
      launchError: null,
      ...(campaign.status === "DRAFT"
        ? { status: "RUNNING", startedAt: new Date() }
        : {}),
    },
  });
  if (claim.count === 0) {
    return { ok: false, error: "A launch is already in progress." };
  }

  // Fire-and-forget the actual send loop. We deliberately do NOT await it —
  // the action returns now and the loop continues in the background.
  // Errors are caught + persisted via the lock-release in finally().
  void dispatchInvitesAsync(id).catch((err) => {
    console.error(`[launchCampaign] dispatch failed for ${id}:`, err);
  });

  revalidatePath(`/admin/campaigns/${id}`);
  return { ok: true, total, started: true };
}

/**
 * Background send loop. Streams progress via UPDATE statements on the
 * Campaign row, so the polling endpoint can read live counters. Always
 * releases the lock in `finally`, regardless of error.
 */
async function dispatchInvitesAsync(campaignId: string): Promise<void> {
  try {
    await dispatchInvites(campaignId);
  } catch (err) {
    console.error(`[dispatchInvitesAsync] ${campaignId}:`, err);
    await prisma.campaign
      .update({
        where: { id: campaignId },
        data: {
          launchError: err instanceof Error ? err.message : "Unknown error",
        },
      })
      .catch(() => {});
  } finally {
    await prisma.campaign
      .update({
        where: { id: campaignId },
        data: {
          launchInProgress: false,
          launchCompletedAt: new Date(),
        },
      })
      .catch(() => {});
  }
}

/**
 * Pick which channels to dispatch for a given member based on the campaign's
 * channelStrategy + what contact info the member has. Returns the channels
 * in order they should be attempted (relevant only for *_FIRST strategies,
 * where we stop after the first successful send).
 */
function pickChannelsForMember(
  strategy: string,
  cp: CareProvider,
): { channels: Channel[]; firstSuccessWins: boolean } {
  const hasPhone = Boolean(cp.phone);
  const hasEmail = Boolean(cp.email);
  switch (strategy) {
    case "EMAIL_ONLY":
      return { channels: hasEmail ? ["EMAIL"] : [], firstSuccessWins: false };
    case "BOTH": {
      const list: Channel[] = [];
      if (hasPhone) list.push("WHATSAPP");
      if (hasEmail) list.push("EMAIL");
      return { channels: list, firstSuccessWins: false };
    }
    case "WHATSAPP_FIRST": {
      const list: Channel[] = [];
      if (hasPhone) list.push("WHATSAPP");
      if (hasEmail) list.push("EMAIL");
      return { channels: list, firstSuccessWins: true };
    }
    case "EMAIL_FIRST": {
      const list: Channel[] = [];
      if (hasEmail) list.push("EMAIL");
      if (hasPhone) list.push("WHATSAPP");
      return { channels: list, firstSuccessWins: true };
    }
    case "WHATSAPP_ONLY":
    default:
      return {
        channels: hasPhone ? ["WHATSAPP"] : [],
        firstSuccessWins: false,
      };
  }
}

/**
 * Send a single invite over one channel for one campaign member. Logs the
 * outbound row (WhatsAppMessage or EmailMessage), returns { ok }. Doesn't
 * update the CampaignMember — caller decides member.status based on whether
 * ANY channel succeeded (BOTH strategy) or the FIRST one (FIRST strategies).
 */
async function sendOnChannel(args: {
  channel: Channel;
  member: CampaignMember;
  cp: CareProvider;
  vars: Record<string, string>;
  campaignId: string;
  waTemplate: MessageTemplate | null;
  emailTemplate: MessageTemplate | null;
}): Promise<{ ok: boolean }> {
  const { channel, member, cp, vars, campaignId, waTemplate, emailTemplate } =
    args;
  const sender = SENDERS[channel];

  if (channel === "WHATSAPP") {
    if (!waTemplate) return { ok: false };
    const body = renderBody(waTemplate.body, vars);
    const result = await sender.send({ to: cp.phone, body });
    await prisma.whatsAppMessage.create({
      data: {
        careProviderId: cp.id,
        campaignId,
        messageTemplateId: waTemplate.id,
        toPhone: cp.phone,
        body,
        status: result.ok ? "SENT" : "FAILED",
        ultramsgMessageId: result.ok ? result.messageId : null,
        errorMessage: !result.ok ? result.error : null,
        sentAt: result.ok ? new Date() : null,
      },
    });
    return { ok: result.ok };
  }

  if (channel === "EMAIL") {
    if (!emailTemplate || !cp.email) return { ok: false };
    const subject = renderBody(emailTemplate.subject ?? "", vars);
    const body = renderBody(emailTemplate.body, vars);
    const html = emailTemplate.html
      ? renderBody(emailTemplate.html, vars)
      : undefined;

    // Pre-create the EmailMessage so we have an id for the tracking pixel,
    // then update it with provider message id + sentAt after Gmail accepts.
    const draft = await prisma.emailMessage.create({
      data: {
        careProviderId: cp.id,
        campaignId,
        messageTemplateId: emailTemplate.id,
        toEmail: cp.email,
        subject,
        body,
        html: null,
        status: "SENDING",
      },
    });

    const result = await sender.send({
      to: cp.email,
      subject,
      body,
      html,
      trackingId: draft.id,
    });

    await prisma.emailMessage.update({
      where: { id: draft.id },
      data: {
        status: result.ok ? "SENT" : "FAILED",
        providerMessageId: result.ok ? result.messageId : null,
        errorMessage: !result.ok ? result.error : null,
        sentAt: result.ok ? new Date() : null,
      },
    });
    return { ok: result.ok };
  }

  // SMS or unknown — currently not implemented
  console.warn(`[sendOnChannel] channel ${channel} not implemented`);
  // Keep `member` reference for future SMS implementation
  void member;
  return { ok: false };
}

async function dispatchInvites(
  campaignId: string,
): Promise<{ ok: boolean; sent: number; failed: number }> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      inviteMessageTemplate: true,
      inviteEmailTemplate: true,
      profileType: true,
    },
  });
  if (!campaign) return { ok: false, sent: 0, failed: 0 };

  // Require at least one configured template — the strategy decides which.
  if (!campaign.inviteMessageTemplate && !campaign.inviteEmailTemplate) {
    return { ok: false, sent: 0, failed: 0 };
  }

  const throttle =
    (campaign.throttle as {
      maxSendsPerLaunch?: number;
      maxSendsPerDay?: number;
    } | null) ?? {};
  const limit = throttle.maxSendsPerLaunch ?? throttle.maxSendsPerDay ?? 100;

  // Pending members, no prior send, not opted out.
  const members = await prisma.campaignMember.findMany({
    where: {
      campaignId,
      status: "PENDING",
      lastSentAt: null,
      careProvider: { optedOutAt: null },
    },
    include: { careProvider: true },
    take: limit,
  });

  const baseUrl = process.env.APP_BASE_URL || process.env.NEXTAUTH_URL || "";
  const strategy = campaign.channelStrategy;

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < members.length; i++) {
    const m = members[i];
    const cp = m.careProvider;
    const vars: Record<string, string> = {
      name: cp.name ?? "there",
      first_name: (cp.name ?? "there").split(/\s+/)[0],
      role: campaign.profileType.code,
      role_label: campaign.profileType.label,
      form_link: `${baseUrl}/onboard/${m.token}`,
      pincode: cp.pincodeHome ?? "",
    };

    const { channels, firstSuccessWins } = pickChannelsForMember(strategy, cp);
    if (channels.length === 0) {
      failed++;
      console.warn(
        `[dispatchInvites] member ${m.id} has no usable channel for strategy ${strategy} (phone=${!!cp.phone}, email=${!!cp.email})`,
      );
      continue;
    }

    let anySuccess = false;
    for (const channel of channels) {
      const result = await sendOnChannel({
        channel,
        member: m,
        cp,
        vars,
        campaignId: campaign.id,
        waTemplate: campaign.inviteMessageTemplate,
        emailTemplate: campaign.inviteEmailTemplate,
      });
      if (result.ok) anySuccess = true;
      // Inter-channel pacing — short, since these go to different gateways.
      if (channel !== channels[channels.length - 1]) {
        await new Promise((r) => setTimeout(r, 250));
      }
      if (result.ok && firstSuccessWins) break;
    }

    if (anySuccess) {
      await prisma.campaignMember.update({
        where: { id: m.id },
        data: { status: "SENT", lastSentAt: new Date() },
      });
      await prisma.careProviderEvent.create({
        data: {
          careProviderId: cp.id,
          type: "INVITE_SENT",
          payload: {
            campaignId: campaign.id,
            channels: channels,
            strategy,
          } as Prisma.InputJsonValue,
        },
      });
      sent++;
    } else {
      failed++;
    }

    // Stream progress into the campaign row so the UI's polling endpoint
    // sees live numbers. Best-effort — don't let a write failure kill the
    // send loop.
    await prisma.campaign
      .update({
        where: { id: campaignId },
        data: { launchSent: sent, launchFailed: failed },
      })
      .catch(() => {});

    // Pace between sends to avoid WhatsApp anti-spam triggers. Skip after
    // the last message — no point waiting if there's nothing next.
    if (i < members.length - 1) {
      await pacedSleep();
    }
  }

  return { ok: true, sent, failed };
}

// ---------------------------------------------------------------------------
// Pause / resume / archive
// ---------------------------------------------------------------------------

export async function pauseCampaign(id: string) {
  await requireAdmin();
  await prisma.campaign.update({
    where: { id },
    data: { status: "PAUSED" },
  });
  revalidatePath(`/admin/campaigns/${id}`);
}

export async function resumeCampaign(id: string) {
  await requireAdmin();
  await prisma.campaign.update({
    where: { id },
    data: { status: "RUNNING" },
  });
  revalidatePath(`/admin/campaigns/${id}`);
}

export async function archiveCampaign(id: string) {
  await requireAdmin();
  await prisma.campaign.update({
    where: { id },
    data: { status: "ARCHIVED" },
  });
  revalidatePath("/admin/campaigns");
  redirect("/admin/campaigns");
}

// ---------------------------------------------------------------------------
// Reminder runner
// ---------------------------------------------------------------------------

/**
 * Evaluate reminder rules for all RUNNING campaigns and send applicable
 * reminders. Returns counts. Designed to be called from a button (now) and
 * later from a cron.
 */
export async function runReminders(
  campaignId?: string,
): Promise<{
  ok: boolean;
  evaluated: number;
  sent: number;
  failed: number;
  error?: string;
}> {
  await requireAdmin();

  const where: Prisma.CampaignWhereInput = { status: "RUNNING" };
  if (campaignId) where.id = campaignId;

  const campaigns = await prisma.campaign.findMany({
    where,
    include: { profileType: true },
  });

  let evaluated = 0;
  let sent = 0;
  let failed = 0;

  const baseUrl = process.env.APP_BASE_URL || process.env.NEXTAUTH_URL || "";

  for (const campaign of campaigns) {
    const rules =
      (campaign.reminderRules as Array<{
        triggerAfterHours: number;
        messageTemplateId: string;
        maxSends?: number;
      }> | null) ?? [];
    if (rules.length === 0) continue;

    for (const rule of rules) {
      const cutoff = new Date(Date.now() - rule.triggerAfterHours * 3_600_000);
      const tpl = await prisma.messageTemplate.findUnique({
        where: { id: rule.messageTemplateId },
      });
      if (!tpl) continue;

      // Members who: are SENT or ENGAGED (not yet submitted), got last
      // message before the cutoff, and haven't received >= maxSends reminders.
      const candidates = await prisma.campaignMember.findMany({
        where: {
          campaignId: campaign.id,
          status: { in: ["SENT", "ENGAGED"] },
          lastSentAt: { lt: cutoff },
          remindersSent: { lt: rule.maxSends ?? 1 },
        },
        include: { careProvider: true },
        take: 50,
      });

      for (const m of candidates) {
        evaluated++;
        const cp = m.careProvider;
        const vars: Record<string, string> = {
          name: cp.name ?? "there",
          first_name: (cp.name ?? "there").split(/\s+/)[0],
          role: campaign.profileType.code,
          role_label: campaign.profileType.label,
          form_link: `${baseUrl}/onboard/${m.token}`,
          pincode: cp.pincodeHome ?? "",
        };
        const body = renderBody(tpl.body, vars);
        const result = await SENDERS.WHATSAPP.send({ to: cp.phone, body });

        await prisma.whatsAppMessage.create({
          data: {
            careProviderId: cp.id,
            campaignId: campaign.id,
            messageTemplateId: tpl.id,
            toPhone: cp.phone,
            body,
            status: result.ok ? "SENT" : "FAILED",
            ultramsgMessageId: result.ok ? result.messageId : null,
            errorMessage: !result.ok ? result.error : null,
            sentAt: result.ok ? new Date() : null,
          },
        });

        if (result.ok) {
          await prisma.campaignMember.update({
            where: { id: m.id },
            data: {
              remindersSent: { increment: 1 },
              lastSentAt: new Date(),
            },
          });
          sent++;
        } else {
          failed++;
        }
      }
    }
  }

  if (campaignId) revalidatePath(`/admin/campaigns/${campaignId}`);
  revalidatePath("/admin/campaigns");

  return { ok: true, evaluated, sent, failed };
}
