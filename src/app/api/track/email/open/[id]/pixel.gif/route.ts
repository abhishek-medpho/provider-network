import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Email-open tracking pixel. Embedded by lib/channels/email.ts as a 1×1 GIF
 * in every outbound campaign email. When the recipient's mail client renders
 * the image, we mark `openedAt` (first time) + bump openCount + log an
 * EmailEvent row.
 *
 * Caveats — well-known industry quirks:
 *   - Apple Mail's "Mail Privacy Protection" prefetches all images via Apple
 *     proxies, so every recipient appears to open the email immediately on
 *     receipt. Treat opens-from-Apple-IPs with a grain of salt.
 *   - Gmail caches/proxies images through Google's servers — we see the
 *     Google IP, not the user's. So userAgent/ipAddress are only useful as
 *     general signals, not for forensics.
 *   - Most clients block images by default; pixel fires only after the user
 *     opts to load images. Real opens are usually higher than what we record.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Best-effort log — don't let DB errors break the pixel response.
  try {
    const userAgent = req.headers.get("user-agent") ?? null;
    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      req.headers.get("x-real-ip") ??
      null;

    // Increment counters + record openedAt only on first open.
    const msg = await prisma.emailMessage.findUnique({
      where: { id },
      select: { id: true, openedAt: true },
    });
    if (msg) {
      await prisma.emailMessage.update({
        where: { id },
        data: {
          openCount: { increment: 1 },
          openedAt: msg.openedAt ?? new Date(),
          status: msg.openedAt ? undefined : "OPENED",
        },
      });
      await prisma.emailEvent.create({
        data: {
          emailMessageId: id,
          kind: "OPEN",
          userAgent,
          ipAddress,
        },
      });
    }
  } catch (err) {
    console.error("[email/open] failed to log:", err);
  }

  // 1×1 transparent GIF (43 bytes). Inlined so we don't depend on a static file.
  const gif = Buffer.from([
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
    0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00,
    0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
    0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
  ]);

  return new NextResponse(new Uint8Array(gif), {
    status: 200,
    headers: {
      "content-type": "image/gif",
      "content-length": String(gif.length),
      // No-cache so every render is a fresh hit. Even with caching, most
      // mail clients fetch the pixel once per session — fine for our needs.
      "cache-control": "no-store, no-cache, must-revalidate, private",
      pragma: "no-cache",
      expires: "0",
    },
  });
}
