import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";

export default async function AdminHomePage() {
  const session = await auth();

  const [careProviderCount, profileTypeCount, attributeCount, campaignCount] =
    await Promise.all([
      prisma.careProvider.count(),
      prisma.profileType.count({ where: { active: true } }),
      prisma.attribute.count({ where: { archivedAt: null } }),
      prisma.campaign.count(),
    ]);

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Care Provider Platform
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Admin</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              {session?.user?.name ?? session?.user?.phone} ·{" "}
              <span className="text-xs font-medium uppercase tracking-wide bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                {session?.user?.role}
              </span>
            </span>
            <form action={handleSignOut}>
              <button
                type="submit"
                className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-1">
          Overview
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-8">
          Build screens for these in the next session — schema and auth are
          ready.
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Care providers" value={careProviderCount} />
          <StatCard label="Profile types" value={profileTypeCount} />
          <StatCard label="Attributes" value={attributeCount} />
          <StatCard label="Campaigns" value={campaignCount} />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <SectionCard
            title="Care Providers"
            description="List, filter, and inspect onboarded providers."
            href="/admin/care-providers"
            status="planned"
          />
          <SectionCard
            title="Attributes & Profile Types"
            description="Define what data points each role collects."
            href="/admin/profile-types"
            status="planned"
          />
          <SectionCard
            title="Forms"
            description="Preview and manage onboarding forms per role."
            href="/admin/forms"
            status="planned"
          />
          <SectionCard
            title="Messages"
            description="WhatsApp templates for invites and reminders."
            href="/admin/messages"
            status="planned"
          />
          <SectionCard
            title="Campaigns"
            description="Upload CSV, choose template, run a campaign."
            href="/admin/campaigns"
            status="planned"
          />
          <SectionCard
            title="Admin Users"
            description="Manage admin access and roles."
            href="/admin/users"
            status="planned"
          />
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
      <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
        {label}
      </div>
      <div className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mt-1">
        {value}
      </div>
    </div>
  );
}

function SectionCard({
  title,
  description,
  href,
  status,
}: {
  title: string;
  description: string;
  href: string;
  status: "planned" | "ready";
}) {
  const isPlanned = status === "planned";
  return (
    <div className="p-5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
          {title}
        </h3>
        {isPlanned && (
          <span className="text-xs uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400">
            planned
          </span>
        )}
      </div>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
        {description}
      </p>
      {!isPlanned && (
        <Link
          href={href}
          className="text-sm font-medium text-zinc-900 dark:text-zinc-50 hover:underline"
        >
          Open →
        </Link>
      )}
    </div>
  );
}
