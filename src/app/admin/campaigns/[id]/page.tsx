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
import Analytics from "../_components/Analytics";
import { getCampaignAnalytics } from "@/lib/analytics/campaign";
import {
  ChevronLeft,
  Upload,
  Play,
  Bell,
  Pause,
  Archive,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
        inviteMessageTemplate: {
          select: { id: true, name: true, code: true },
        },
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

  const analytics = await getCampaignAnalytics(id);

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

  const canLaunch =
    !!campaign.inviteMessageTemplateId && !!campaign.formTemplateId;
  const pendingMembers = stats.PENDING ?? 0;

  return (
    <div className="p-6 md:p-8 space-y-5 max-w-6xl">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/admin/campaigns">
          <ChevronLeft className="size-4" />
          All campaigns
        </Link>
      </Button>

      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">
              {campaign.name}
            </h1>
            <CampaignStatusBadge status={campaign.status} />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {campaign.profileType.label}
            {campaign.formTemplate &&
              ` · form: ${campaign.formTemplate.name}`}
            {campaign.inviteMessageTemplate &&
              ` · invite: ${campaign.inviteMessageTemplate.name}`}
          </p>
        </div>
      </header>

      <Analytics data={analytics} />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Upload className="size-4" />
            Upload leads
          </CardTitle>
        </CardHeader>
        <CardContent>
          <UploadLeads action={uploadAction} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Run campaign</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!canLaunch && (
            <Alert>
              <AlertTriangle className="size-4" />
              <AlertDescription>
                {!campaign.formTemplateId && "Form template not set. "}
                {!campaign.inviteMessageTemplateId &&
                  "Invite message template not set. "}
                Configure these in Settings below before launching.
              </AlertDescription>
            </Alert>
          )}

          {canLaunch && (
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Play className="size-4" />
                  Send invites
                </div>
                <p className="text-xs text-muted-foreground">
                  Send the invite WhatsApp message to all PENDING members.
                  Throttled by campaign settings.
                </p>
                <LaunchButton
                  action={launchAction}
                  pendingMembers={pendingMembers}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Bell className="size-4" />
                  Run reminders
                </div>
                <p className="text-xs text-muted-foreground">
                  Re-evaluate reminder rules and send to members who&apos;ve
                  gone cold.
                </p>
                <RemindersButton action={remindersAction} />
              </div>
            </div>
          )}

          <Separator />

          <div className="flex gap-2 flex-wrap">
            {campaign.status === "RUNNING" && (
              <form action={pauseAction}>
                <Button type="submit" variant="outline" size="sm">
                  <Pause className="size-3.5" />
                  Pause
                </Button>
              </form>
            )}
            {campaign.status === "PAUSED" && (
              <form action={resumeAction}>
                <Button type="submit" variant="outline" size="sm">
                  <Play className="size-3.5" />
                  Resume
                </Button>
              </form>
            )}
            <form action={archiveAction}>
              <Button
                type="submit"
                variant="outline"
                size="sm"
                className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
              >
                <Archive className="size-3.5" />
                Archive
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">
            Members
            {members.length === 200 && (
              <span className="text-muted-foreground font-normal ml-1">
                (first 200)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        {members.length === 0 ? (
          <CardContent className="text-center py-10 text-sm text-muted-foreground">
            No leads uploaded yet. Use the form above.
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Reminders</TableHead>
                <TableHead>Last sent</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="py-2.5">
                    <Link
                      href={`/admin/care-providers/${m.careProvider.id}`}
                      className="font-medium hover:underline"
                    >
                      {m.careProvider.name ?? (
                        <span className="text-muted-foreground italic">
                          —
                        </span>
                      )}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {m.careProvider.phone}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className="text-[10px]"
                    >
                      {m.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                    {m.remindersSent}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {m.lastSentAt
                      ? relTime(m.lastSentAt)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <a
                      href={`/onboard/${m.token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
                    >
                      Form
                      <ExternalLink className="size-3" />
                    </a>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={settingsAction} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={campaign.name}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="profileTypeId">Profile type</Label>
                <select
                  id="profileTypeId"
                  disabled
                  defaultValue={campaign.profileTypeId}
                  className="w-full h-9 px-3 rounded-md border bg-muted text-sm cursor-not-allowed opacity-70"
                >
                  {profileTypes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Locked once campaign created.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="formTemplateId">Form</Label>
                <select
                  id="formTemplateId"
                  name="formTemplateId"
                  defaultValue={campaign.formTemplateId ?? ""}
                  className="w-full h-9 px-3 rounded-md border bg-background text-sm"
                >
                  <option value="">— None —</option>
                  {forms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inviteMessageTemplateId">
                  Invite message template
                </Label>
                <select
                  id="inviteMessageTemplateId"
                  name="inviteMessageTemplateId"
                  defaultValue={campaign.inviteMessageTemplateId ?? ""}
                  className="w-full h-9 px-3 rounded-md border bg-background text-sm"
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

            <div className="space-y-1.5">
              <Label>Reminder rules</Label>
              <RemindersEditor initial={reminderRules} templates={templates} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="maxSendsPerDay">Max sends per day</Label>
                <Input
                  id="maxSendsPerDay"
                  type="number"
                  name="maxSendsPerDay"
                  defaultValue={
                    (campaign.throttle as { maxSendsPerDay?: number } | null)
                      ?.maxSendsPerDay ?? 100
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="maxSendsPerProvider">
                  Max sends per provider
                </Label>
                <Input
                  id="maxSendsPerProvider"
                  type="number"
                  name="maxSendsPerProvider"
                  defaultValue={
                    (
                      campaign.throttle as {
                        maxSendsPerProvider?: number;
                      } | null
                    )?.maxSendsPerProvider ?? 4
                  }
                />
              </div>
            </div>

            <Button type="submit">Save settings</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function CampaignStatusBadge({ status }: { status: string }) {
  if (status === "RUNNING")
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-success">
        <span className="size-1.5 rounded-full bg-success animate-pulse" />
        Running
      </span>
    );
  const variant =
    status === "COMPLETED"
      ? "secondary"
      : status === "PAUSED"
        ? "outline"
        : "outline";
  return (
    <Badge variant={variant} className="text-[10px] uppercase tracking-wide">
      {status}
    </Badge>
  );
}

function relTime(d: Date): string {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(d).toLocaleDateString();
}
