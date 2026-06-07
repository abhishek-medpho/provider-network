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
import { runDispatchTick } from "@/lib/dispatch/runners";

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

  const result = await runDispatchTick();

  return NextResponse.json(
    { ok: true, ...result },
    { headers: { "cache-control": "no-store" } },
  );
}
