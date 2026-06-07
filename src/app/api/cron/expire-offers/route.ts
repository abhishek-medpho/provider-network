/**
 * Cron tick: mark stale job offers EXPIRED. Mirrors the in-process
 * scheduler's expiry pass so an external scheduler (or a manual curl)
 * can drive it too. Bearer-CRON_SECRET auth, same as the other crons.
 */

import { NextRequest, NextResponse } from "next/server";
import { runExpiryTick } from "@/lib/jobs/expiry";

const CRON_SECRET = process.env.CRON_SECRET;

function isAuthorized(req: NextRequest): boolean {
  if (!CRON_SECRET) return false;
  if (req.headers.get("authorization") === `Bearer ${CRON_SECRET}`) return true;
  return req.nextUrl.searchParams.get("secret") === CRON_SECRET;
}

export async function POST(req: NextRequest) {
  return handle(req);
}
export async function GET(req: NextRequest) {
  return handle(req);
}

async function handle(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const result = await runExpiryTick();
  return NextResponse.json(
    { ok: true, ...result },
    { headers: { "cache-control": "no-store" } },
  );
}
