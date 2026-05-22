import { prisma } from "@/lib/db";
import Link from "next/link";
import { toggleReminderRule } from "@/lib/actions/reminders";
import type { ReminderKind } from "@prisma/client";
import { Plus, Bell, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

export default async function RemindersPage() {
  const rules = await prisma.reminderRule.findMany({
    include: {
      messageTemplate: { select: { name: true } },
      campaign: { select: { name: true } },
      _count: { select: { logs: true } },
    },
    orderBy: { createdAt: "desc" },
  });

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
    <div className="p-6 md:p-8 space-y-5">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1>Reminder Rules</h1>
          <p className="text-sm text-muted-foreground">
            Automated follow-up triggers. The runner evaluates active rules on
            each scheduled tick.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/reminders/new">
            <Plus className="size-4" />
            New rule
          </Link>
        </Button>
      </header>

      {rules.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Bell className="size-8 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              No reminder rules yet.
            </p>
            <Button variant="link" asChild className="mt-2">
              <Link href="/admin/reminders/new">Create the first rule →</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Name</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead className="text-right">Delay</TableHead>
                <TableHead className="text-right">Cooldown</TableHead>
                <TableHead className="text-right">Cap</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => {
                const counts = sentMap[rule.id] ?? {};
                const sent = counts["SENT"] ?? 0;
                const failed = counts["FAILED"] ?? 0;
                const suppressed = counts["SUPPRESSED"] ?? 0;
                return (
                  <TableRow key={rule.id}>
                    <TableCell className="py-2.5">
                      <Link
                        href={`/admin/reminders/${rule.id}`}
                        className="font-medium hover:underline"
                      >
                        {rule.name}
                      </Link>
                      {rule.description && (
                        <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">
                          {rule.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className="text-[10px] font-medium"
                      >
                        {KIND_LABELS[rule.kind]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {rule.campaign?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                      {rule.delayHours}h
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                      {rule.cooldownHours}h
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                      {rule.maxSendsPerProvider === 0
                        ? "∞"
                        : rule.maxSendsPerProvider}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5 text-xs tabular-nums">
                        {sent > 0 && (
                          <span className="text-success">{sent} sent</span>
                        )}
                        {failed > 0 && (
                          <span className="text-destructive">
                            {failed} failed
                          </span>
                        )}
                        {suppressed > 0 && (
                          <span className="text-muted-foreground">
                            {suppressed} skipped
                          </span>
                        )}
                        {sent === 0 && failed === 0 && suppressed === 0 && (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <form
                        action={async () => {
                          "use server";
                          await toggleReminderRule(rule.id, !rule.active);
                        }}
                      >
                        <button
                          type="submit"
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                            rule.active
                              ? "bg-success/15 text-success hover:bg-success/25"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                        >
                          <span
                            className={`size-1.5 rounded-full ${
                              rule.active ? "bg-success" : "bg-muted-foreground"
                            }`}
                          />
                          {rule.active ? "Active" : "Paused"}
                        </button>
                      </form>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/admin/reminders/${rule.id}`}>
                          Edit
                          <ArrowRight className="size-3.5" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <Card className="bg-muted/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">How the runner works</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-1.5">
          <p>
            • Rules are evaluated by the scheduler (cron or API route). Active
            rules fire when their audience conditions are met.
          </p>
          <p>
            • Each rule checks per-provider cooldown and send-cap before
            dispatching a WhatsApp message.
          </p>
          <p>
            • Every attempt is logged in <code className="font-mono text-foreground/80">ReminderLog</code> — SENT, FAILED, or SUPPRESSED.
          </p>
          <p>
            • Call <code className="font-mono bg-background border rounded px-1 py-px text-foreground/80">POST /api/cron/reminders</code> from your scheduler (e.g. every 30 min) to trigger a run.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
