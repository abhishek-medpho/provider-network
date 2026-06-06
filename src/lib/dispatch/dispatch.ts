/**
 * Per-member dispatch — fires the actual sends, used by both the bulk
 * cron path (`/api/cron/dispatch`) and the existing in-process loop.
 *
 * Keeps the channel-selection / template-resolution / row-logging logic
 * in one place so the cron and the live-launch flow can't drift.
 */

import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { renderBody } from "@/lib/messageTemplate";
import { SENDERS, type Channel } from "@/lib/channels";

type DispatchResult = {
  ok: boolean;
  channelsTried: Channel[];
  anySuccess: boolean;
};

/**
 * Send the campaign invite to ONE member, respecting the campaign's
 * channelStrategy + the member's available contact info. Used per-member
 * by the cron loop and the live-launch loop.
 */
export async function dispatchInviteToMember(
  memberId: string,
): Promise<DispatchResult> {
  const member = await prisma.campaignMember.findUnique({
    where: { id: memberId },
    include: {
      careProvider: true,
      campaign: {
        include: {
          inviteMessageTemplate: true,
          inviteEmailTemplate: true,
          profileType: true,
        },
      },
    },
  });
  if (!member) return { ok: false, channelsTried: [], anySuccess: false };
  const { campaign, careProvider: cp } = member;

  const baseUrl = process.env.APP_BASE_URL || process.env.NEXTAUTH_URL || "";
  const vars: Record<string, string> = {
    name: cp.name ?? "there",
    first_name: (cp.name ?? "there").split(/\s+/)[0],
    role: campaign.profileType.code,
    role_label: campaign.profileType.label,
    form_link: `${baseUrl}/onboard/${member.token}`,
    pincode: cp.pincodeHome ?? "",
  };

  const { channels, firstSuccessWins } = pickChannelsForMember(
    campaign.channelStrategy,
    { phone: cp.phone, email: cp.email },
  );

  if (channels.length === 0) {
    return { ok: false, channelsTried: [], anySuccess: false };
  }

  let anySuccess = false;
  const tried: Channel[] = [];
  for (const channel of channels) {
    tried.push(channel);
    const ok = await sendOnChannelOnce({
      channel,
      memberId: member.id,
      careProvider: cp,
      vars,
      campaignId: campaign.id,
      waTemplate: campaign.inviteMessageTemplate,
      emailTemplate: campaign.inviteEmailTemplate,
    });
    if (ok) anySuccess = true;
    if (ok && firstSuccessWins) break;
  }

  if (anySuccess) {
    await prisma.campaignMember.update({
      where: { id: member.id },
      data: { status: "SENT", lastSentAt: new Date() },
    });
    await prisma.careProviderEvent.create({
      data: {
        careProviderId: cp.id,
        type: "INVITE_SENT",
        payload: {
          campaignId: campaign.id,
          channels: tried,
          strategy: campaign.channelStrategy,
        } as Prisma.InputJsonValue,
      },
    });
  }

  return { ok: true, channelsTried: tried, anySuccess };
}

function pickChannelsForMember(
  strategy: string,
  contacts: { phone: string | null | undefined; email: string | null | undefined },
): { channels: Channel[]; firstSuccessWins: boolean } {
  const hasPhone = Boolean(contacts.phone);
  const hasEmail = Boolean(contacts.email);
  switch (strategy) {
    case "EMAIL_ONLY":
      return { channels: hasEmail ? ["EMAIL"] : [], firstSuccessWins: false };
    case "BOTH": {
      const list: Channel[] = [];
      if (hasPhone) list.push("WHATSAPP");
      if (hasEmail) list.push("EMAIL");
      return { channels: list, firstSuccessWins: false };
    }
    case "WHATSAPP_FIRST": {
      const list: Channel[] = [];
      if (hasPhone) list.push("WHATSAPP");
      if (hasEmail) list.push("EMAIL");
      return { channels: list, firstSuccessWins: true };
    }
    case "EMAIL_FIRST": {
      const list: Channel[] = [];
      if (hasEmail) list.push("EMAIL");
      if (hasPhone) list.push("WHATSAPP");
      return { channels: list, firstSuccessWins: true };
    }
    case "WHATSAPP_ONLY":
    default:
      return { channels: hasPhone ? ["WHATSAPP"] : [], firstSuccessWins: false };
  }
}

async function sendOnChannelOnce(args: {
  channel: Channel;
  memberId: string;
  careProvider: { id: string; phone: string; email: string | null };
  vars: Record<string, string>;
  campaignId: string;
  waTemplate: { id: string; body: string } | null;
  emailTemplate: {
    id: string;
    body: string;
    subject: string | null;
    html: string | null;
  } | null;
}): Promise<boolean> {
  const { channel, careProvider: cp, vars, campaignId, waTemplate, emailTemplate } = args;
  const sender = SENDERS[channel];

  if (channel === "WHATSAPP") {
    if (!waTemplate) return false;
    const body = renderBody(waTemplate.body, vars);
    const result = await sender.send({ to: cp.phone, body });
    await prisma.whatsAppMessage.create({
      data: {
        careProviderId: cp.id,
        campaignId,
        messageTemplateId: waTemplate.id,
        toPhone: cp.phone,
        body,
        status: result.ok ? "SENT" : "FAILED",
        ultramsgMessageId: result.ok ? result.messageId : null,
        errorMessage: !result.ok ? result.error : null,
        sentAt: result.ok ? new Date() : null,
      },
    });
    return result.ok;
  }

  if (channel === "EMAIL") {
    if (!emailTemplate || !cp.email) return false;
    const subject = renderBody(emailTemplate.subject ?? "", vars);
    const body = renderBody(emailTemplate.body, vars);
    const html = emailTemplate.html ? renderBody(emailTemplate.html, vars) : undefined;
    const draft = await prisma.emailMessage.create({
      data: {
        careProviderId: cp.id,
        campaignId,
        messageTemplateId: emailTemplate.id,
        toEmail: cp.email,
        subject,
        body,
        html: null,
        status: "SENDING",
      },
    });
    const result = await sender.send({
      to: cp.email,
      subject,
      body,
      html,
      trackingId: draft.id,
    });
    await prisma.emailMessage.update({
      where: { id: draft.id },
      data: {
        status: result.ok ? "SENT" : "FAILED",
        providerMessageId: result.ok ? result.messageId : null,
        errorMessage: !result.ok ? result.error : null,
        sentAt: result.ok ? new Date() : null,
      },
    });
    return result.ok;
  }

  return false;
}
