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

const BASE_URL = "https://api.ultramsg.com";
const INSTANCE_ID = process.env.ULTRAMSG_INSTANCE_ID;
const TOKEN = process.env.ULTRAMSG_TOKEN;

const instanceUrl = () => `${BASE_URL}/${INSTANCE_ID}`;

export type UltramsgSendResult =
  | { ok: true; messageId: string; raw: unknown }
  | { ok: false; error: string; raw?: unknown };

function hasCreds(): boolean {
  return Boolean(INSTANCE_ID && TOKEN);
}

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

async function ultramsgPost(
  endpoint: "messages/chat" | "messages/image" | "messages/document",
  params: Record<string, string>,
  context: string,
): Promise<UltramsgSendResult> {
  if (!hasCreds()) {
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
      error: "ULTRAMSG_INSTANCE_ID/TOKEN not configured",
    };
  }

  const url = `${instanceUrl()}/${endpoint}`;
  const body = new URLSearchParams({ token: TOKEN!, ...params });

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const data = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    if (
      !res.ok ||
      (data as { error?: string }).error ||
      (data as { sent?: string }).sent === "false"
    ) {
      return {
        ok: false,
        error: formatError(context, res.status, data),
        raw: data,
      };
    }

    const id =
      (data as { id?: string | number }).id ??
      (data as { message?: { id?: string } }).message?.id ??
      "";
    return { ok: true, messageId: String(id), raw: data };
  } catch (err) {
    return {
      ok: false,
      error: `Ultramsg ${context}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
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
