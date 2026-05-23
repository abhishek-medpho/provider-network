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

  isConfigured(): boolean {
    return Boolean(
      process.env.ULTRAMSG_INSTANCE_ID && process.env.ULTRAMSG_TOKEN,
    );
  },

  async send(input: SendInput): Promise<SendResult> {
    const r = await sendWhatsAppText(input.to, input.body);
    return r;
  },
};
