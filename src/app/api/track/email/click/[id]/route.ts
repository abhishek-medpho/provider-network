import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Email-link click tracking. lib/channels/email.ts rewrites every <a href>
 * in outbound HTML to point here, with the real URL in `?u=...`. We log the
 * click + redirect (302) to the actual destination.
 *
 * Defensive against malicious `u` values:
 *   - Only allow http(s) URLs (no javascript:, data:, etc.).
 *   - If `u` is missing or invalid, redirect to the app root rather than
 *     erroring — better UX than a stack trace in someone's browser.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(req.url);
  const target = url.searchParams.get("u");

  // Validate target URL
  let destination: string;
  try {
    if (!target) throw new Error("missing u param");
    const parsed = new URL(target);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("disallowed protocol");
    }
    destination = parsed.toString();
  } catch {
    destination = process.env.APP_BASE_URL ?? "/";
  }

  // Best-effort log — don't let DB error block the redirect.
  try {
    const userAgent = req.headers.get("user-agent") ?? null;
    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      req.headers.get("x-real-ip") ??
      null;

    const msg = await prisma.emailMessage.findUnique({
      where: { id },
      select: { id: true, firstClickedAt: true, status: true },
    });
    if (msg) {
      await prisma.emailMessage.update({
        where: { id },
        data: {
          clickCount: { increment: 1 },
          firstClickedAt: msg.firstClickedAt ?? new Date(),
          // Promote status to CLICKED unless already in a more-terminal state
          status:
            msg.status === "SENT" || msg.status === "OPENED"
              ? "CLICKED"
              : undefined,
        },
      });
      await prisma.emailEvent.create({
        data: {
          emailMessageId: id,
          kind: "CLICK",
          url: destination,
          userAgent,
          ipAddress,
        },
      });
    }
  } catch (err) {
    console.error("[email/click] failed to log:", err);
  }

  return NextResponse.redirect(destination, 302);
}
