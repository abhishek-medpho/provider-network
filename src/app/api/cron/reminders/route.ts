/**
 * POST /api/cron/reminders
 *
 * Evaluates all active reminder rules and fires due reminders.
 * Call this from an external scheduler (e.g. cron job, Vercel cron, etc.)
 * every 30–60 minutes.
 *
 * Protected by a shared secret in the Authorization header:
 *   Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from "next/server";
import { runReminderRules } from "@/lib/actions/reminders";

export async function POST(req: NextRequest) {
  // Validate secret
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.replace(/^Bearer\s+/i, "");
    if (token !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const results = await runReminderRules();
    const totalSent = results.reduce((s, r) => s + r.sent, 0);
    const totalFailed = results.reduce((s, r) => s + r.failed, 0);
    const totalSuppressed = results.reduce((s, r) => s + r.suppressed, 0);

    return NextResponse.json({
      ok: true,
      rulesEvaluated: results.length,
      totalSent,
      totalFailed,
      totalSuppressed,
      rules: results,
    });
  } catch (err) {
    console.error("[cron/reminders] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}

// Also allow GET for easy browser testing (still requires secret in query param)
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const secret = req.nextUrl.searchParams.get("secret");
    if (secret !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const results = await runReminderRules();
    return NextResponse.json({ ok: true, results });
  } catch (err) {
    console.error("[cron/reminders] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
