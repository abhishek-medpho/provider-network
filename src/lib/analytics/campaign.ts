/**
 * Campaign analytics: funnel + reminders + timing + by-source + failures.
 *
 * Pulls per-campaign metrics in a small bundle of queries and computes
 * percentiles / breakdowns in JS (campaign-scoped data is small enough that
 * SQL-side percentile_cont isn't worth the raw-query complexity yet).
 */

import { prisma } from "@/lib/db";

export type FunnelStage = {
  key: string;
  label: string;
  count: number;
  /** Drop-off vs the previous stage, as a decimal 0-1; null for the first stage. */
  dropFromPrev: number | null;
  /** Conversion vs the first stage, as a decimal 0-1. */
  shareOfTotal: number;
};

export type CampaignAnalytics = {
  computedAt: Date;
  funnel: {
    stages: FunnelStage[];
    e2eConversion: number; // submitted / imported, 0-1
  };
  reminders: {
    totalSent: number;
    membersReminded: number;
    convertedAfterReminder: number;
    /** Distribution: how many members received N reminders */
    distribution: Array<{ count: number; members: number }>;
  };
  timing: {
    timeToOpenP50Min: number | null;
    timeToOpenP90Min: number | null;
    timeToSubmitFromOpenP50Min: number | null;
    timeToSubmitFromOpenP90Min: number | null;
    /** Of submitted members, what % submitted within the cutoff measured from invite send */
    submitWithin1hPct: number | null;
    submitWithin24hPct: number | null;
    submitWithin72hPct: number | null;
  };
  bySource: Array<{
    source: string;
    members: number;
    sent: number;
    opened: number;
    submitted: number;
    e2ePct: number;
  }>;
  topFailures: Array<{
    error: string;
    count: number;
  }>;
  messages: {
    total: number;
    sent: number;
    failed: number;
  };
  email: {
    total: number;
    sent: number;       // SMTP accepted (status SENT, OPENED, or CLICKED)
    failed: number;     // FAILED or BOUNCED
    opened: number;     // any open recorded — distinct members
    clicked: number;    // any click recorded — distinct members
    openRate: number;   // opened / sent  (0-1)
    clickRate: number;  // clicked / sent (0-1)
    /** Click-to-open rate — of those who opened, how many clicked. */
    ctor: number;       // clicked / opened (0-1)
  };
};

function pct(num: number, den: number): number {
  if (den === 0) return 0;
  return num / den;
}

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const frac = idx - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

export async function getCampaignAnalytics(
  campaignId: string,
): Promise<CampaignAnalytics> {
  // 1. Members + their key timestamps + lead-batch source + provider lifecycle
  const members = await prisma.campaignMember.findMany({
    where: { campaignId },
    select: {
      id: true,
      status: true,
      remindersSent: true,
      createdAt: true,
      lastSentAt: true,
      engagedAt: true,
      submittedAt: true,
      optedOutAt: true,
      careProvider: {
        select: {
          id: true,
          status: true,
          leadBatch: { select: { name: true, source: true } },
        },
      },
    },
  });

  // 2. First INVITE_SENT event per care provider — true "invited at"
  const careProviderIds = members.map((m) => m.careProvider.id);
  const inviteEvents = careProviderIds.length
    ? await prisma.careProviderEvent.findMany({
        where: {
          careProviderId: { in: careProviderIds },
          type: "INVITE_SENT",
        },
        select: { careProviderId: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      })
    : [];
  const inviteSentAtByCp = new Map<string, Date>();
  for (const e of inviteEvents) {
    if (!inviteSentAtByCp.has(e.careProviderId)) {
      inviteSentAtByCp.set(e.careProviderId, e.createdAt);
    }
  }

  // 3. WhatsApp message stats
  const waCounts = await prisma.whatsAppMessage.groupBy({
    by: ["status"],
    _count: { _all: true },
    where: { campaignId },
  });
  const messages = {
    total: waCounts.reduce((s, r) => s + r._count._all, 0),
    sent: waCounts
      .filter((r) =>
        ["SENT", "DELIVERED", "READ"].includes(r.status),
      )
      .reduce((s, r) => s + r._count._all, 0),
    failed: waCounts.find((r) => r.status === "FAILED")?._count._all ?? 0,
  };

  // 3b. Email stats — grouped by status + distinct-open / distinct-click counts
  const emailCounts = await prisma.emailMessage.groupBy({
    by: ["status"],
    _count: { _all: true },
    where: { campaignId },
  });
  const emailTotal = emailCounts.reduce((s, r) => s + r._count._all, 0);
  const emailSent = emailCounts
    .filter((r) => ["SENT", "OPENED", "CLICKED", "DELIVERED"].includes(r.status))
    .reduce((s, r) => s + r._count._all, 0);
  const emailFailed = emailCounts
    .filter((r) => ["FAILED", "BOUNCED"].includes(r.status))
    .reduce((s, r) => s + r._count._all, 0);

  // Distinct counts — one open/click per EmailMessage, not per EmailEvent.
  // (A heavily-engaging recipient who opens 5 times still counts as 1 open.)
  const [emailOpened, emailClicked] = await Promise.all([
    prisma.emailMessage.count({
      where: { campaignId, openedAt: { not: null } },
    }),
    prisma.emailMessage.count({
      where: { campaignId, firstClickedAt: { not: null } },
    }),
  ]);
  const email = {
    total: emailTotal,
    sent: emailSent,
    failed: emailFailed,
    opened: emailOpened,
    clicked: emailClicked,
    openRate: pct(emailOpened, emailSent),
    clickRate: pct(emailClicked, emailSent),
    ctor: pct(emailClicked, emailOpened),
  };

  // 4. Top failure error messages
  const failedMsgs = await prisma.whatsAppMessage.findMany({
    where: { campaignId, status: "FAILED" },
    select: { errorMessage: true },
  });
  const errCounts = new Map<string, number>();
  for (const m of failedMsgs) {
    const key = clusterErrorMessage(m.errorMessage ?? "Unknown error");
    errCounts.set(key, (errCounts.get(key) ?? 0) + 1);
  }
  const topFailures = Array.from(errCounts.entries())
    .map(([error, count]) => ({ error, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // --- derive stats from members ---
  const total = members.length;
  const sentMembers = members.filter(
    (m) =>
      m.lastSentAt !== null ||
      inviteSentAtByCp.has(m.careProvider.id) ||
      ["SENT", "ENGAGED", "SUBMITTED", "COMPLETED"].includes(m.status),
  ).length;
  const openedMembers = members.filter((m) => m.engagedAt !== null).length;
  const submittedMembers = members.filter(
    (m) => m.submittedAt !== null,
  ).length;
  const verifiedMembers = members.filter((m) =>
    ["VERIFIED", "ACTIVE"].includes(m.careProvider.status),
  ).length;

  const stages: FunnelStage[] = [
    {
      key: "imported",
      label: "Imported",
      count: total,
      dropFromPrev: null,
      shareOfTotal: 1,
    },
    {
      key: "sent",
      label: "Invite sent",
      count: sentMembers,
      dropFromPrev: total ? 1 - sentMembers / total : null,
      shareOfTotal: pct(sentMembers, total),
    },
    {
      key: "opened",
      label: "Link opened",
      count: openedMembers,
      dropFromPrev: sentMembers ? 1 - openedMembers / sentMembers : null,
      shareOfTotal: pct(openedMembers, total),
    },
    {
      key: "submitted",
      label: "Form submitted",
      count: submittedMembers,
      dropFromPrev: openedMembers ? 1 - submittedMembers / openedMembers : null,
      shareOfTotal: pct(submittedMembers, total),
    },
    {
      key: "verified",
      label: "Verified / active",
      count: verifiedMembers,
      dropFromPrev: submittedMembers
        ? 1 - verifiedMembers / submittedMembers
        : null,
      shareOfTotal: pct(verifiedMembers, total),
    },
  ];

  // --- reminder analytics ---
  const remindedMembers = members.filter((m) => m.remindersSent > 0);
  const totalReminders = members.reduce((s, m) => s + m.remindersSent, 0);
  const convertedAfterReminder = remindedMembers.filter(
    (m) => m.submittedAt !== null,
  ).length;
  const distMap = new Map<number, number>();
  for (const m of members) {
    distMap.set(m.remindersSent, (distMap.get(m.remindersSent) ?? 0) + 1);
  }
  const reminderDistribution = Array.from(distMap.entries())
    .map(([count, members]) => ({ count, members }))
    .sort((a, b) => a.count - b.count);

  // --- timing analytics (minutes) ---
  const timeToOpen: number[] = [];
  const timeToSubmitFromOpen: number[] = [];
  const timeToSubmitFromInvite: number[] = [];

  for (const m of members) {
    const inviteAt =
      inviteSentAtByCp.get(m.careProvider.id) ?? m.lastSentAt ?? null;

    if (m.engagedAt && inviteAt) {
      const dt = (m.engagedAt.getTime() - inviteAt.getTime()) / 60_000;
      if (dt >= 0) timeToOpen.push(dt);
    }
    if (m.submittedAt && m.engagedAt) {
      const dt = (m.submittedAt.getTime() - m.engagedAt.getTime()) / 60_000;
      if (dt >= 0) timeToSubmitFromOpen.push(dt);
    }
    if (m.submittedAt && inviteAt) {
      const dt = (m.submittedAt.getTime() - inviteAt.getTime()) / 60_000;
      if (dt >= 0) timeToSubmitFromInvite.push(dt);
    }
  }

  const within = (mins: number) =>
    timeToSubmitFromInvite.filter((d) => d <= mins).length;
  const submitWithin1hPct =
    timeToSubmitFromInvite.length > 0
      ? within(60) / timeToSubmitFromInvite.length
      : null;
  const submitWithin24hPct =
    timeToSubmitFromInvite.length > 0
      ? within(60 * 24) / timeToSubmitFromInvite.length
      : null;
  const submitWithin72hPct =
    timeToSubmitFromInvite.length > 0
      ? within(60 * 72) / timeToSubmitFromInvite.length
      : null;

  // --- by source ---
  const sourceBuckets = new Map<
    string,
    { members: number; sent: number; opened: number; submitted: number }
  >();
  for (const m of members) {
    const key =
      m.careProvider.leadBatch?.source ??
      m.careProvider.leadBatch?.name ??
      "(no batch)";
    let b = sourceBuckets.get(key);
    if (!b) {
      b = { members: 0, sent: 0, opened: 0, submitted: 0 };
      sourceBuckets.set(key, b);
    }
    b.members++;
    if (
      m.lastSentAt ||
      inviteSentAtByCp.has(m.careProvider.id) ||
      ["SENT", "ENGAGED", "SUBMITTED", "COMPLETED"].includes(m.status)
    )
      b.sent++;
    if (m.engagedAt) b.opened++;
    if (m.submittedAt) b.submitted++;
  }
  const bySource = Array.from(sourceBuckets.entries())
    .map(([source, b]) => ({
      source,
      ...b,
      e2ePct: pct(b.submitted, b.members),
    }))
    .sort((a, b) => b.members - a.members);

  return {
    computedAt: new Date(),
    funnel: {
      stages,
      e2eConversion: pct(submittedMembers, total),
    },
    reminders: {
      totalSent: totalReminders,
      membersReminded: remindedMembers.length,
      convertedAfterReminder,
      distribution: reminderDistribution,
    },
    timing: {
      timeToOpenP50Min: percentile(timeToOpen, 0.5),
      timeToOpenP90Min: percentile(timeToOpen, 0.9),
      timeToSubmitFromOpenP50Min: percentile(timeToSubmitFromOpen, 0.5),
      timeToSubmitFromOpenP90Min: percentile(timeToSubmitFromOpen, 0.9),
      submitWithin1hPct,
      submitWithin24hPct,
      submitWithin72hPct,
    },
    bySource,
    topFailures,
    messages,
    email,
  };
}

/**
 * Cluster similar Ultramsg errors into a single bucket so the failures
 * list isn't noisy. (Different invalid-phone messages all collapse, etc.)
 */
function clusterErrorMessage(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("non-payment") || lower.includes("instance stopped"))
    return "Ultramsg subscription stopped — renew at ultramsg.com";
  if (lower.includes("invalid phone") || lower.includes("invalid number"))
    return "Invalid phone number";
  if (lower.includes("not on whatsapp") || lower.includes("not registered"))
    return "Number not on WhatsApp";
  if (lower.includes("spam") || lower.includes("blocked"))
    return "Blocked by WhatsApp (spam flag)";
  if (lower.includes("timeout") || lower.includes("timed out"))
    return "Send timed out";
  if (lower.includes("rate") || lower.includes("limit"))
    return "Rate limit exceeded";
  // Truncate long messages for grouping
  return raw.slice(0, 80);
}
