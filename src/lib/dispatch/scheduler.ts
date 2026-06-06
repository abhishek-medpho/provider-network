/**
 * Bulk dispatch scheduler.
 *
 * When a campaign is launched in PACED mode, this module assigns each
 * eligible member a `scheduledSendAt` timestamp spread across the
 * campaign's allowed hours. The cron endpoint `/api/cron/dispatch` then
 * fires whatever is due each tick.
 *
 * Design goals:
 *   1. Throttle at the channel-adapter layer — no WhatsApp account ever
 *      sees >hourlyTarget sends per hour from this app.
 *   2. No detectable pattern — every send timestamp gets random jitter
 *      within its hour, and each hour picks a random cohort size in
 *      [cohortMin, cohortMax].
 *   3. Respect quiet hours (default 8 AM - 9 PM IST). Sends scheduled
 *      outside this window roll forward to the next valid hour.
 *   4. Recoverable — the schedule is persisted on each CampaignMember,
 *      so a server restart or admin re-launch doesn't lose progress.
 *
 * Transactional sends (form-submitted confirmation, profile activation,
 * etc.) DO NOT go through this scheduler. They use sendTransactional()
 * which fires immediately, since users expect instant feedback.
 */

import { prisma } from "@/lib/db";

type PlanInput = {
  campaignId: string;
  hourlyTarget: number;
  cohortMin: number;
  cohortMax: number;
  dispatchTTLHours: number;
  /** Local hour at which sends START being allowed (e.g. 8 = 8 AM). */
  activeHourStart: number;
  /** Local hour at which sends STOP being allowed (e.g. 21 = 9 PM). */
  activeHourEnd: number;
  timezone: string;
};

type PlanResult = {
  scheduled: number;
  unscheduled: number;
  firstSendAt: Date | null;
  lastSendAt: Date | null;
};

/**
 * Compute scheduledSendAt for every eligible PENDING member of a campaign.
 * Idempotent: only schedules members whose scheduledSendAt is currently
 * null. Re-running picks up new members from a fresh CSV upload without
 * resetting already-scheduled ones.
 */
export async function planLaunchSchedule(
  input: PlanInput,
): Promise<PlanResult> {
  const { campaignId } = input;

  const eligible = await prisma.campaignMember.findMany({
    where: {
      campaignId,
      status: "PENDING",
      lastSentAt: null,
      scheduledSendAt: null,
      careProvider: { optedOutAt: null },
    },
    select: { id: true },
    // Insertion order doesn't matter — we shuffle below for randomness.
  });

  if (eligible.length === 0) {
    return { scheduled: 0, unscheduled: 0, firstSendAt: null, lastSendAt: null };
  }

  // Fisher-Yates shuffle so cohorts are random subsets, not first-N.
  const memberIds = eligible.map((m) => m.id);
  for (let i = memberIds.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [memberIds[i], memberIds[j]] = [memberIds[j], memberIds[i]];
  }

  // Build the hourly send buckets. Walk forward in time, hour by hour,
  // skipping quiet hours, until we either run out of members or hit the
  // dispatchTTLHours budget.
  const now = new Date();
  const updates: { id: string; sendAt: Date }[] = [];
  let cursor = nextValidHourStart(now, input.activeHourStart, input.activeHourEnd, input.timezone);
  let memberIdx = 0;
  let hoursUsed = 0;

  while (memberIdx < memberIds.length && hoursUsed < input.dispatchTTLHours) {
    const cohortSize = randomInt(
      Math.max(1, input.cohortMin),
      Math.max(input.cohortMin, input.cohortMax),
    );
    const cappedCohort = Math.min(
      cohortSize,
      input.hourlyTarget,
      memberIds.length - memberIdx,
    );

    // Generate `cappedCohort` random offsets within this hour (in ms).
    // Sort them so the cohort sends in chronological order — looks natural
    // in logs and lets us reason about pacing trivially.
    const offsets: number[] = [];
    for (let i = 0; i < cappedCohort; i++) {
      offsets.push(Math.floor(Math.random() * 60 * 60 * 1000));
    }
    offsets.sort((a, b) => a - b);

    // Enforce a hard floor of 30s between consecutive sends within an
    // hour, to keep gateways happy even if RNG packs them close.
    for (let i = 1; i < offsets.length; i++) {
      if (offsets[i] - offsets[i - 1] < 30_000) {
        offsets[i] = offsets[i - 1] + 30_000;
      }
    }

    for (let i = 0; i < cappedCohort; i++) {
      const sendAt = new Date(cursor.getTime() + offsets[i]);
      updates.push({ id: memberIds[memberIdx], sendAt });
      memberIdx++;
    }

    cursor = nextValidHourStart(
      new Date(cursor.getTime() + 60 * 60 * 1000),
      input.activeHourStart,
      input.activeHourEnd,
      input.timezone,
    );
    hoursUsed++;
  }

  // Persist in parallel — Prisma will batch via the connection pool.
  await Promise.all(
    updates.map((u) =>
      prisma.campaignMember.update({
        where: { id: u.id },
        data: { scheduledSendAt: u.sendAt },
      }),
    ),
  );

  return {
    scheduled: updates.length,
    unscheduled: memberIds.length - updates.length,
    firstSendAt: updates[0]?.sendAt ?? null,
    lastSendAt: updates[updates.length - 1]?.sendAt ?? null,
  };
}

/**
 * Members whose scheduledSendAt has arrived. Used by the cron endpoint.
 * Caps the result so a single cron tick can never burst-send.
 */
export async function dueForDispatch(
  campaignId: string | undefined,
  hourlyTarget: number,
): Promise<string[]> {
  const now = new Date();
  // One tick = at most (hourlyTarget / 60) + 1 sends. That keeps minute-by-minute
  // pacing roughly even even if a bunch of members happen to have very close
  // scheduled times.
  const tickCap = Math.max(1, Math.ceil(hourlyTarget / 60) + 1);

  const due = await prisma.campaignMember.findMany({
    where: {
      ...(campaignId ? { campaignId } : {}),
      status: "PENDING",
      lastSentAt: null,
      scheduledSendAt: { lte: now },
      careProvider: { optedOutAt: null },
    },
    select: { id: true },
    orderBy: { scheduledSendAt: "asc" },
    take: tickCap,
  });
  return due.map((m) => m.id);
}

// ───────────── helpers ─────────────

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Return the start of the next hour at or after `from` that falls inside
 * the [activeHourStart, activeHourEnd) window in the given timezone.
 * "Quiet hours" = everything outside this window; cursor skips forward
 * until it lands back inside the active window.
 *
 * Implementation: format `from` in the target timezone, read the hour,
 * and step forward in 1-hour increments until we land in [start, end).
 * No DST handling needed for IST (which has no DST). For timezones with
 * DST, the worst case is a 1-hour fall-back day where we'd skip one
 * hour — fine for our use case.
 */
function nextValidHourStart(
  from: Date,
  activeStart: number,
  activeEnd: number,
  timezone: string,
): Date {
  // Truncate to the top of the hour to make iteration deterministic.
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    hour12: false,
  });

  let cursor = roundUpToHour(from);
  // Safety: cap iterations at 1 week so a misconfigured pair like
  // start=22, end=8 (which would never resolve) doesn't infinite-loop.
  for (let i = 0; i < 24 * 7; i++) {
    const hourPart = parseInt(fmt.format(cursor), 10);
    const inWindow =
      activeStart < activeEnd
        ? hourPart >= activeStart && hourPart < activeEnd
        : // wrap-around window (e.g. 22:00 → 6:00) — treat as union
          hourPart >= activeStart || hourPart < activeEnd;
    if (inWindow) return cursor;
    cursor = new Date(cursor.getTime() + 60 * 60 * 1000);
  }
  // Should never hit this; return cursor as fallback.
  return cursor;
}

function roundUpToHour(d: Date): Date {
  const r = new Date(d);
  r.setMinutes(0, 0, 0);
  if (r.getTime() < d.getTime()) {
    r.setTime(r.getTime() + 60 * 60 * 1000);
  }
  return r;
}
