import { prisma } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { updateReminderRule, deleteReminderRule } from "@/lib/actions/reminders";
import type { ReminderKind, ReminderSendStatus } from "@prisma/client";

const KIND_LABELS: Record<ReminderKind, string> = {
  CAMPAIGN_FOLLOWUP: "Campaign Follow-up",
  VERIFICATION_STUCK: "Verification Stuck",
  PROVIDER_INACTIVE: "Provider Inactive",
  APPOINTMENT_PRE: "Appointment Pre",
  APPOINTMENT_PENDING: "Appointment Pending",
  APPOINTMENT_POST: "Appointment Post",
  DOCUMENT_EXPIRY: "Document Expiry",
  CUSTOM: "Custom",
};

const STATUS_COLORS: Record<ReminderSendStatus, string> = {
  SCHEDULED: "bg-zinc-100 text-zinc-600",
  SENT: "bg-emerald-50 text-emerald-700",
  FAILED: "bg-red-50 text-red-700",
  SUPPRESSED: "bg-amber-50 text-amber-600",
  CANCELLED: "bg-zinc-100 text-zinc-500",
};

function fmt(d: Date | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(d));
}

export default async function ReminderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const rule = await prisma.reminderRule.findUnique({
    where: { id },
    include: {
      messageTemplate: { select: { id: true, name: true, code: true } },
      campaign: { select: { id: true, name: true } },
    },
  });
  if (!rule) notFound();

  const logs = await prisma.reminderLog.findMany({
    where: { reminderRuleId: id },
    include: {
      careProvider: { select: { id: true, name: true, phone: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const [campaigns, templates] = await Promise.all([
    prisma.campaign.findMany({
      where: { status: { in: ["RUNNING", "DRAFT"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.messageTemplate.findMany({
      where: { active: true, channel: "WHATSAPP" },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const targetStatuses = Array.isArray(rule.targetStatuses)
    ? (rule.targetStatuses as string[])
    : [];

  async function update(formData: FormData) {
    "use server";
    const tsRaw = formData.getAll("targetStatuses").map(String).filter(Boolean);
    await updateReminderRule(id, {
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? "") || undefined,
      kind: formData.get("kind") as ReminderKind,
      campaignId: String(formData.get("campaignId") ?? "") || undefined,
      messageTemplateId:
        String(formData.get("messageTemplateId") ?? "") || undefined,
      delayHours: Number(formData.get("delayHours") ?? 24),
      cooldownHours: Number(formData.get("cooldownHours") ?? 72),
      maxSendsPerProvider: Number(formData.get("maxSendsPerProvider") ?? 3),
      targetStatuses: tsRaw.length > 0 ? tsRaw : [],
      active: formData.get("active") === "on",
    });
    redirect(`/admin/reminders/${id}`);
  }

  async function remove() {
    "use server";
    await deleteReminderRule(id);
    redirect("/admin/reminders");
  }

  // Log counts
  const countBySt: Partial<Record<ReminderSendStatus, number>> = {};
  for (const l of logs) countBySt[l.status] = (countBySt[l.status] ?? 0) + 1;

  const KIND_OPTIONS: { value: ReminderKind; label: string }[] = [
    { value: "CAMPAIGN_FOLLOWUP", label: "Campaign Follow-up" },
    { value: "VERIFICATION_STUCK", label: "Verification Stuck" },
    { value: "PROVIDER_INACTIVE", label: "Provider Inactive" },
    { value: "CUSTOM", label: "Custom" },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <a href="/admin/reminders" className="text-zinc-400 hover:text-zinc-700 text-sm">
              ← Rules
            </a>
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 mt-1">{rule.name}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">
              {KIND_LABELS[rule.kind]}
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                rule.active
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-zinc-100 text-zinc-500"
              }`}
            >
              {rule.active ? "Active" : "Paused"}
            </span>
          </div>
        </div>
        <form action={remove}>
          <button
            type="submit"
            className="text-xs text-red-600 hover:text-red-800 hover:underline"
            onClick={(e) => {
              if (!confirm("Delete this rule and all its logs?")) e.preventDefault();
            }}
          >
            Delete rule
          </button>
        </form>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {(["SENT", "FAILED", "SUPPRESSED", "SCHEDULED"] as ReminderSendStatus[]).map((s) => (
          <div key={s} className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-center">
            <div className="text-2xl font-bold text-zinc-900 tabular-nums">
              {countBySt[s] ?? 0}
            </div>
            <div className="text-xs text-zinc-500 mt-0.5 capitalize">
              {s.toLowerCase()}
            </div>
          </div>
        ))}
      </div>

      {/* Edit form */}
      <form action={update} className="space-y-5">
        <section className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4">
          <h2 className="font-semibold text-zinc-800">Rule Settings</h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                Name
              </label>
              <input
                name="name"
                type="text"
                required
                defaultValue={rule.name}
                className="w-full px-3 py-2.5 rounded-lg border border-zinc-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                Description
              </label>
              <textarea
                name="description"
                rows={2}
                defaultValue={rule.description ?? ""}
                className="w-full px-3 py-2.5 rounded-lg border border-zinc-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                Kind
              </label>
              <select
                name="kind"
                defaultValue={rule.kind}
                className="w-full px-3 py-2.5 rounded-lg border border-zinc-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
              >
                {KIND_OPTIONS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                Campaign
              </label>
              <select
                name="campaignId"
                defaultValue={rule.campaignId ?? ""}
                className="w-full px-3 py-2.5 rounded-lg border border-zinc-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
              >
                <option value="">— None —</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                Message Template
              </label>
              <select
                name="messageTemplateId"
                defaultValue={rule.messageTemplateId ?? ""}
                className="w-full px-3 py-2.5 rounded-lg border border-zinc-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
              >
                <option value="">— None —</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                Delay (hours)
              </label>
              <input
                name="delayHours"
                type="number"
                min="0.5"
                step="0.5"
                required
                defaultValue={rule.delayHours}
                className="w-full px-3 py-2.5 rounded-lg border border-zinc-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                Cooldown (hours)
              </label>
              <input
                name="cooldownHours"
                type="number"
                min="1"
                step="1"
                required
                defaultValue={rule.cooldownHours}
                className="w-full px-3 py-2.5 rounded-lg border border-zinc-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                Max sends / provider
              </label>
              <input
                name="maxSendsPerProvider"
                type="number"
                min="0"
                step="1"
                required
                defaultValue={rule.maxSendsPerProvider}
                className="w-full px-3 py-2.5 rounded-lg border border-zinc-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>
          </div>

          {/* Target statuses */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">
              Target Statuses
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                "PENDING", "SENT", "ENGAGED", "PROFILED",
                "PENDING_VERIFICATION", "ACTIVE", "LEAD",
              ].map((s) => (
                <label
                  key={s}
                  className="px-2.5 py-1 rounded-full border border-zinc-300 bg-white text-xs cursor-pointer has-[:checked]:bg-zinc-900 has-[:checked]:text-white has-[:checked]:border-zinc-900"
                >
                  <input
                    type="checkbox"
                    name="targetStatuses"
                    value={s}
                    defaultChecked={targetStatuses.includes(s)}
                    className="sr-only"
                  />
                  {s}
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="active"
                defaultChecked={rule.active}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm text-zinc-700">Active</span>
            </label>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800"
            >
              Save Changes
            </button>
          </div>
        </section>
      </form>

      {/* Recent logs */}
      <section className="rounded-xl border border-zinc-200 bg-white">
        <div className="px-5 py-4 border-b border-zinc-100">
          <h2 className="font-semibold text-zinc-800">
            Recent Logs{" "}
            <span className="text-zinc-400 font-normal text-sm">(last 50)</span>
          </h2>
        </div>
        {logs.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-zinc-400">
            No logs yet — rule hasn&apos;t fired.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-100 text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-zinc-500 text-xs">
                    Provider
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-zinc-500 text-xs">
                    Status
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-zinc-500 text-xs">
                    Reason
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-zinc-500 text-xs">
                    Sent at
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-zinc-500 text-xs">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-2.5">
                      <a
                        href={`/admin/care-providers/${log.careProviderId}`}
                        className="text-zinc-900 hover:underline font-medium"
                      >
                        {log.careProvider.name ?? log.careProvider.phone}
                      </a>
                      <div className="text-xs text-zinc-400 font-mono">
                        {log.careProvider.phone}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[log.status]}`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-zinc-500">
                      {log.reason ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-zinc-500">
                      {fmt(log.sentAt)}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-zinc-500">
                      {fmt(log.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
