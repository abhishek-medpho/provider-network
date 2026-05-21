import { prisma } from "@/lib/db";
import Link from "next/link";

export default async function AdminHomePage() {
  const [careProviderCount, profileTypeCount, attributeCount, formCount, campaignCount, messageTemplateCount] =
    await Promise.all([
      prisma.careProvider.count(),
      prisma.profileType.count({ where: { active: true } }),
      prisma.attribute.count({ where: { archivedAt: null } }),
      prisma.formTemplate.count({ where: { status: { not: "ARCHIVED" } } }),
      prisma.campaign.count(),
      prisma.messageTemplate.count({ where: { active: true } }),
    ]);

  return (
    <div className="px-8 py-8">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-1">
        Overview
      </h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-8">
        Welcome back.
      </p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-8 max-w-6xl">
        <StatCard label="Care providers" value={careProviderCount} href="/admin/care-providers" />
        <StatCard label="Profile types" value={profileTypeCount} href="/admin/profile-types" />
        <StatCard label="Attributes" value={attributeCount} href="/admin/attributes" />
        <StatCard label="Forms" value={formCount} href="/admin/forms" />
        <StatCard label="Messages" value={messageTemplateCount} href="/admin/messages" />
        <StatCard label="Campaigns" value={campaignCount} href="/admin/campaigns" />
      </div>

      <div className="grid sm:grid-cols-2 gap-4 max-w-5xl">
        <SectionCard
          title="Care Providers"
          description="List, filter, and inspect onboarded providers."
          href="/admin/care-providers"
          ready={false}
        />
        <SectionCard
          title="Attributes"
          description="Define what data points each role collects."
          href="/admin/attributes"
          ready={true}
        />
        <SectionCard
          title="Profile Types"
          description="Bundle attributes into roles like Nurse, Phlebo."
          href="/admin/profile-types"
          ready={false}
        />
        <SectionCard
          title="Forms"
          description="Configurable forms per lifecycle stage (invite, confirm, execute)."
          href="/admin/forms"
          ready={true}
        />
        <SectionCard
          title="Messages"
          description="WhatsApp templates for invites and reminders."
          href="/admin/messages"
          ready={true}
        />
        <SectionCard
          title="Campaigns"
          description="Upload CSV, choose template, run a campaign."
          href="/admin/campaigns"
          ready={false}
        />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
    >
      <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
        {label}
      </div>
      <div className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mt-1">
        {value}
      </div>
    </Link>
  );
}

function SectionCard({
  title,
  description,
  href,
  ready,
}: {
  title: string;
  description: string;
  href: string;
  ready: boolean;
}) {
  return (
    <Link
      href={href}
      className="block p-5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
          {title}
        </h3>
        {!ready && (
          <span className="text-xs uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400">
            planned
          </span>
        )}
      </div>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
    </Link>
  );
}
