import { prisma } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { updateReminderRule, deleteReminderRule } from "@/lib/actions/reminders";
import type { ReminderKind, ReminderSendStatus } from "@prisma/client";
import { ChevronLeft, Trash2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

const STATUS_TONE: Record<ReminderSendStatus, string> = {
  SCHEDULED: "bg-muted text-foreground/70",
  SENT: "bg-success/15 text-success",
  FAILED: "bg-destructive/15 text-destructive",
  SUPPRESSED: "bg-warning/15 text-warning",
  CANCELLED: "bg-muted text-muted-foreground",
};

const TARGET_STATUSES = [
  "PENDING",
  "SENT",
  "ENGAGED",
  "PROFILED",
  "PENDING_VERIFICATION",
  "ACTIVE",
  "LEAD",
];

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

  const countBySt: Partial<Record<ReminderSendStatus, number>> = {};
  for (const l of logs) countBySt[l.status] = (countBySt[l.status] ?? 0) + 1;

  const KIND_OPTIONS: { value: ReminderKind; label: string }[] = [
    { value: "CAMPAIGN_FOLLOWUP", label: "Campaign Follow-up" },
    { value: "VERIFICATION_STUCK", label: "Verification Stuck" },
    { value: "PROVIDER_INACTIVE", label: "Provider Inactive" },
    { value: "CUSTOM", label: "Custom" },
  ];

  return (
    <div className="p-6 md:p-8 space-y-5 max-w-4xl">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/admin/reminders">
          <ChevronLeft className="size-4" />
          All rules
        </Link>
      </Button>

      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">{rule.name}</h1>
            <Badge variant="secondary" className="text-[10px]">
              {KIND_LABELS[rule.kind]}
            </Badge>
            {rule.active ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-success">
                <span className="size-1.5 rounded-full bg-success" />
                Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                <span className="size-1.5 rounded-full bg-muted-foreground" />
                Paused
              </span>
            )}
          </div>
          {rule.description && (
            <p className="text-sm text-muted-foreground mt-1">
              {rule.description}
            </p>
          )}
        </div>
        <form action={remove}>
          <Button
            type="submit"
            variant="outline"
            size="sm"
            className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
            Delete rule
          </Button>
        </form>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(["SENT", "FAILED", "SUPPRESSED", "SCHEDULED"] as ReminderSendStatus[]).map(
          (s) => (
            <Card key={s}>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-semibold tabular-nums">
                  {countBySt[s] ?? 0}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 capitalize">
                  {s.toLowerCase()}
                </div>
              </CardContent>
            </Card>
          ),
        )}
      </div>

      {/* Edit form */}
      <form action={update} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Rule settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                required
                defaultValue={rule.name}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                rows={2}
                defaultValue={rule.description ?? ""}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="kind">Kind</Label>
                <select
                  id="kind"
                  name="kind"
                  defaultValue={rule.kind}
                  className="w-full h-9 px-3 rounded-md border bg-background text-sm"
                >
                  {KIND_OPTIONS.map((k) => (
                    <option key={k.value} value={k.value}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="campaignId">Campaign</Label>
                <select
                  id="campaignId"
                  name="campaignId"
                  defaultValue={rule.campaignId ?? ""}
                  className="w-full h-9 px-3 rounded-md border bg-background text-sm"
                >
                  <option value="">— None —</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="messageTemplateId">Message template</Label>
                <select
                  id="messageTemplateId"
                  name="messageTemplateId"
                  defaultValue={rule.messageTemplateId ?? ""}
                  className="w-full h-9 px-3 rounded-md border bg-background text-sm"
                >
                  <option value="">— None —</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="delayHours">Delay (hours)</Label>
                <Input
                  id="delayHours"
                  name="delayHours"
                  type="number"
                  min="0.5"
                  step="0.5"
                  required
                  defaultValue={rule.delayHours}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cooldownHours">Cooldown (hours)</Label>
                <Input
                  id="cooldownHours"
                  name="cooldownHours"
                  type="number"
                  min="1"
                  step="1"
                  required
                  defaultValue={rule.cooldownHours}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="maxSendsPerProvider">Max sends / provider</Label>
                <Input
                  id="maxSendsPerProvider"
                  name="maxSendsPerProvider"
                  type="number"
                  min="0"
                  step="1"
                  required
                  defaultValue={rule.maxSendsPerProvider}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Target statuses</Label>
              <div className="flex flex-wrap gap-1.5">
                {TARGET_STATUSES.map((s) => (
                  <label
                    key={s}
                    className="px-2.5 py-1 rounded-md border bg-background text-xs cursor-pointer has-[:checked]:bg-foreground has-[:checked]:text-background has-[:checked]:border-foreground transition-colors"
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
          </CardContent>
        </Card>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox name="active" id="active" defaultChecked={rule.active} />
            <span>Active</span>
          </label>
          <Button type="submit">Save changes</Button>
        </div>
      </form>

      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">
            Recent logs{" "}
            <span className="text-muted-foreground font-normal">
              (last 50)
            </span>
          </CardTitle>
        </CardHeader>
        {logs.length === 0 ? (
          <CardContent className="text-center py-10 text-sm text-muted-foreground">
            No logs yet — rule hasn&apos;t fired.
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Provider</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Sent at</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="py-2.5">
                    <Link
                      href={`/admin/care-providers/${log.careProviderId}`}
                      className="font-medium hover:underline"
                    >
                      {log.careProvider.name ?? log.careProvider.phone}
                    </Link>
                    <div className="text-xs font-mono text-muted-foreground">
                      {log.careProvider.phone}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_TONE[log.status]}`}
                    >
                      {log.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {log.reason ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {fmt(log.sentAt)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {fmt(log.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
