import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { createReminderRule } from "@/lib/actions/reminders";
import type { ReminderKind } from "@prisma/client";

const KIND_OPTIONS: { value: ReminderKind; label: string; description: string }[] = [
  {
    value: "CAMPAIGN_FOLLOWUP",
    label: "Campaign Follow-up",
    description: "Remind campaign members who opened the form but haven't submitted.",
  },
  {
    value: "VERIFICATION_STUCK",
    label: "Verification Stuck",
    description: "Follow up with providers stuck in PROFILED or PENDING_VERIFICATION.",
  },
  {
    value: "PROVIDER_INACTIVE",
    label: "Provider Inactive",
    description: "Re-engage ACTIVE providers who haven't been contacted recently.",
  },
  {
    value: "CUSTOM",
    label: "Custom",
    description: "Filter by provider status + delay. Full control.",
  },
];

export default async function NewReminderPage() {
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

  async function create(formData: FormData) {
    "use server";
    const kind = formData.get("kind") as ReminderKind;
    const targetStatuses = formData.getAll("targetStatuses").map(String).filter(Boolean);
    const rule = await createReminderRule({
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? "") || undefined,
      kind,
      campaignId: String(formData.get("campaignId") ?? "") || undefined,
      messageTemplateId: String(formData.get("messageTemplateId") ?? "") || undefined,
      delayHours: Number(formData.get("delayHours") ?? 24),
      cooldownHours: Number(formData.get("cooldownHours") ?? 72),
      maxSendsPerProvider: Number(formData.get("maxSendsPerProvider") ?? 3),
      targetStatuses: targetStatuses.length > 0 ? targetStatuses : undefined,
      active: formData.get("active") === "on",
    });
    redirect(`/admin/reminders/${rule.id}`);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">New Reminder Rule</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Configure when and how to follow up with care providers.
        </p>
      </div>

      <form action={create} className="space-y-6">
        {/* Basic info */}
        <section className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4">
          <h2 className="font-semibold text-zinc-800">Basic Info</h2>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">
              Rule Name <span className="text-red-500">*</span>
            </label>
            <input
              name="name"
              type="text"
              required
              placeholder="e.g. Nurse April Campaign — 24h follow-up"
              className="w-full px-3 py-2.5 rounded-lg border border-zinc-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">
              Description
            </label>
            <textarea
              name="description"
              rows={2}
              placeholder="Optional internal note"
              className="w-full px-3 py-2.5 rounded-lg border border-zinc-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">
              Kind <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {KIND_OPTIONS.map((k) => (
                <label
                  key={k.value}
                  className="flex items-start gap-3 p-3 rounded-lg border border-zinc-200 cursor-pointer has-[:checked]:border-zinc-900 has-[:checked]:bg-zinc-50"
                >
                  <input
                    type="radio"
                    name="kind"
                    value={k.value}
                    required
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-sm font-medium text-zinc-900">
                      {k.label}
                    </div>
                    <div className="text-xs text-zinc-500">{k.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </section>

        {/* Targeting */}
        <section className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4">
          <h2 className="font-semibold text-zinc-800">Targeting</h2>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">
              Campaign{" "}
              <span className="text-zinc-400 font-normal">
                (required for Campaign Follow-up)
              </span>
            </label>
            <select
              name="campaignId"
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
              Target Statuses{" "}
              <span className="text-zinc-400 font-normal">
                (leave blank to use defaults for the kind)
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                "PENDING",
                "SENT",
                "ENGAGED",
                "PROFILED",
                "PENDING_VERIFICATION",
                "ACTIVE",
                "LEAD",
              ].map((s) => (
                <label
                  key={s}
                  className="px-2.5 py-1 rounded-full border border-zinc-300 bg-white text-xs cursor-pointer has-[:checked]:bg-zinc-900 has-[:checked]:text-white has-[:checked]:border-zinc-900"
                >
                  <input
                    type="checkbox"
                    name="targetStatuses"
                    value={s}
                    className="sr-only"
                  />
                  {s}
                </label>
              ))}
            </div>
          </div>
        </section>

        {/* Timing */}
        <section className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4">
          <h2 className="font-semibold text-zinc-800">Timing &amp; Limits</h2>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                Delay (hours) <span className="text-red-500">*</span>
              </label>
              <input
                name="delayHours"
                type="number"
                min="0.5"
                step="0.5"
                defaultValue="24"
                required
                className="w-full px-3 py-2.5 rounded-lg border border-zinc-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
              <p className="text-xs text-zinc-500 mt-1">
                After trigger event
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                Cooldown (hours) <span className="text-red-500">*</span>
              </label>
              <input
                name="cooldownHours"
                type="number"
                min="1"
                step="1"
                defaultValue="72"
                required
                className="w-full px-3 py-2.5 rounded-lg border border-zinc-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
              <p className="text-xs text-zinc-500 mt-1">
                Min between re-sends
              </p>
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
                defaultValue="3"
                required
                className="w-full px-3 py-2.5 rounded-lg border border-zinc-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
              <p className="text-xs text-zinc-500 mt-1">0 = unlimited</p>
            </div>
          </div>
        </section>

        {/* Message */}
        <section className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4">
          <h2 className="font-semibold text-zinc-800">Message</h2>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">
              WhatsApp Template
            </label>
            <select
              name="messageTemplateId"
              className="w-full px-3 py-2.5 rounded-lg border border-zinc-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
            >
              <option value="">— Select a template —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.code})
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* Active toggle + submit */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" name="active" defaultChecked className="w-4 h-4 rounded" />
            <span className="text-sm text-zinc-700">Active (start firing immediately)</span>
          </label>

          <div className="flex gap-3">
            <a
              href="/admin/reminders"
              className="px-4 py-2 rounded-lg border border-zinc-300 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              Cancel
            </a>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800"
            >
              Create Rule
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
