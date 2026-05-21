/**
 * Ultramsg WhatsApp client.
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

const BASE_URL =
  process.env.ULTRAMSG_BASE_URL ?? "https://api.ultramsg.com";
const INSTANCE_ID = process.env.ULTRAMSG_INSTANCE_ID;
const TOKEN = process.env.ULTRAMSG_TOKEN;

export type UltramsgSendResult =
  | { ok: true; messageId: string; raw: unknown }
  | { ok: false; error: string; raw?: unknown };

/**
 * Send a plain WhatsApp text message via Ultramsg.
 * `to` must already be normalized (digits + country code, no plus).
 */
export async function sendWhatsAppText(
  to: string,
  body: string,
): Promise<UltramsgSendResult> {
  if (!INSTANCE_ID || !TOKEN) {
    // Dev fallback: log instead of sending. Lets you build without creds.
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[ultramsg] credentials missing — logging message instead of sending",
      );
      console.log("[ultramsg dry-run]", { to, body });
      return { ok: true, messageId: "dry-run", raw: { dryRun: true } };
    }
    return { ok: false, error: "ULTRAMSG_INSTANCE_ID/TOKEN not configured" };
  }

  const url = `${BASE_URL}/${INSTANCE_ID}/messages/chat`;
  const params = new URLSearchParams({
    token: TOKEN,
    to,
    body,
    // priority: "10",
  });

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const data = (await res.json().catch(() => ({}))) as {
      sent?: string;
      id?: string | number;
      message?: string;
      error?: string;
    };

    if (!res.ok || data.error || data.sent === "false") {
      return {
        ok: false,
        error: data.error || data.message || `HTTP ${res.status}`,
        raw: data,
      };
    }

    return {
      ok: true,
      messageId: String(data.id ?? ""),
      raw: data,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
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
    throw new Error(`WhatsApp send failed: ${result.error}`);
  }
}
