import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  updateCampaignSettings,
  uploadLeads,
  launchCampaign,
  pauseCampaign,
  resumeCampaign,
  archiveCampaign,
  runReminders,
} from "@/lib/actions/campaigns";
import UploadLeads from "../_components/UploadResult";
import { LaunchButton, RemindersButton } from "../_components/LaunchButtons";
import RemindersEditor from "../_components/RemindersEditor";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400",
  RUNNING:
    "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400",
  PAUSED:
    "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400",
  COMPLETED: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400",
  ARCHIVED:
    "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400",
};

const MEMBER_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400",
  SENT: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400",
  ENGAGED: "bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400",
  SUBMITTED:
    "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400",
  COMPLETED:
    "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400",
  OPTED_OUT: "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400",
  FAILED: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400",
};

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [campaign, profileTypes, forms, templates] = await Promise.all([
    prisma.campaign.findUnique({
      where: { id },
      include: {
        profileType: { select: { label: true, code: true } },
        formTemplate: { select: { id: true, name: true, status: true } },
        inviteMessageTemplate: { select: { id: true, name: true, code: true } },
        leadBatch: { select: { name: true, rowCount: true, source: true } },
        _count: { select: { members: true, whatsappMessages: true } },
      },
    }),
    prisma.profileType.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, label: true },
    }),
    prisma.formTemplate.findMany({
      where: { status: { not: "ARCHIVED" }, purpose: "ONBOARDING" },
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true },
    }),
    prisma.messageTemplate.findMany({
      where: { active: true, channel: "WHATSAPP" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true, kind: true },
    }),
  ]);

  if (!campaign) notFound();

  // Member stats
  const statsRaw = await prisma.campaignMember.groupBy({
    by: ["status"],
    _count: { _all: true },
    where: { campaignId: id },
  });
  const stats: Record<string, number> = {};
  for (const r of statsRaw) stats[r.status] = r._count._all;

  const members = await prisma.campaignMember.findMany({
    where: { campaignId: id },
    include: {
      careProvider: {
        select: { id: true, name: true, phone: true, status: true },
      },
    },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    take: 200,
  });

  const reminderRules =
    (campaign.reminderRules as Array<{
      triggerAfterHours: number;
      messageTemplateId: string;
      maxSends: number;
    }> | null) ?? [];

  const inviteTemplates = templates.filter(
    (t) => t.kind === "INVITE" || t.kind === "CUSTOM",
  );

  async function settingsAction(formData: FormData) {
    "use server";
    await updateCampaignSettings(id, formData);
  }
  async function uploadAction(formData: FormData) {
    "use server";
    return await uploadLeads(id, formData);
  }
  async function launchAction() {
    "use server";
    return await launchCampaign(id);
  }
  async function remindersAction() {
    "use server";
    return await runReminders(id);
  }
  async function pauseAction() {
    "use server";
    await pauseCampaign(id);
  }
  async function resumeAction() {
    "use server";
    await resumeCampaign(id);
  }
  async function archiveAction() {
    "use server";
    await archiveCampaign(id);
  }

  const canLaunch = !!campaign.inviteMessageTemplateId && !!campaign.formTemplateId;
  const pendingMembers = stats.PENDING ?? 0;

  return (
    <div className="px-8 py-8 max-w-5xl">
      <Link
        href="/admin/campaigns"
        className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 mb-4 inline-block"
      >
        ← All campaigns
      </Link>

      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              {campaign.name}
            </h1>
            <span
              className={`text-xs uppercase tracking-wide px-1.5 py-0.5 rounded ${STATUS_COLORS[campaign.status]}`}
            >
              {campaign.status}
            </span>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {campaign.profileType.label}
            {campaign.formTemplate ? ` · form: ${campaign.formTemplate.name}` : ""}
            {campaign.inviteMessageTemplate
              ? ` · invite: ${campaign.inviteMessageTemplate.name}`
              : ""}
          </p>
        </div>
      </header>

      {/* Funnel */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
        <Stat label="Members" value={campaign._count.members} />
        <Stat label="Pending" value={stats.PENDING ?? 0} />
        <Stat label="Sent" value={stats.SENT ?? 0} />
        <Stat label="Engaged" value={stats.ENGAGED ?? 0} />
        <Stat label="Submitted" value={stats.SUBMITTED ?? 0} />
        <Stat label="Messages" value={campaign._count.whatsappMessages} />
      </section>

      {/* Upload */}
      <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 mb-6">
        <h2 className="font-medium text-zinc-900 dark:text-zinc-50 mb-3">
          Upload leads
        </h2>
        <UploadLeads action={uploadAction} />
      </section>

      {/* Launch & reminders */}
      <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 mb-6 space-y-4">
        <h2 className="font-medium text-zinc-900 dark:text-zinc-50">
          Run campaign
        </h2>

        {!canLaunch && (
          <div className="rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 px-3 py-2 text-sm">
            {!campaign.formTemplateId && "Form template not set. "}
            {!campaign.inviteMessageTemplateId &&
              "Invite message template not set. "}
            Configure these in Settings below before launching.
          </div>
        )}

        {canLaunch && (
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                Send the invite WhatsApp message to all PENDING members.
                Throttled by campaign settings.
              </p>
              <LaunchButton
                action={launchAction}
                pendingMembers={pendingMembers}
              />
            </div>
            <div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                Re-evaluate reminder rules and send to members who&apos;ve gone
                cold.
              </p>
              <RemindersButton action={remindersAction} />
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
          {campaign.status === "RUNNING" && (
            <form action={pauseAction}>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                Pause
              </button>
            </form>
          )}
          {campaign.status === "PAUSED" && (
            <form action={resumeAction}>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                Resume
              </button>
            </form>
          )}
          <form action={archiveAction}>
            <button
              type="submit"
              className="px-3 py-1.5 rounded-md border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-950/40"
            >
              Archive
            </button>
          </form>
        </div>
      </section>

      {/* Members */}
      <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 mb-6 overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="font-medium text-zinc-900 dark:text-zinc-50">
            Members{members.length === 200 && " (first 200)"}
          </h2>
        </div>
        {members.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
            No leads uploaded yet. Use the form above.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
              <tr className="text-left">
                <th className="px-4 py-2 font-medium text-zinc-600 dark:text-zinc-400">
                  Name
                </th>
                <th className="px-4 py-2 font-medium text-zinc-600 dark:text-zinc-400">
                  Phone
                </th>
                <th className="px-4 py-2 font-medium text-zinc-600 dark:text-zinc-400">
                  Status
                </th>
                <th className="px-4 py-2 font-medium text-zinc-600 dark:text-zinc-400">
                  Reminders
                </th>
                <th className="px-4 py-2 font-medium text-zinc-600 dark:text-zinc-400">
                  Last sent
                </th>
                <th className="px-4 py-2 font-medium text-zinc-600 dark:text-zinc-400">
                  Form
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {members.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-2 text-zinc-900 dark:text-zinc-50">
                    {m.careProvider.name ?? "—"}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                    {m.careProvider.phone}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`text-xs uppercase tracking-wide px-1.5 py-0.5 rounded ${MEMBER_STATUS_COLORS[m.status] ?? ""}`}
                    >
                      {m.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                    {m.remindersSent}
                  </td>
                  <td className="px-4 py-2 text-xs text-zinc-500 dark:text-zinc-400">
                    {m.lastSentAt
                      ? new Date(m.lastSentAt).toLocaleString()
                      : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/onboard/${m.token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-zinc-500 dark:text-zinc-400 hover:underline"
                    >
                      Open ↗
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Settings */}
      <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
        <h2 className="font-medium text-zinc-900 dark:text-zinc-50 mb-3">
          Settings
        </h2>
        <form action={settingsAction} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Name
              </label>
              <input
                name="name"
                defaultValue={campaign.name}
                required
                className="w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Profile type
              </label>
              <select
                disabled
                defaultValue={campaign.profileTypeId}
                className="w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm cursor-not-allowed opacity-70"
              >
                {profileTypes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Locked once campaign created.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Form
              </label>
              <select
                name="formTemplateId"
                defaultValue={campaign.formTemplateId ?? ""}
                className="w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
              >
                <option value="">— None —</option>
                {forms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Invite message template
              </label>
              <select
                name="inviteMessageTemplateId"
                defaultValue={campaign.inviteMessageTemplateId ?? ""}
                className="w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
              >
                <option value="">— None —</option>
                {inviteTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 block mb-2">
              Reminder rules
            </label>
            <RemindersEditor initial={reminderRules} templates={templates} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Max sends per day
              </label>
              <input
                type="number"
                name="maxSendsPerDay"
                defaultValue={
                  (campaign.throttle as { maxSendsPerDay?: number } | null)
                    ?.maxSendsPerDay ?? 100
                }
                className="w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Max sends per provider
              </label>
              <input
                type="number"
                name="maxSendsPerProvider"
                defaultValue={
                  (campaign.throttle as { maxSendsPerProvider?: number } | null)
                    ?.maxSendsPerProvider ?? 4
                }
                className="w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            className="px-4 py-2 rounded-md bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200"
          >
            Save settings
          </button>
        </form>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
      <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      <div className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mt-0.5">
        {value}
      </div>
    </div>
  );
}
