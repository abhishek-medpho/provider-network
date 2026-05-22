import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createReminderRule } from "@/lib/actions/reminders";
import type { ReminderKind } from "@prisma/client";
import { ChevronLeft } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

const KIND_OPTIONS: {
  value: ReminderKind;
  label: string;
  description: string;
}[] = [
  {
    value: "CAMPAIGN_FOLLOWUP",
    label: "Campaign Follow-up",
    description:
      "Remind campaign members who opened the form but haven't submitted.",
  },
  {
    value: "VERIFICATION_STUCK",
    label: "Verification Stuck",
    description:
      "Follow up with providers stuck in PROFILED or PENDING_VERIFICATION.",
  },
  {
    value: "PROVIDER_INACTIVE",
    label: "Provider Inactive",
    description:
      "Re-engage ACTIVE providers who haven't been contacted recently.",
  },
  {
    value: "CUSTOM",
    label: "Custom",
    description: "Filter by provider status + delay. Full control.",
  },
];

const TARGET_STATUSES = [
  "PENDING",
  "SENT",
  "ENGAGED",
  "PROFILED",
  "PENDING_VERIFICATION",
  "ACTIVE",
  "LEAD",
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
    const targetStatuses = formData
      .getAll("targetStatuses")
      .map(String)
      .filter(Boolean);
    const rule = await createReminderRule({
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? "") || undefined,
      kind,
      campaignId: String(formData.get("campaignId") ?? "") || undefined,
      messageTemplateId:
        String(formData.get("messageTemplateId") ?? "") || undefined,
      delayHours: Number(formData.get("delayHours") ?? 24),
      cooldownHours: Number(formData.get("cooldownHours") ?? 72),
      maxSendsPerProvider: Number(formData.get("maxSendsPerProvider") ?? 3),
      targetStatuses: targetStatuses.length > 0 ? targetStatuses : undefined,
      active: formData.get("active") === "on",
    });
    redirect(`/admin/reminders/${rule.id}`);
  }

  return (
    <div className="p-6 md:p-8 space-y-5 max-w-3xl">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/admin/reminders">
          <ChevronLeft className="size-4" />
          All rules
        </Link>
      </Button>

      <header>
        <h1>New reminder rule</h1>
        <p className="text-sm text-muted-foreground">
          Configure when and how to follow up with care providers.
        </p>
      </header>

      <form action={create} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Basics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">
                Rule name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                name="name"
                required
                placeholder="e.g. Nurse April Campaign — 24h follow-up"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                rows={2}
                placeholder="Optional internal note"
              />
            </div>
            <div className="space-y-2">
              <Label>
                Kind <span className="text-destructive">*</span>
              </Label>
              <div className="space-y-2">
                {KIND_OPTIONS.map((k) => (
                  <label
                    key={k.value}
                    className="flex items-start gap-3 p-3 rounded-md border bg-background cursor-pointer has-[:checked]:border-foreground has-[:checked]:bg-accent transition-colors"
                  >
                    <input
                      type="radio"
                      name="kind"
                      value={k.value}
                      required
                      className="mt-1 accent-foreground"
                    />
                    <div>
                      <div className="text-sm font-medium">{k.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {k.description}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Targeting</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="campaignId">
                Campaign
                <span className="text-muted-foreground font-normal text-xs ml-1">
                  (required for Campaign Follow-up)
                </span>
              </Label>
              <select
                id="campaignId"
                name="campaignId"
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
            <div className="space-y-2">
              <Label>
                Target statuses
                <span className="text-muted-foreground font-normal text-xs ml-1">
                  (leave blank to use defaults)
                </span>
              </Label>
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
                      className="sr-only"
                    />
                    {s}
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Timing & limits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="delayHours">
                  Delay (h) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="delayHours"
                  name="delayHours"
                  type="number"
                  min="0.5"
                  step="0.5"
                  defaultValue="24"
                  required
                />
                <p className="text-xs text-muted-foreground">After trigger</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cooldownHours">
                  Cooldown (h) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="cooldownHours"
                  name="cooldownHours"
                  type="number"
                  min="1"
                  step="1"
                  defaultValue="72"
                  required
                />
                <p className="text-xs text-muted-foreground">Between re-sends</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="maxSendsPerProvider">Max sends / provider</Label>
                <Input
                  id="maxSendsPerProvider"
                  name="maxSendsPerProvider"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue="3"
                  required
                />
                <p className="text-xs text-muted-foreground">0 = unlimited</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Message</CardTitle>
            <CardDescription>
              The WhatsApp template to dispatch when the rule fires.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              <Label htmlFor="messageTemplateId">WhatsApp template</Label>
              <select
                id="messageTemplateId"
                name="messageTemplateId"
                className="w-full h-9 px-3 rounded-md border bg-background text-sm"
              >
                <option value="">— Select a template —</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.code})
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox name="active" id="active" defaultChecked />
            <span>Active (start firing immediately)</span>
          </label>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/admin/reminders">Cancel</Link>
            </Button>
            <Button type="submit">Create rule</Button>
          </div>
        </div>
      </form>
    </div>
  );
}
