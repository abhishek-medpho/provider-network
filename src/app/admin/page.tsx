import { prisma } from "@/lib/db";
import Link from "next/link";
import {
  Users,
  ListChecks,
  FileText,
  MessageSquare,
  Megaphone,
  Bell,
  ArrowUpRight,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function AdminHomePage() {
  const [
    careProviderCount,
    attributeCount,
    formCount,
    campaignCount,
    messageTemplateCount,
    activeCampaignCount,
    submittedToday,
    pendingReview,
    recentProviders,
    recentEvents,
  ] = await Promise.all([
    prisma.careProvider.count(),
    prisma.attribute.count({ where: { archivedAt: null } }),
    prisma.formTemplate.count({ where: { status: { not: "ARCHIVED" } } }),
    prisma.campaign.count(),
    prisma.messageTemplate.count({ where: { active: true } }),
    prisma.campaign.count({ where: { status: "RUNNING" } }),
    prisma.careProvider.count({
      where: {
        status: "PROFILED",
        updatedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.careProvider.count({ where: { status: "PENDING_VERIFICATION" } }),
    prisma.careProvider.findMany({
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        name: true,
        phone: true,
        status: true,
        updatedAt: true,
        profileType: { select: { label: true } },
      },
    }),
    prisma.careProviderEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: {
        careProvider: { select: { id: true, name: true, phone: true } },
      },
    }),
  ]);

  return (
    <div className="p-6 md:p-8 space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1>Overview</h1>
          <p className="text-sm text-muted-foreground">
            Snapshot of your provider pipeline and campaigns.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/campaigns">View campaigns</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/admin/campaigns/new">
              New campaign
              <ArrowUpRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </header>

      {/* KPI row */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Care providers"
          value={careProviderCount}
          icon={Users}
          hint={`${submittedToday} new in last 24h`}
          href="/admin/care-providers"
        />
        <KpiCard
          label="Active campaigns"
          value={activeCampaignCount}
          icon={Megaphone}
          hint={`${campaignCount} total`}
          href="/admin/campaigns"
        />
        <KpiCard
          label="Pending review"
          value={pendingReview}
          icon={Clock}
          hint="awaiting verification"
          tone={pendingReview > 0 ? "warning" : "default"}
          href="/admin/care-providers?status=PENDING_VERIFICATION"
        />
        <KpiCard
          label="Reminder rules"
          value={messageTemplateCount}
          icon={Bell}
          hint="active templates"
          href="/admin/reminders"
        />
      </div>

      {/* Two-column body */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Recent providers — span 2 */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Recent care providers</CardTitle>
              <CardDescription>Last 5 updates across all roles.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/care-providers">
                View all
                <ArrowUpRight className="size-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="px-0">
            <ul className="divide-y">
              {recentProviders.length === 0 && (
                <li className="px-6 py-8 text-center text-sm text-muted-foreground">
                  No providers yet — launch a campaign to start onboarding.
                </li>
              )}
              {recentProviders.map((cp) => (
                <li key={cp.id}>
                  <Link
                    href={`/admin/care-providers/${cp.id}`}
                    className="px-6 py-3 flex items-center gap-3 hover:bg-accent/40 transition-colors"
                  >
                    <div className="size-9 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground shrink-0">
                      {(cp.name ?? cp.phone)
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((s) => s[0]?.toUpperCase())
                        .join("")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">
                        {cp.name ?? cp.phone}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {cp.profileType?.label ?? "—"} · {cp.phone}
                      </div>
                    </div>
                    <StatusBadge status={cp.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activity</CardTitle>
            <CardDescription>Latest system events.</CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-2">
            <ul className="divide-y">
              {recentEvents.length === 0 && (
                <li className="px-6 py-8 text-center text-sm text-muted-foreground">
                  No activity yet.
                </li>
              )}
              {recentEvents.map((e) => (
                <li key={e.id} className="px-6 py-2.5 text-sm">
                  <div className="flex items-center gap-2">
                    <EventIcon type={e.type} />
                    <Link
                      href={`/admin/care-providers/${e.careProviderId}`}
                      className="font-medium hover:underline truncate flex-1"
                    >
                      {e.careProvider.name ?? e.careProvider.phone}
                    </Link>
                    <time className="text-xs text-muted-foreground">
                      {relTime(e.createdAt)}
                    </time>
                  </div>
                  <div className="text-xs text-muted-foreground pl-6">
                    {prettifyEvent(e.type)}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Quick access strip */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        <SectionTile
          title="Attributes"
          count={attributeCount}
          icon={ListChecks}
          href="/admin/attributes"
        />
        <SectionTile
          title="Forms"
          count={formCount}
          icon={FileText}
          href="/admin/forms"
        />
        <SectionTile
          title="Messages"
          count={messageTemplateCount}
          icon={MessageSquare}
          href="/admin/messages"
        />
        <SectionTile
          title="Reminders"
          count={null}
          icon={Bell}
          href="/admin/reminders"
        />
      </div>
    </div>
  );
}

// ---------- helpers ----------

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  href,
  tone = "default",
}: {
  label: string;
  value: number;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  tone?: "default" | "warning" | "success";
}) {
  const toneClass =
    tone === "warning"
      ? "text-warning"
      : tone === "success"
        ? "text-success"
        : "text-foreground";

  const inner = (
    <Card className="hover:border-foreground/20 transition-colors">
      <CardContent className="p-4 flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          <div className={`text-2xl font-semibold tabular-nums ${toneClass}`}>
            {value.toLocaleString()}
          </div>
          {hint && (
            <div className="text-xs text-muted-foreground">{hint}</div>
          )}
        </div>
        <div className="size-9 rounded-md bg-muted flex items-center justify-center text-muted-foreground">
          <Icon className="size-4" />
        </div>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function SectionTile({
  title,
  count,
  icon: Icon,
  href,
}: {
  title: string;
  count: number | null;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border bg-card hover:border-foreground/20 transition-colors px-4 py-3 flex items-center gap-3"
    >
      <div className="size-8 rounded-md bg-muted flex items-center justify-center text-muted-foreground">
        <Icon className="size-4" />
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium">{title}</div>
        {count !== null && (
          <div className="text-xs text-muted-foreground">
            {count.toLocaleString()} item{count === 1 ? "" : "s"}
          </div>
        )}
      </div>
      <ArrowUpRight className="size-3.5 text-muted-foreground" />
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant = (() => {
    if (["VERIFIED", "ACTIVE"].includes(status)) return "default";
    if (["PROFILED", "PENDING_VERIFICATION"].includes(status))
      return "secondary";
    if (["REJECTED", "BLOCKED"].includes(status)) return "destructive";
    return "outline";
  })();
  return (
    <Badge variant={variant} className="text-[10px] font-medium">
      {status}
    </Badge>
  );
}

function EventIcon({ type }: { type: string }) {
  if (type === "FORM_SUBMITTED")
    return <CheckCircle2 className="size-3.5 text-success shrink-0" />;
  if (type === "REMINDER_SENT")
    return <Bell className="size-3.5 text-muted-foreground shrink-0" />;
  if (type.includes("REJECT") || type.includes("FAIL"))
    return <XCircle className="size-3.5 text-destructive shrink-0" />;
  return <Clock className="size-3.5 text-muted-foreground shrink-0" />;
}

function prettifyEvent(type: string): string {
  return type
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function relTime(d: Date): string {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}
