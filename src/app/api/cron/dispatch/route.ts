/**
 * Cron tick: fire any campaign-invite sends that are now due.
 *
 * Designed to be hit every minute by an external scheduler (Vercel cron,
 * GitHub Actions, or `cron` on the VM hitting curl). Each tick:
 *   1. Iterates active campaigns in PACED mode whose launchInProgress is
 *      true (the admin has clicked Launch).
 *   2. For each, asks the scheduler for at most a hourly-rate-derived
 *      cap of due members.
 *   3. Dispatches each, logging per-channel outbound rows.
 *
 * Concurrency: there's no in-process locking because the cron runs once
 * per minute and each member's lastSentAt update is atomic. Even if two
 * cron ticks raced, no member would receive more than one send because
 * the scheduler's "lastSentAt is null" filter is part of the SELECT.
 *
 * Auth: same Bearer-CRON_SECRET pattern as the reminders cron.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { dueForDispatch } from "@/lib/dispatch/scheduler";
import { dispatchInviteToMember } from "@/lib/dispatch/dispatch";

const CRON_SECRET = process.env.CRON_SECRET;

function isAuthorized(req: NextRequest): boolean {
  if (!CRON_SECRET) return false;
  const header = req.headers.get("authorization");
  if (header === `Bearer ${CRON_SECRET}`) return true;
  // Allow ?secret=... for browser-friendly testing.
  const secret = req.nextUrl.searchParams.get("secret");
  return secret === CRON_SECRET;
}

export async function POST(req: NextRequest) {
  return handle(req);
}
export async function GET(req: NextRequest) {
  return handle(req);
}

async function handle(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  // PACED campaigns with an active launch.
  const campaigns = await prisma.campaign.findMany({
    where: {
      dispatchMode: "PACED",
      launchInProgress: true,
      status: { in: ["RUNNING", "DRAFT"] },
    },
    select: {
      id: true,
      hourlyTarget: true,
      launchSent: true,
      launchFailed: true,
      launchTotal: true,
    },
  });

  const results: Array<{
    campaignId: string;
    attempted: number;
    sent: number;
    failed: number;
  }> = [];

  for (const c of campaigns) {
    const dueIds = await dueForDispatch(c.id, c.hourlyTarget);
    let sent = 0;
    let failed = 0;
    for (const id of dueIds) {
      const r = await dispatchInviteToMember(id);
      if (r.anySuccess) sent++;
      else failed++;
    }

    if (sent + failed > 0) {
      await prisma.campaign.update({
        where: { id: c.id },
        data: {
          launchSent: { increment: sent },
          launchFailed: { increment: failed },
        },
      });
    }

    // Auto-complete the launch when nothing's left to send.
    const remaining = await prisma.campaignMember.count({
      where: {
        campaignId: c.id,
        status: "PENDING",
        lastSentAt: null,
        scheduledSendAt: { not: null },
      },
    });
    if (remaining === 0) {
      await prisma.campaign.update({
        where: { id: c.id },
        data: {
          launchInProgress: false,
          launchCompletedAt: new Date(),
        },
      });
    }

    results.push({
      campaignId: c.id,
      attempted: dueIds.length,
      sent,
      failed,
    });
  }

  return NextResponse.json({ ok: true, results }, {
    headers: { "cache-control": "no-store" },
  });
}
