/**
 * Channel-agnostic types shared by every sender (WhatsApp / Email / SMS / …).
 * The dispatcher (lib/actions/campaigns.ts) holds a Map<Channel, ChannelSender>
 * and routes messages to the right one based on the template's channel + the
 * provider's available contact info.
 */

export type Channel = "WHATSAPP" | "EMAIL" | "SMS";

/** Inputs the dispatcher hands to any sender. */
export type SendInput = {
  /** Where to deliver: phone (E.164 digits, no plus) for WA/SMS; email for email */
  to: string;
  /** Pre-rendered text body. For email, used as the text/plain fallback. */
  body: string;
  /** Email-only: subject line. Ignored by WhatsApp/SMS. */
  subject?: string;
  /**
   * Email-only: pre-rendered HTML body. If omitted, sender will auto-convert
   * `body` from plaintext to a minimal styled HTML wrapper.
   */
  html?: string;
  /**
   * Email-only: the per-recipient EmailMessage id, used by the sender to
   * inject open + click tracking URLs that the /api/track/* routes resolve.
   */
  trackingId?: string;
};

/** Unified result type so the dispatcher doesn't need per-channel branches. */
export type SendResult =
  | {
      ok: true;
      /** Channel-side message id (Ultramsg id, SMTP message-id, etc.) */
      messageId: string;
      raw?: unknown;
    }
  | {
      ok: false;
      /** Friendly error string to surface in admin */
      error: string;
      raw?: unknown;
    };

export interface ChannelSender {
  channel: Channel;
  /**
   * Are the credentials/config present for this channel? Used by the
   * dispatcher to skip channels at boot time without erroring per-send.
   */
  isConfigured(): boolean;
  /**
   * Send a single message. Implementations handle their own retries +
   * backoff. Pacing/throttling is the dispatcher's job.
   */
  send(input: SendInput): Promise<SendResult>;
}
