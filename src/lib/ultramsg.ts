/**
 * Ultramsg WhatsApp client.
 *
 * Ported from ClaimOS Backend's `ultraMsg.service.ts` and adapted for our
 * needs (text-first, with image/document support if we need it later).
 *
 * Ultramsg is an unofficial WhatsApp gateway that bridges WA Web on a phone
 * number you own. Trade-offs vs. an official BSP (WATI/AiSensy/Interakt):
 *   - No template approvals; can send plain text + media freely
 *   - No interactive buttons / lists / WhatsApp Flows
 *   - Risk of WA banning the number if you bulk-blast
 *   - Lower delivery reliability; rate-limit yourself
 *
 * For MVP this is fine. Treat WA as "delivery channel for a web link".
 *
 * Docs: https://docs.ultramsg.com/
 */

import { getWhatsAppConfig } from "@/lib/channels/config";

export type UltramsgSendResult =
  | { ok: true; messageId: string; raw: unknown }
  | { ok: false; error: string; raw?: unknown };

/**
 * Format Ultramsg / fetch errors into a single concise line.
 * Mirrors the ClaimOS service's formatError — surfaces the
 * subscription-stopped case specifically since it's the most common
 * "why isn't WA sending?" cause.
 */
function formatError(context: string, status: number, data: unknown): string {
  const apiError =
    (data as { error?: string; message?: string } | null)?.error ??
    (data as { error?: string; message?: string } | null)?.message ??
    null;

  if (
    apiError &&
    typeof apiError === "string" &&
    apiError.toLowerCase().includes("non-payment")
  ) {
    return `Ultramsg ${context}: instance stopped due to non-payment. Renew the subscription at https://ultramsg.com.`;
  }
  if (apiError) {
    return `Ultramsg ${context}: [${status}] ${apiError}`;
  }
  return `Ultramsg ${context}: HTTP ${status}`;
}

// Retry config — applied to transient network failures and 5xx responses.
// Subscription errors / 4xx auth failures are NOT retried.
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 800;

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

/**
 * Is this an error worth retrying? Network errors and 5xx Ultramsg/Cloudflare
 * blips are transient — retry them. Subscription stopped, 4xx auth, etc.
 * are permanent and shouldn't waste attempts.
 */
function isTransient(status: number, errorMsg: string | null): boolean {
  // Network errors (we synthesize status 0 for fetch throws below)
  if (status === 0) return true;
  // Cloudflare in front of Ultramsg flakes: 520, 521, 522, 524
  if (status >= 500) return true;
  // 429 = rate limited — retry with backoff
  if (status === 429) return true;
  // Don't retry "non-payment" — won't fix itself
  if (errorMsg && errorMsg.toLowerCase().includes("non-payment")) return false;
  return false;
}

async function ultramsgPost(
  endpoint: "messages/chat" | "messages/image" | "messages/document",
  params: Record<string, string>,
  context: string,
): Promise<UltramsgSendResult> {
  const cfg = await getWhatsAppConfig();

  if (!cfg) {
    // Dev fallback: log instead of sending. Lets you build without creds.
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[ultramsg] credentials missing — logging ${context} instead of sending`,
      );
      console.log(`[ultramsg dry-run ${endpoint}]`, params);
      return { ok: true, messageId: "dry-run", raw: { dryRun: true } };
    }
    return {
      ok: false,
      error:
        "WhatsApp channel not configured. Set it up at /admin/settings or via ULTRAMSG_* env vars.",
    };
  }

  if (!cfg.enabled) {
    return { ok: false, error: "WhatsApp channel is disabled in settings." };
  }

  const url = `${cfg.baseUrl}/${cfg.instanceId}/${endpoint}`;
  const body = new URLSearchParams({ token: cfg.token, ...params });

  let lastErr: UltramsgSendResult = {
    ok: false,
    error: `Ultramsg ${context}: no attempts made`,
  };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let status = 0;
    let data: Record<string, unknown> = {};
    let networkErr: Error | null = null;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      status = res.status;
      data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    } catch (err) {
      networkErr = err instanceof Error ? err : new Error(String(err));
      status = 0;
    }

    // Success path
    if (
      !networkErr &&
      status >= 200 &&
      status < 300 &&
      !(data as { error?: string }).error &&
      (data as { sent?: string }).sent !== "false"
    ) {
      const id =
        (data as { id?: string | number }).id ??
        (data as { message?: { id?: string } }).message?.id ??
        "";
      if (attempt > 1) {
        console.log(
          `[ultramsg] ${context} succeeded on attempt ${attempt}/${MAX_ATTEMPTS}`,
        );
      }
      return { ok: true, messageId: String(id), raw: data };
    }

    // Failure — decide whether to retry
    const apiErr =
      (data as { error?: string; message?: string }).error ??
      (data as { error?: string; message?: string }).message ??
      networkErr?.message ??
      null;
    const errorMsg = networkErr
      ? `Ultramsg ${context}: ${networkErr.message}`
      : formatError(context, status, data);

    lastErr = { ok: false, error: errorMsg, raw: data };

    const transient = isTransient(status, apiErr);
    const willRetry = transient && attempt < MAX_ATTEMPTS;

    if (willRetry) {
      // Exponential backoff with jitter: 800ms, 1600ms, 3200ms ± 25%
      const base = BASE_BACKOFF_MS * Math.pow(2, attempt - 1);
      const jitter = base * (0.75 + Math.random() * 0.5);
      const wait = Math.round(jitter);
      console.warn(
        `[ultramsg] ${context} attempt ${attempt}/${MAX_ATTEMPTS} failed (${errorMsg}) — retrying in ${wait}ms`,
      );
      await sleep(wait);
      continue;
    }

    // Permanent error OR retries exhausted
    return lastErr;
  }

  return lastErr;
}

/**
 * Send a plain WhatsApp text message.
 * `to` must already be normalized (digits + country code, no plus).
 */
export async function sendWhatsAppText(
  to: string,
  body: string,
): Promise<UltramsgSendResult> {
  return ultramsgPost("messages/chat", { to, body }, "text");
}

/**
 * Sleep a humanlike, randomized interval between bulk WhatsApp sends. Required
 * to avoid WhatsApp's anti-spam triggers — sustained >1 msg/min on a single
 * number gets the account flagged and (eventually) banned.
 *
 * Caller passes the iteration index and total length so we skip the wait on
 * the last item. Override the window via env if you want to ship more
 * aggressively (do this only if you know your WhatsApp account is warmed up).
 */
const PACE_MIN_MS = Number(process.env.WHATSAPP_PACE_MIN_MS ?? 3000);
const PACE_MAX_MS = Number(process.env.WHATSAPP_PACE_MAX_MS ?? 10000);

export async function pacedSleep(): Promise<void> {
  const range = Math.max(0, PACE_MAX_MS - PACE_MIN_MS);
  const ms = PACE_MIN_MS + Math.floor(Math.random() * (range + 1));
  await sleep(ms);
}

/**
 * Send a WhatsApp image with optional caption. `imageUrl` must be publicly
 * reachable by Ultramsg's servers.
 */
export async function sendWhatsAppImage(
  to: string,
  imageUrl: string,
  caption = "",
): Promise<UltramsgSendResult> {
  return ultramsgPost(
    "messages/image",
    { to, image: imageUrl, caption },
    "image",
  );
}

/**
 * Send a WhatsApp document (PDF etc.). `documentUrl` must be publicly
 * reachable by Ultramsg's servers.
 */
export async function sendWhatsAppDocument(
  to: string,
  documentUrl: string,
  filename = "document.pdf",
  caption = "",
): Promise<UltramsgSendResult> {
  return ultramsgPost(
    "messages/document",
    { to, document: documentUrl, filename, caption },
    "document",
  );
}

/**
 * Smart sender — picks image vs document based on the filename extension.
 */
export async function sendWhatsAppMedia(
  to: string,
  fileUrl: string,
  filename: string,
  caption = "",
): Promise<UltramsgSendResult> {
  const isPdf = filename.toLowerCase().endsWith(".pdf");
  return isPdf
    ? sendWhatsAppDocument(to, fileUrl, filename, caption)
    : sendWhatsAppImage(to, fileUrl, caption);
}

/**
 * Send a WhatsApp message containing a magic login link for admin auth.
 * Used by NextAuth's `sendVerificationRequest`.
 */
export async function sendWhatsAppLoginLink(
  toPhone: string,
  url: string,
): Promise<void> {
  const ttl = process.env.WHATSAPP_LOGIN_LINK_TTL_MIN ?? "15";
  const body = [
    "🔐 *Care Provider Platform login*",
    "",
    `Tap to sign in (valid for ${ttl} min):`,
    url,
    "",
    "If you didn't request this, ignore this message.",
  ].join("\n");

  const result = await sendWhatsAppText(toPhone, body);
  if (!result.ok) {
    throw new Error(result.error);
  }
}
