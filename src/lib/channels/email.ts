/**
 * Email sender via Gmail SMTP (app password auth).
 *
 * Why Gmail SMTP and not the Gmail API?
 *   - 5-minute setup: enable 2FA → generate app password → paste into .env.
 *   - Works with both personal Gmail and Google Workspace.
 *   - Industry-standard SMTP — easy to swap for SendGrid/AWS SES later just
 *     by changing the transport config.
 *
 * Rate limits to keep in mind (per Gmail):
 *   - Personal Gmail: ~500 messages/day, ~100 recipients per message
 *   - Workspace:       ~2,000 messages/day
 *   - Burst:           Google throttles ~20-30 msg/sec. Pacing is enforced
 *                      by the dispatcher (pacedSleep), not here.
 *
 * Open + click tracking is injected ONLY if `trackingId` is provided. The
 * dispatcher fills it with the EmailMessage row id; the /api/track/email/*
 * routes resolve back to that id to record opens + clicks.
 */

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type { ChannelSender, SendInput, SendResult } from "./types";

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const FROM_NAME = process.env.EMAIL_FROM_NAME ?? "Labstack Network";
const REPLY_TO = process.env.EMAIL_REPLY_TO ?? GMAIL_USER;
const APP_BASE_URL =
  process.env.APP_BASE_URL ?? process.env.NEXTAUTH_URL ?? "";

// Retry config for transient SMTP failures (same shape as ultramsg.ts).
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 800;

let cachedTransporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (cachedTransporter) return cachedTransporter;
  cachedTransporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    // Gmail is fine with the default connection pool. If we ever need to
    // ramp throughput, set: `pool: true, maxConnections: 5, maxMessages: 100`.
  });
  return cachedTransporter;
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

/**
 * Classify an SMTP / nodemailer error. We retry network blips and 4xx soft
 * bounces; we don't retry 5xx hard bounces or auth failures (those won't fix
 * themselves and burning retries on them just wastes time and tickles
 * Gmail's anti-abuse heuristics).
 */
function isTransient(err: NodemailerError): boolean {
  const code = err.code;
  if (code === "ESOCKET" || code === "ETIMEDOUT" || code === "ECONNRESET")
    return true;
  // SMTP soft bounces: 4xx
  if (err.responseCode && err.responseCode >= 400 && err.responseCode < 500)
    return true;
  return false;
}

type NodemailerError = Error & {
  code?: string;
  responseCode?: number;
  response?: string;
};

/**
 * Decorate an HTML body with:
 *   1. An invisible 1×1 open-tracking pixel at the bottom.
 *   2. Click-tracked anchor URLs (every <a href="…"> wrapped in our redirect).
 * If `trackingId` isn't provided (e.g. transactional emails outside campaigns)
 * the HTML is returned unchanged.
 */
function injectTracking(html: string, trackingId: string | undefined): string {
  if (!trackingId || !APP_BASE_URL) return html;
  const safeId = encodeURIComponent(trackingId);

  // Click tracking — wrap real URLs in our redirect endpoint
  const withClickTracking = html.replace(
    /href="(https?:\/\/[^"]+)"/g,
    (_match, url: string) => {
      // Don't track the unsubscribe / app-base links — keep them direct.
      if (url.startsWith(APP_BASE_URL)) return `href="${url}"`;
      const wrapped = `${APP_BASE_URL}/api/track/email/click/${safeId}?u=${encodeURIComponent(url)}`;
      return `href="${wrapped}"`;
    },
  );

  // Open pixel — append just before </body>, or at the end if no body tag
  const pixel = `<img src="${APP_BASE_URL}/api/track/email/open/${safeId}/pixel.gif" alt="" width="1" height="1" style="border:0;display:block;outline:none;text-decoration:none;" />`;
  if (/<\/body>/i.test(withClickTracking)) {
    return withClickTracking.replace(/<\/body>/i, `${pixel}</body>`);
  }
  return withClickTracking + pixel;
}

/**
 * Wrap a plain-text body in a minimal HTML template. Used when callers pass
 * `body` but not `html` (i.e. authored a text-only template but we still
 * want open tracking).
 */
function textToHtml(text: string): string {
  const safe = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  // Linkify any bare URLs so they're clickable in HTML clients.
  const linkified = safe.replace(
    /(https?:\/\/[^\s<>"']+)/g,
    '<a href="$1">$1</a>',
  );
  const paragraphs = linkified
    .split(/\n\n+/)
    .map((p) => `<p style="margin:0 0 16px;">${p.replace(/\n/g, "<br />")}</p>`)
    .join("");
  return `<!doctype html>
<html><body style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#18181b;max-width:600px;margin:0 auto;padding:24px;">
${paragraphs}
</body></html>`;
}

export const emailSender: ChannelSender = {
  channel: "EMAIL",

  isConfigured(): boolean {
    return Boolean(GMAIL_USER && GMAIL_APP_PASSWORD);
  },

  async send(input: SendInput): Promise<SendResult> {
    if (!this.isConfigured()) {
      // Dev convenience: log instead of erroring when creds missing.
      if (process.env.NODE_ENV !== "production") {
        console.warn("[email] credentials missing — logging instead of sending");
        console.log("[email dry-run]", {
          to: input.to,
          subject: input.subject,
          bodyPreview: input.body.slice(0, 100),
        });
        return { ok: true, messageId: "dry-run" };
      }
      return {
        ok: false,
        error: "GMAIL_USER / GMAIL_APP_PASSWORD not configured",
      };
    }

    if (!input.subject) {
      return { ok: false, error: "Email requires a subject" };
    }

    const html = input.html ?? textToHtml(input.body);
    const trackedHtml = injectTracking(html, input.trackingId);
    const from = `"${FROM_NAME}" <${GMAIL_USER}>`;

    let lastErr: SendResult = {
      ok: false,
      error: "no attempts made",
    };

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const info = await getTransporter().sendMail({
          from,
          to: input.to,
          replyTo: REPLY_TO,
          subject: input.subject,
          text: input.body,
          html: trackedHtml,
        });
        if (attempt > 1) {
          console.log(
            `[email] succeeded on attempt ${attempt}/${MAX_ATTEMPTS} → ${input.to}`,
          );
        }
        return {
          ok: true,
          messageId: info.messageId ?? "",
          raw: { accepted: info.accepted, response: info.response },
        };
      } catch (err) {
        const nmErr = err as NodemailerError;
        const errorMsg = `Email send: ${nmErr.responseCode ?? nmErr.code ?? "?"} ${nmErr.message}`;
        lastErr = { ok: false, error: errorMsg, raw: { code: nmErr.code } };

        const willRetry = isTransient(nmErr) && attempt < MAX_ATTEMPTS;
        if (!willRetry) return lastErr;

        const base = BASE_BACKOFF_MS * Math.pow(2, attempt - 1);
        const jitter = base * (0.75 + Math.random() * 0.5);
        const wait = Math.round(jitter);
        console.warn(
          `[email] attempt ${attempt}/${MAX_ATTEMPTS} failed (${errorMsg}) — retrying in ${wait}ms`,
        );
        await sleep(wait);
      }
    }

    return lastErr;
  },
};
