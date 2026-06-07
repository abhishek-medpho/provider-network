/**
 * Next.js instrumentation hook. `register()` runs exactly once when the
 * server process boots (both dev and prod). We use it to start an
 * in-process scheduler so a single self-contained container needs NO
 * external cron — the dispatch + reminder ticks run on setInterval inside
 * the Node server itself.
 *
 * Guards:
 *   - Only runs in the Node.js runtime (not Edge, not during build).
 *   - Only runs when SCHEDULER_ENABLED !== "false" (default ON in prod,
 *     OFF in dev to avoid noisy logs while developing — flip via env).
 *   - A module-level flag prevents double-start if register() fires twice
 *     (can happen with HMR in dev).
 *
 * SCALING NOTE: this assumes a SINGLE app instance. If you ever run more
 * than one replica, each would start its own scheduler and you'd get N×
 * the ticks. The dispatch/reminder logic is idempotent per-member (the
 * "lastSentAt is null" filter is part of the SELECT, and sends are
 * capped per tick), so the worst case is wasted DB reads, not double
 * sends — but for correctness at scale you'd move to a single external
 * cron or a DB advisory lock. For one container, this is the simplest
 * thing that works.
 */

export async function register() {
  // Only the Node.js server runtime should start timers.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Default: enabled in production, disabled in development unless the
  // developer explicitly opts in. Set SCHEDULER_ENABLED=true to run it
  // locally, or SCHEDULER_ENABLED=false to disable in prod.
  const explicit = process.env.SCHEDULER_ENABLED;
  const enabled =
    explicit === "true"
      ? true
      : explicit === "false"
        ? false
        : process.env.NODE_ENV === "production";

  if (!enabled) {
    console.log(
      "[scheduler] in-process scheduler disabled (set SCHEDULER_ENABLED=true to enable)",
    );
    return;
  }

  // Dynamic import so the scheduler module (and its DB deps) are only
  // loaded in the Node runtime, never bundled into Edge/build.
  const { startInProcessScheduler } = await import("@/lib/scheduler/loop");
  startInProcessScheduler();
}
