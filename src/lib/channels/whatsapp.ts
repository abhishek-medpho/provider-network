/**
 * WhatsApp sender — thin adapter over the existing Ultramsg client.
 * All retry / backoff logic lives in ultramsg.ts itself; this file just
 * conforms it to the ChannelSender interface so the dispatcher can use
 * it uniformly alongside EmailSender.
 */

import { sendWhatsAppText } from "@/lib/ultramsg";
import type { ChannelSender, SendInput, SendResult } from "./types";

export const whatsAppSender: ChannelSender = {
  channel: "WHATSAPP",

  /**
   * Sync stub. Real readiness is checked async at send time via the
   * DB-aware config loader in ultramsg.ts. Returning true here just means
   * the channel exists; lack of credentials surfaces as a clean error
   * inside send().
   */
  isConfigured(): boolean {
    return true;
  },

  async send(input: SendInput): Promise<SendResult> {
    const r = await sendWhatsAppText(input.to, input.body);
    return r;
  },
};
