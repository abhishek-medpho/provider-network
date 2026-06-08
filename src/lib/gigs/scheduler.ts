/**
 * Gig scheduler tick — fired every dispatch cadence by the in-process
 * scheduler (and the HTTP cron). Handles the time-driven parts of the gig
 * lifecycle:
 *
 *   Reconfirm-deadline lapse:
 *     ASSIGNED gigs whose confirmDeadline passed without the assignee
 *     reconfirming → the assignee forfeits (their response → EXPIRED), and
 *     we promote the top standby (closest still-INTERESTED provider):
 *     re-assign + re-send the reconfirm message with a fresh deadline.
 *     If no standby remains, revert the gig to OPEN/unassigned so ops can
 *     re-broadcast a wider wave.
 *
 * Wave auto-escalation is intentionally left to a manual "broadcast next
 * wave" admin action for v1 (ops stays in the loop); the hook is here if
 * we want to automate it later.
 */

import { prisma } from "@/lib/db";

export type GigSchedulerTickResult = {
  reconfirmLapsed: number;
  promoted: number;
  unassigned: number;
};

export async function runGigSchedulerTick(): Promise<GigSchedulerTickResult> {
  const now = new Date();

  const lapsed = await prisma.gig.findMany({
    where: {
      status: "ASSIGNED",
      assignmentStatus: "AWAITING",
      confirmDeadline: { not: null, lt: now },
    },
    select: { id: true, assignedProviderId: true, scheduledFor: true },
  });

  let promoted = 0;
  let unassigned = 0;

  for (const gig of lapsed) {
    // The lapsed assignee forfeits their hand.
    if (gig.assignedProviderId) {
      await prisma.gigResponse
        .update({
          where: {
            gigId_careProviderId: {
              gigId: gig.id,
              careProviderId: gig.assignedProviderId,
            },
          },
          data: { status: "EXPIRED" },
        })
        .catch(() => {});
    }

    // Promote the closest still-INTERESTED standby.
    const standby = await prisma.gigResponse.findFirst({
      where: { gigId: gig.id, status: "INTERESTED" },
      orderBy: [{ distanceKm: "asc" }, { respondedAt: "asc" }],
    });

    if (standby) {
      const confirmDeadline = computeConfirmDeadline(gig.scheduledFor);
      await prisma.gig.update({
        where: { id: gig.id },
        data: {
          assignedProviderId: standby.careProviderId,
          assignmentStatus: "AWAITING",
          assignedAt: now,
          confirmDeadline,
          confirmedAt: null,
        },
      });
      // Re-send reconfirm to the promoted provider.
      const { sendReconfirmMessage } = await import(
        "@/lib/actions/gig-assign"
      );
      await sendReconfirmMessage(
        gig.id,
        standby.careProviderId,
        confirmDeadline,
      );
      promoted++;
    } else {
      // Nobody left on the bench — revert to OPEN/unassigned for ops to
      // widen the net (next wave) manually.
      await prisma.gig.update({
        where: { id: gig.id },
        data: {
          status: "OPEN",
          assignedProviderId: null,
          assignmentStatus: "EXPIRED",
          confirmDeadline: null,
        },
      });
      unassigned++;
    }
  }

  if (promoted + unassigned > 0) {
    console.log(
      `[gig-scheduler] ${lapsed.length} reconfirm lapse(s): ${promoted} promoted, ${unassigned} unassigned`,
    );
  }
  return { reconfirmLapsed: lapsed.length, promoted, unassigned };
}

/**
 * Same deadline policy as the assign action: min(now+3h, scheduledFor-2h),
 * with a 30-min floor when the slot is already close.
 */
function computeConfirmDeadline(scheduledFor: Date): Date {
  const threeHours = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const tMinus2 = new Date(scheduledFor.getTime() - 2 * 60 * 60 * 1000);
  if (tMinus2.getTime() <= Date.now()) {
    return new Date(Date.now() + 30 * 60 * 1000);
  }
  return threeHours < tMinus2 ? threeHours : tMinus2;
}
