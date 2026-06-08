/**
 * In-process scheduler loop. Started once by src/instrumentation.ts.
 *
 * Two independent timers:
 *   - dispatch tick  : every 60s  → runDispatchTick()  (paced campaign sends)
 *   - reminder tick  : every 30m  → runReminderRules() (follow-up reminders)
 *
 * Both runners are the SAME functions the HTTP cron routes call, so
 * whether you drive ticks from external cron or this in-process loop, the
 * behaviour is identical.
 *
 * Each tick is wrapped so a thrown error logs and the timer keeps going —
 * a single bad tick must never kill the scheduler. Ticks are also
 * non-overlapping per timer: if a tick runs long, the next fire waits
 * (we use a re-arming setTimeout, not setInterval, to guarantee this).
 */

const DISPATCH_INTERVAL_MS = Number(
  process.env.SCHEDULER_DISPATCH_INTERVAL_MS ?? 60_000,
);
const REMINDER_INTERVAL_MS = Number(
  process.env.SCHEDULER_REMINDER_INTERVAL_MS ?? 30 * 60_000,
);

// Module-level guard: register() can fire more than once under dev HMR.
let started = false;

export function startInProcessScheduler(): void {
  if (started) return;
  started = true;

  console.log(
    `[scheduler] starting in-process scheduler · dispatch every ${Math.round(
      DISPATCH_INTERVAL_MS / 1000,
    )}s · reminders every ${Math.round(REMINDER_INTERVAL_MS / 60000)}m`,
  );

  scheduleRecurring("dispatch", DISPATCH_INTERVAL_MS, async () => {
    const { runDispatchTick } = await import("@/lib/dispatch/runners");
    const r = await runDispatchTick();
    if (r.attempted > 0) {
      console.log(
        `[scheduler] dispatch tick: ${r.sent} sent, ${r.failed} failed across ${r.campaignsProcessed} campaign(s)`,
      );
    }
    // Gig reconfirm-deadline + wave-escalation pass on the same cadence.
    const { runGigSchedulerTick } = await import("@/lib/gigs/scheduler");
    await runGigSchedulerTick();
  });

  scheduleRecurring("reminders", REMINDER_INTERVAL_MS, async () => {
    const { runReminderRules } = await import("@/lib/actions/reminders");
    const results = await runReminderRules();
    const totalSent = results.reduce((s, r) => s + r.sent, 0);
    if (totalSent > 0) {
      console.log(
        `[scheduler] reminder tick: ${totalSent} sent across ${results.length} rule(s)`,
      );
    }
  });
}

/**
 * Run `fn` every `intervalMs`, never overlapping. Errors are caught and
 * logged; the timer re-arms regardless. The first run happens after one
 * interval (not immediately) so the server finishes booting first.
 */
function scheduleRecurring(
  name: string,
  intervalMs: number,
  fn: () => Promise<void>,
): void {
  const tick = async () => {
    const start = Date.now();
    try {
      await fn();
    } catch (err) {
      console.error(`[scheduler] ${name} tick errored:`, err);
    } finally {
      // Re-arm relative to completion to guarantee no overlap.
      const elapsed = Date.now() - start;
      const delay = Math.max(0, intervalMs - elapsed);
      const t = setTimeout(tick, delay);
      // Don't keep the process alive solely for the timer.
      if (typeof t.unref === "function") t.unref();
    }
  };

  const t = setTimeout(tick, intervalMs);
  if (typeof t.unref === "function") t.unref();
}
