import { prisma } from "@/lib/db";
import Link from "next/link";
import { CampaignStatus } from "@prisma/client";

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

export default async function CampaignsPage() {
  const campaigns = await prisma.campaign.findMany({
    where: { status: { not: "ARCHIVED" } },
    include: {
      profileType: { select: { label: true } },
      formTemplate: { select: { name: true } },
      _count: { select: { members: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // For each campaign, aggregate member statuses
  const stats = await prisma.campaignMember.groupBy({
    by: ["campaignId", "status"],
    _count: { _all: true },
    where: { campaignId: { in: campaigns.map((c) => c.id) } },
  });

  type StatusBuckets = Partial<Record<string, number>>;
  const buckets: Record<string, StatusBuckets> = {};
  for (const row of stats) {
    if (!buckets[row.campaignId]) buckets[row.campaignId] = {};
    buckets[row.campaignId][row.status] = row._count._all;
  }

  return (
    <div className="px-8 py-8">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Campaigns
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Upload leads, send invites, run automated reminders.
          </p>
        </div>
        <Link
          href="/admin/campaigns/new"
          className="px-4 py-2 rounded-md bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200"
        >
          + New campaign
        </Link>
      </header>

      {campaigns.length === 0 && (
        <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-10 text-center">
          <h3 className="font-medium text-zinc-900 dark:text-zinc-50 mb-1">
            No campaigns yet
          </h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4 max-w-md mx-auto">
            A campaign ties together a profile type, an onboarding form, an
            invite message template, and a list of leads. Upload a CSV and
            launch — invites go out over WhatsApp via Ultramsg.
          </p>
          <Link
            href="/admin/campaigns/new"
            className="inline-block px-4 py-2 rounded-md bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200"
          >
            Create your first campaign
          </Link>
        </div>
      )}

      {campaigns.length > 0 && (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
              <tr className="text-left">
                <th className="px-4 py-2.5 font-medium text-zinc-600 dark:text-zinc-400">
                  Name
                </th>
                <th className="px-4 py-2.5 font-medium text-zinc-600 dark:text-zinc-400">
                  Profile
                </th>
                <th className="px-4 py-2.5 font-medium text-zinc-600 dark:text-zinc-400">
                  Form
                </th>
                <th className="px-4 py-2.5 font-medium text-zinc-600 dark:text-zinc-400">
                  Status
                </th>
                <th className="px-4 py-2.5 font-medium text-zinc-600 dark:text-zinc-400">
                  Members
                </th>
                <th className="px-4 py-2.5 font-medium text-zinc-600 dark:text-zinc-400">
                  Sent
                </th>
                <th className="px-4 py-2.5 font-medium text-zinc-600 dark:text-zinc-400">
                  Submitted
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {campaigns.map((c) => {
                const b = buckets[c.id] ?? {};
                const sentLike =
                  (b.SENT ?? 0) +
                  (b.ENGAGED ?? 0) +
                  (b.SUBMITTED ?? 0) +
                  (b.COMPLETED ?? 0);
                const submitted = (b.SUBMITTED ?? 0) + (b.COMPLETED ?? 0);
                return (
                  <tr
                    key={c.id}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                  >
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/admin/campaigns/${c.id}`}
                        className="text-zinc-900 dark:text-zinc-50 hover:underline font-medium"
                      >
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-zinc-600 dark:text-zinc-400">
                      {c.profileType.label}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-600 dark:text-zinc-400">
                      {c.formTemplate?.name ?? "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`text-xs uppercase tracking-wide px-1.5 py-0.5 rounded ${STATUS_COLORS[c.status] ?? ""}`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-zinc-700 dark:text-zinc-300">
                      {c._count.members}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-700 dark:text-zinc-300">
                      {sentLike}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-700 dark:text-zinc-300">
                      {submitted}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
