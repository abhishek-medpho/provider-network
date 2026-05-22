import { prisma } from "@/lib/db";
import Link from "next/link";
import { toggleReminderRule } from "@/lib/actions/reminders";
import type { ReminderKind } from "@prisma/client";

const KIND_META: Record<ReminderKind, { label: string; color: string }> = {
  CAMPAIGN_FOLLOWUP: {
    label: "Campaign Follow-up",
    color: "bg-blue-50 text-blue-700",
  },
  VERIFICATION_STUCK: {
    label: "Verification Stuck",
    color: "bg-amber-50 text-amber-700",
  },
  PROVIDER_INACTIVE: {
    label: "Provider Inactive",
    color: "bg-rose-50 text-rose-700",
  },
  APPOINTMENT_PRE: {
    label: "Appointment Pre",
    color: "bg-purple-50 text-purple-700",
  },
  APPOINTMENT_PENDING: {
    label: "Appointment Pending",
    color: "bg-indigo-50 text-indigo-700",
  },
  APPOINTMENT_POST: {
    label: "Appointment Post",
    color: "bg-teal-50 text-teal-700",
  },
  DOCUMENT_EXPIRY: {
    label: "Document Expiry",
    color: "bg-orange-50 text-orange-700",
  },
  CUSTOM: {
    label: "Custom",
    color: "bg-zinc-100 text-zinc-600",
  },
};

export default async function RemindersPage() {
  const rules = await prisma.reminderRule.findMany({
    include: {
      messageTemplate: { select: { name: true } },
      campaign: { select: { name: true } },
      _count: { select: { logs: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Aggregate sent counts per rule
  const sentCounts = await prisma.reminderLog.groupBy({
    by: ["reminderRuleId", "status"],
    _count: { _all: true },
  });
  const sentMap: Record<string, Record<string, number>> = {};
  for (const row of sentCounts) {
    sentMap[row.reminderRuleId] ??= {};
    sentMap[row.reminderRuleId][row.status] = row._count._all;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Reminder Rules</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Automated follow-up triggers. The runner evaluates active rules on
            each scheduled tick.
          </p>
        </div>
        <Link
          href="/admin/reminders/new"
          className="px-4 py-2 rounded-lg bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800"
        >
          + New Rule
        </Link>
      </div>

      {/* Table */}
      {rules.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 py-16 text-center">
          <p className="text-zinc-500 text-sm">No reminder rules yet.</p>
          <Link
            href="/admin/reminders/new"
            className="mt-3 inline-block text-sm font-medium text-zinc-900 underline"
          >
            Create the first rule →
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-zinc-600">
                  Name
                </th>
                <th className="px-4 py-3 text-left font-medium text-zinc-600">
                  Kind
                </th>
                <th className="px-4 py-3 text-left font-medium text-zinc-600">
                  Campaign
                </th>
                <th className="px-4 py-3 text-left font-medium text-zinc-600">
                  Delay
                </th>
                <th className="px-4 py-3 text-left font-medium text-zinc-600">
                  Cooldown
                </th>
                <th className="px-4 py-3 text-left font-medium text-zinc-600">
                  Cap
                </th>
                <th className="px-4 py-3 text-left font-medium text-zinc-600">
                  Sent
                </th>
                <th className="px-4 py-3 text-left font-medium text-zinc-600">
                  Status
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white">
              {rules.map((rule) => {
                const meta = KIND_META[rule.kind];
                const counts = sentMap[rule.id] ?? {};
                const sent = counts["SENT"] ?? 0;
                const failed = counts["FAILED"] ?? 0;
                const suppressed = counts["SUPPRESSED"] ?? 0;
                return (
                  <tr key={rule.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-3 font-medium text-zinc-900">
                      <Link
                        href={`/admin/reminders/${rule.id}`}
                        className="hover:underline"
                      >
                        {rule.name}
                      </Link>
                      {rule.description && (
                        <div className="text-xs text-zinc-500 mt-0.5 truncate max-w-xs">
                          {rule.description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${meta.color}`}
                      >
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {rule.campaign?.name ?? (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 tabular-nums">
                      {rule.delayHours}h
                    </td>
                    <td className="px-4 py-3 text-zinc-600 tabular-nums">
                      {rule.cooldownHours}h
                    </td>
                    <td className="px-4 py-3 text-zinc-600 tabular-nums">
                      {rule.maxSendsPerProvider === 0
                        ? "∞"
                        : rule.maxSendsPerProvider}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 text-xs tabular-nums">
                        {sent > 0 && (
                          <span className="text-emerald-700">{sent} sent</span>
                        )}
                        {failed > 0 && (
                          <span className="text-red-600">{failed} failed</span>
                        )}
                        {suppressed > 0 && (
                          <span className="text-zinc-400">
                            {suppressed} skipped
                          </span>
                        )}
                        {sent === 0 && failed === 0 && suppressed === 0 && (
                          <span className="text-zinc-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <form
                        action={async () => {
                          "use server";
                          await toggleReminderRule(rule.id, !rule.active);
                        }}
                      >
                        <button
                          type="submit"
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer ${
                            rule.active
                              ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${rule.active ? "bg-emerald-500" : "bg-zinc-400"}`}
                          />
                          {rule.active ? "Active" : "Paused"}
                        </button>
                      </form>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/reminders/${rule.id}`}
                        className="text-zinc-500 hover:text-zinc-900 text-xs"
                      >
                        Edit →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Runner info */}
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-5 py-4 text-sm text-zinc-600">
        <p className="font-medium text-zinc-800 mb-1">How the runner works</p>
        <ul className="list-disc list-inside space-y-1 text-xs text-zinc-500">
          <li>
            Rules are evaluated by the scheduler (cron or API route). Active
            rules fire when their audience conditions are met.
          </li>
          <li>
            Each rule checks per-provider cooldown and send-cap before
            dispatching a WhatsApp message.
          </li>
          <li>
            Every attempt is logged in ReminderLog — SENT, FAILED, or
            SUPPRESSED.
          </li>
          <li>
            Call <code className="font-mono bg-white px-1 rounded">POST /api/cron/reminders</code> from your
            scheduler (e.g. every 30 min) to trigger a run.
          </li>
        </ul>
      </div>
    </div>
  );
}
