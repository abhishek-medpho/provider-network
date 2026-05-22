"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ReminderKind, ReminderSendStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { sendWhatsAppText } from "@/lib/ultramsg";

// ============================================================================
// Types
// ============================================================================

export type ReminderRuleInput = {
  name: string;
  description?: string;
  kind: ReminderKind;
  campaignId?: string;
  messageTemplateId?: string;
  delayHours?: number;
  cooldownHours?: number;
  maxSendsPerProvider?: number;
  targetStatuses?: string[];
  params?: Record<string, unknown>;
  active?: boolean;
};

// ============================================================================
// CRUD
// ============================================================================

export async function createReminderRule(input: ReminderRuleInput) {
  const rule = await prisma.reminderRule.create({
    data: {
      name: input.name,
      description: input.description ?? null,
      kind: input.kind,
      campaignId: input.campaignId ?? null,
      messageTemplateId: input.messageTemplateId ?? null,
      delayHours: input.delayHours ?? 24,
      cooldownHours: input.cooldownHours ?? 72,
      maxSendsPerProvider: input.maxSendsPerProvider ?? 3,
      targetStatuses: input.targetStatuses
        ? (input.targetStatuses as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      params: input.params
        ? (input.params as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      active: input.active ?? true,
    },
  });
  revalidatePath("/admin/reminders");
  return rule;
}

export async function updateReminderRule(id: string, input: Partial<ReminderRuleInput>) {
  const rule = await prisma.reminderRule.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.kind !== undefined && { kind: input.kind }),
      ...(input.campaignId !== undefined && { campaignId: input.campaignId }),
      ...(input.messageTemplateId !== undefined && {
        messageTemplateId: input.messageTemplateId,
      }),
      ...(input.delayHours !== undefined && { delayHours: input.delayHours }),
      ...(input.cooldownHours !== undefined && {
        cooldownHours: input.cooldownHours,
      }),
      ...(input.maxSendsPerProvider !== undefined && {
        maxSendsPerProvider: input.maxSendsPerProvider,
      }),
      ...(input.targetStatuses !== undefined && {
        targetStatuses: input.targetStatuses as Prisma.InputJsonValue,
      }),
      ...(input.params !== undefined && {
        params: input.params as Prisma.InputJsonValue,
      }),
      ...(input.active !== undefined && { active: input.active }),
    },
  });
  revalidatePath("/admin/reminders");
  revalidatePath(`/admin/reminders/${id}`);
  return rule;
}

export async function deleteReminderRule(id: string) {
  await prisma.reminderRule.delete({ where: { id } });
  revalidatePath("/admin/reminders");
}

export async function toggleReminderRule(id: string, active: boolean) {
  await prisma.reminderRule.update({ where: { id }, data: { active } });
  revalidatePath("/admin/reminders");
}

// ============================================================================
// Runner
// ============================================================================

type RunResult = {
  ruleId: string;
  ruleName: string;
  kind: ReminderKind;
  sent: number;
  suppressed: number;
  failed: number;
};

/**
 * Evaluate all active reminder rules and fire due reminders.
 * Safe to call from a cron job — idempotent via cooldown + cap checks.
 */
export async function runReminderRules(): Promise<RunResult[]> {
  const rules = await prisma.reminderRule.findMany({
    where: { active: true },
    include: { messageTemplate: true },
  });

  const results: RunResult[] = [];

  for (const rule of rules) {
    const result: RunResult = {
      ruleId: rule.id,
      ruleName: rule.name,
      kind: rule.kind,
      sent: 0,
      suppressed: 0,
      failed: 0,
    };

    try {
      const targets = await findTargets(rule);

      for (const t of targets) {
        // Check per-provider send cap
        if (rule.maxSendsPerProvider > 0) {
          const totalSent = await prisma.reminderLog.count({
            where: {
              reminderRuleId: rule.id,
              careProviderId: t.careProviderId,
              status: "SENT",
            },
          });
          if (totalSent >= rule.maxSendsPerProvider) {
            await writeLog({
              ruleId: rule.id,
              careProviderId: t.careProviderId,
              campaignMemberId: t.campaignMemberId,
              status: "SUPPRESSED",
              reason: `cap hit (${totalSent}/${rule.maxSendsPerProvider})`,
            });
            result.suppressed++;
            continue;
          }
        }

        // Check cooldown
        const cooldownMs = rule.cooldownHours * 60 * 60 * 1000;
        const lastSent = await prisma.reminderLog.findFirst({
          where: {
            reminderRuleId: rule.id,
            careProviderId: t.careProviderId,
            status: "SENT",
          },
          orderBy: { sentAt: "desc" },
          select: { sentAt: true },
        });
        if (lastSent?.sentAt) {
          const elapsed = Date.now() - lastSent.sentAt.getTime();
          if (elapsed < cooldownMs) {
            await writeLog({
              ruleId: rule.id,
              careProviderId: t.careProviderId,
              campaignMemberId: t.campaignMemberId,
              status: "SUPPRESSED",
              reason: `cooldown (${Math.round((cooldownMs - elapsed) / 3600000)}h remaining)`,
            });
            result.suppressed++;
            continue;
          }
        }

        // Build message body
        const body = buildBody(rule.messageTemplate?.body, t);
        if (!body) {
          await writeLog({
            ruleId: rule.id,
            careProviderId: t.careProviderId,
            campaignMemberId: t.campaignMemberId,
            status: "FAILED",
            reason: "no message template / body",
          });
          result.failed++;
          continue;
        }

        // Send
        try {
          const waMsg = await prisma.whatsAppMessage.create({
            data: {
              careProviderId: t.careProviderId,
              toPhone: t.phone,
              body,
              messageTemplateId: rule.messageTemplateId ?? null,
              status: "QUEUED",
            },
          });

          await sendWhatsAppText(t.phone, body);

          await prisma.whatsAppMessage.update({
            where: { id: waMsg.id },
            data: { status: "SENT", sentAt: new Date() },
          });

          const log = await prisma.reminderLog.create({
            data: {
              reminderRuleId: rule.id,
              careProviderId: t.careProviderId,
              campaignMemberId: t.campaignMemberId ?? null,
              status: "SENT",
              scheduledFor: new Date(),
              sentAt: new Date(),
              whatsappMessageId: waMsg.id,
            },
          });

          // Update campaignMember.remindersSent + lastSentAt if applicable
          if (t.campaignMemberId) {
            await prisma.campaignMember.update({
              where: { id: t.campaignMemberId },
              data: {
                remindersSent: { increment: 1 },
                lastSentAt: new Date(),
              },
            });
          }

          await prisma.careProviderEvent.create({
            data: {
              careProviderId: t.careProviderId,
              type: "REMINDER_SENT",
              payload: {
                reminderRuleId: rule.id,
                ruleName: rule.name,
                kind: rule.kind,
                reminderLogId: log.id,
              } as Prisma.InputJsonValue,
            },
          });

          result.sent++;
        } catch (sendErr) {
          await writeLog({
            ruleId: rule.id,
            careProviderId: t.careProviderId,
            campaignMemberId: t.campaignMemberId,
            status: "FAILED",
            reason:
              sendErr instanceof Error ? sendErr.message : "send error",
          });
          result.failed++;
        }
      }
    } catch (ruleErr) {
      console.error(`[reminders] rule ${rule.id} (${rule.name}) errored:`, ruleErr);
    }

    results.push(result);
  }

  return results;
}

// ============================================================================
// Audience queries per kind
// ============================================================================

type Target = {
  careProviderId: string;
  phone: string;
  campaignMemberId?: string;
  formToken?: string;
};

async function findTargets(rule: {
  id: string;
  kind: ReminderKind;
  campaignId: string | null;
  delayHours: number;
  targetStatuses: Prisma.JsonValue;
}): Promise<Target[]> {
  const delayMs = rule.delayHours * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - delayMs);
  const targetStatuses = Array.isArray(rule.targetStatuses)
    ? (rule.targetStatuses as string[])
    : [];

  switch (rule.kind) {
    case "CAMPAIGN_FOLLOWUP": {
      if (!rule.campaignId) return [];
      const members = await prisma.campaignMember.findMany({
        where: {
          campaignId: rule.campaignId,
          status: {
            in: (targetStatuses.length > 0
              ? targetStatuses
              : ["SENT", "ENGAGED"]) as Prisma.EnumCampaignMemberStatusFilter["in"],
          },
          // Only members whose invite was sent before the delay cutoff
          lastSentAt: { lte: cutoff },
          careProvider: { optedOutAt: null },
        },
        include: { careProvider: true },
      });
      return members.map((m) => ({
        careProviderId: m.careProviderId,
        phone: m.careProvider.phone,
        campaignMemberId: m.id,
        formToken: m.token,
      }));
    }

    case "VERIFICATION_STUCK": {
      const statuses =
        targetStatuses.length > 0
          ? targetStatuses
          : ["PROFILED", "PENDING_VERIFICATION"];
      const providers = await prisma.careProvider.findMany({
        where: {
          status: {
            in: statuses as Prisma.EnumCareProviderStatusFilter["in"],
          },
          updatedAt: { lte: cutoff },
          optedOutAt: null,
        },
        select: { id: true, phone: true },
      });
      return providers.map((p) => ({
        careProviderId: p.id,
        phone: p.phone,
      }));
    }

    case "PROVIDER_INACTIVE": {
      const providers = await prisma.careProvider.findMany({
        where: {
          status: "ACTIVE",
          lastContactedAt: { lte: cutoff },
          optedOutAt: null,
        },
        select: { id: true, phone: true },
      });
      return providers.map((p) => ({
        careProviderId: p.id,
        phone: p.phone,
      }));
    }

    case "CUSTOM": {
      // Generic: filter by targetStatuses on CareProvider.status
      if (targetStatuses.length === 0) return [];
      const providers = await prisma.careProvider.findMany({
        where: {
          status: {
            in: targetStatuses as Prisma.EnumCareProviderStatusFilter["in"],
          },
          updatedAt: { lte: cutoff },
          optedOutAt: null,
        },
        select: { id: true, phone: true },
      });
      return providers.map((p) => ({
        careProviderId: p.id,
        phone: p.phone,
      }));
    }

    default:
      return [];
  }
}

// ============================================================================
// Helpers
// ============================================================================

function buildBody(
  template: string | null | undefined,
  target: Target & { name?: string },
): string | null {
  if (!template) return null;
  return template
    .replace(/\{\{name\}\}/g, target.name ?? "there")
    .replace(/\{\{form_url\}\}/g, target.formToken
      ? `${process.env.NEXT_PUBLIC_APP_URL}/onboard/${target.formToken}`
      : "");
}

async function writeLog(opts: {
  ruleId: string;
  careProviderId: string;
  campaignMemberId?: string;
  status: ReminderSendStatus;
  reason?: string;
}) {
  await prisma.reminderLog.create({
    data: {
      reminderRuleId: opts.ruleId,
      careProviderId: opts.careProviderId,
      campaignMemberId: opts.campaignMemberId ?? null,
      status: opts.status,
      scheduledFor: new Date(),
      reason: opts.reason ?? null,
    },
  });
}
