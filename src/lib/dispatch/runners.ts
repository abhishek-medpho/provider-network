/**
 * Channel-agnostic tick runners, shared by:
 *   1. The HTTP cron routes (/api/cron/dispatch, /api/cron/reminders) —
 *      for external schedulers (Vercel cron, GitHub Actions, system cron).
 *   2. The in-process Node scheduler (src/instrumentation.ts) — so a
 *      single self-contained container needs no external cron at all.
 *
 * Keeping the work here (not in the route handlers) means both entry
 * points run identical logic and can't drift.
 */

import { prisma } from "@/lib/db";
import { dueForDispatch } from "./scheduler";
import { dispatchInviteToMember } from "./dispatch";

export type DispatchTickResult = {
  campaignsProcessed: number;
  attempted: number;
  sent: number;
  failed: number;
};

/**
 * One dispatch tick: fire any PACED-campaign invites that are now due.
 * Caps per-campaign sends per tick via the scheduler's tick cap, so a
 * single invocation can never burst-send.
 */
export async function runDispatchTick(): Promise<DispatchTickResult> {
  const campaigns = await prisma.campaign.findMany({
    where: {
      dispatchMode: "PACED",
      launchInProgress: true,
      status: { in: ["RUNNING", "DRAFT"] },
    },
    select: { id: true, hourlyTarget: true },
  });

  let attempted = 0;
  let sent = 0;
  let failed = 0;

  for (const c of campaigns) {
    const dueIds = await dueForDispatch(c.id, c.hourlyTarget);
    let cSent = 0;
    let cFailed = 0;
    for (const id of dueIds) {
      const r = await dispatchInviteToMember(id);
      if (r.anySuccess) cSent++;
      else cFailed++;
    }
    attempted += dueIds.length;
    sent += cSent;
    failed += cFailed;

    if (cSent + cFailed > 0) {
      await prisma.campaign.update({
        where: { id: c.id },
        data: {
          launchSent: { increment: cSent },
          launchFailed: { increment: cFailed },
        },
      });
    }

    // Auto-complete the launch when nothing scheduled remains.
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
        data: { launchInProgress: false, launchCompletedAt: new Date() },
      });
    }
  }

  return {
    campaignsProcessed: campaigns.length,
    attempted,
    sent,
    failed,
  };
}
