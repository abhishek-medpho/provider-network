/**
 * Transactional send — fires immediately, bypassing the bulk dispatch
 * throttle. Use for ANY message that the user expects right now:
 *   - Form-submission confirmation
 *   - Profile activation / rejection
 *   - Admin magic links
 *   - One-off operator messages
 *
 * Why bypass the throttle?
 *   Volume: transactional sends are 1-1 (one per provider, one per
 *   event), so they don't add to the bulk-blast pattern that gets
 *   WhatsApp accounts flagged.
 *   Latency: the throttle is hours-long; users would notice. A bank
 *   doesn't throttle the "you sent ₹100" confirmation.
 *
 * Quiet-hours: we deliberately DO send transactional messages outside
 * the bulk-campaign quiet window. Quiet hours exist to avoid waking
 * people for marketing — a profile-activated confirmation right after
 * the user finished the form is OK.
 *
 * Opt-outs: we still respect them. Even a "you're activated" message
 * goes to /dev/null for an opted-out provider.
 */

import { prisma } from "@/lib/db";
import type { Prisma, MessageChannel } from "@prisma/client";
import { renderBody } from "@/lib/messageTemplate";
import { SENDERS } from "@/lib/channels";

export type TransactionalSendInput = {
  careProviderId: string;
  /** Template code (e.g. "form_submitted_thanks") — looked up at send time. */
  templateCode: string;
  /** Which channels to fire. Defaults to whatever templates exist. */
  channels?: MessageChannel[];
  /** Merge-tag variables. Caller fills these (name, form_link, etc.). */
  vars?: Record<string, string>;
};

export type TransactionalSendResult = {
  ok: boolean;
  attempted: MessageChannel[];
  sent: MessageChannel[];
  reasons: Partial<Record<MessageChannel, string>>;
};

/**
 * Fire a transactional send for one provider.
 *
 * Resolution order:
 *   1. Provider must not be opted out (otherwise no channels attempt).
 *   2. For each channel requested, look up the matching template by
 *      (code, language=en, channel). Skip channels without a template.
 *   3. Fire each, log a per-channel outbound row.
 *
 * Returns a structured result so callers can surface errors (e.g. the
 * onboarding form's submit action can include the confirm-send failure
 * in its admin alert, but not block the form submission itself).
 */
export async function sendTransactional(
  input: TransactionalSendInput,
): Promise<TransactionalSendResult> {
  const provider = await prisma.careProvider.findUnique({
    where: { id: input.careProviderId },
    select: {
      id: true,
      phone: true,
      email: true,
      name: true,
      optedOutAt: true,
      pincodeHome: true,
    },
  });
  const result: TransactionalSendResult = {
    ok: true,
    attempted: [],
    sent: [],
    reasons: {},
  };
  if (!provider) {
    return {
      ok: false,
      attempted: [],
      sent: [],
      reasons: { WHATSAPP: "provider not found" },
    };
  }
  if (provider.optedOutAt) {
    return {
      ok: true,
      attempted: [],
      sent: [],
      reasons: { WHATSAPP: "opted out" },
    };
  }

  // Default channels: try every channel that has a matching template,
  // gated by whether the provider has that contact info.
  const allTemplates = await prisma.messageTemplate.findMany({
    where: {
      code: input.templateCode,
      language: "en",
      active: true,
      ...(input.channels ? { channel: { in: input.channels } } : {}),
    },
    orderBy: { channel: "asc" },
  });

  if (allTemplates.length === 0) {
    return {
      ok: false,
      attempted: [],
      sent: [],
      reasons: {
        WHATSAPP: `no active template with code "${input.templateCode}"`,
      },
    };
  }

  const vars: Record<string, string> = {
    name: provider.name ?? "there",
    first_name: (provider.name ?? "there").split(/\s+/)[0],
    pincode: provider.pincodeHome ?? "",
    ...(input.vars ?? {}),
  };

  for (const tpl of allTemplates) {
    if (tpl.channel === "WHATSAPP") {
      if (!provider.phone) {
        result.reasons.WHATSAPP = "no phone on file";
        continue;
      }
      result.attempted.push("WHATSAPP");
      const body = renderBody(tpl.body, vars);
      const r = await SENDERS.WHATSAPP.send({ to: provider.phone, body });
      await prisma.whatsAppMessage.create({
        data: {
          careProviderId: provider.id,
          messageTemplateId: tpl.id,
          toPhone: provider.phone,
          body,
          status: r.ok ? "SENT" : "FAILED",
          ultramsgMessageId: r.ok ? r.messageId : null,
          errorMessage: !r.ok ? r.error : null,
          sentAt: r.ok ? new Date() : null,
        },
      });
      if (r.ok) result.sent.push("WHATSAPP");
      else {
        result.reasons.WHATSAPP = r.error;
        result.ok = false;
      }
    } else if (tpl.channel === "EMAIL") {
      if (!provider.email) {
        result.reasons.EMAIL = "no email on file";
        continue;
      }
      result.attempted.push("EMAIL");
      const subject = renderBody(tpl.subject ?? "", vars);
      const body = renderBody(tpl.body, vars);
      const html = tpl.html ? renderBody(tpl.html, vars) : undefined;
      const draft = await prisma.emailMessage.create({
        data: {
          careProviderId: provider.id,
          messageTemplateId: tpl.id,
          toEmail: provider.email,
          subject,
          body,
          html: null,
          status: "SENDING",
        },
      });
      const r = await SENDERS.EMAIL.send({
        to: provider.email,
        subject,
        body,
        html,
        trackingId: draft.id,
      });
      await prisma.emailMessage.update({
        where: { id: draft.id },
        data: {
          status: r.ok ? "SENT" : "FAILED",
          providerMessageId: r.ok ? r.messageId : null,
          errorMessage: !r.ok ? r.error : null,
          sentAt: r.ok ? new Date() : null,
        },
      });
      if (r.ok) result.sent.push("EMAIL");
      else {
        result.reasons.EMAIL = r.error;
        result.ok = false;
      }
    }
  }

  // Lifecycle event — useful for the admin timeline.
  await prisma.careProviderEvent.create({
    data: {
      careProviderId: provider.id,
      type: "TRANSACTIONAL_SENT",
      payload: {
        templateCode: input.templateCode,
        channels: result.sent,
        reasons: result.reasons,
      } as Prisma.InputJsonValue,
    },
  });

  return result;
}
