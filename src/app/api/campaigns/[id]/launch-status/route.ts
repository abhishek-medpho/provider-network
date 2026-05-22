import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Live launch progress for a campaign. The campaign detail page polls this
 * while a background launch loop is running (Campaign.launchInProgress).
 *
 * Returns:
 *   inProgress    — is the loop currently running?
 *   total         — how many sends were targeted this launch
 *   sent          — how many succeeded so far
 *   failed        — how many failed (after all retries)
 *   pct           — convenience percent (0–100, integer)
 *   startedAt     — when the loop started
 *   completedAt   — when it finished (null while running)
 *   error         — last error string, if the loop crashed
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  const c = await prisma.campaign.findUnique({
    where: { id },
    select: {
      id: true,
      launchInProgress: true,
      launchTotal: true,
      launchSent: true,
      launchFailed: true,
      launchStartedAt: true,
      launchCompletedAt: true,
      launchError: true,
    },
  });
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const done = c.launchSent + c.launchFailed;
  const pct =
    c.launchTotal > 0 ? Math.min(100, Math.round((done / c.launchTotal) * 100)) : 0;

  return NextResponse.json(
    {
      inProgress: c.launchInProgress,
      total: c.launchTotal,
      sent: c.launchSent,
      failed: c.launchFailed,
      pct,
      startedAt: c.launchStartedAt,
      completedAt: c.launchCompletedAt,
      error: c.launchError,
    },
    // Don't let the browser cache progress reads.
    { headers: { "cache-control": "no-store" } },
  );
}
