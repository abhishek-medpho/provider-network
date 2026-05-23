/**
 * Central registry of available channels. The dispatcher imports this and
 * picks the right sender based on the MessageTemplate.channel + the campaign's
 * channelStrategy.
 *
 * To add a new channel (e.g. SMS via Twilio):
 *   1. Create src/lib/channels/sms.ts exposing { smsSender: ChannelSender }
 *   2. Add it to the SENDERS map below
 *   3. Add "SMS" to the channelStrategy enum + UI
 */

import type { Channel, ChannelSender } from "./types";
import { whatsAppSender } from "./whatsapp";
import { emailSender } from "./email";

export const SENDERS: Record<Channel, ChannelSender> = {
  WHATSAPP: whatsAppSender,
  EMAIL: emailSender,
  // SMS: smsSender,   ← add when we wire Twilio/MSG91
  SMS: {
    channel: "SMS",
    isConfigured: () => false,
    send: async () => ({
      ok: false,
      error: "SMS channel not yet implemented",
    }),
  },
};

export type { Channel, ChannelSender, SendInput, SendResult } from "./types";
