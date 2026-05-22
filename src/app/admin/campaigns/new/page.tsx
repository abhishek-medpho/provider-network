import { prisma } from "@/lib/db";
import Link from "next/link";
import { createCampaign } from "@/lib/actions/campaigns";
import RemindersEditor from "../_components/RemindersEditor";
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

export default async function NewCampaignPage() {
  const [profileTypes, forms, templates] = await Promise.all([
    prisma.profileType.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, label: true, code: true },
    }),
    prisma.formTemplate.findMany({
      where: { status: { not: "ARCHIVED" }, purpose: "ONBOARDING" },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        profileTypeId: true,
        status: true,
      },
    }),
    prisma.messageTemplate.findMany({
      where: { active: true, channel: "WHATSAPP" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true, kind: true },
    }),
  ]);

  const inviteTemplates = templates.filter(
    (t) => t.kind === "INVITE" || t.kind === "CUSTOM",
  );

  return (
    <div className="p-6 md:p-8 space-y-5 max-w-3xl">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/admin/campaigns">
          <ChevronLeft className="size-4" />
          All campaigns
        </Link>
      </Button>

      <header>
        <h1>New campaign</h1>
        <p className="text-sm text-muted-foreground">
          Saved as DRAFT first. Upload your CSV and review on the next screen
          before launching.
        </p>
      </header>

      <form action={createCampaign} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Basics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field
              label="Campaign name"
              name="name"
              required
              placeholder="e.g. April 2026 — Bangalore Nurse Drive"
            />
            <div className="space-y-1.5">
              <Label htmlFor="profileTypeId">
                Profile type <span className="text-destructive">*</span>
              </Label>
              <select
                id="profileTypeId"
                name="profileTypeId"
                required
                defaultValue=""
                className="w-full h-9 px-3 rounded-md border bg-background text-sm"
              >
                <option value="" disabled>
                  — Select —
                </option>
                {profileTypes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                All uploaded leads will be tagged as this profile type.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">What gets sent</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="formTemplateId">Onboarding form</Label>
              <select
                id="formTemplateId"
                name="formTemplateId"
                defaultValue=""
                className="w-full h-9 px-3 rounded-md border bg-background text-sm"
              >
                <option value="">— None (link will 404 until set) —</option>
                {forms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} {f.status === "DRAFT" ? " · draft" : ""}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                The form care providers will fill via the WhatsApp link.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inviteMessageTemplateId">
                Invite message template
              </Label>
              <select
                id="inviteMessageTemplateId"
                name="inviteMessageTemplateId"
                defaultValue=""
                className="w-full h-9 px-3 rounded-md border bg-background text-sm"
              >
                <option value="">— None (cannot launch without one) —</option>
                {inviteTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.code})
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Variables:{" "}
                <code className="font-mono text-[11px] px-1 py-px bg-muted rounded">
                  {`{{name}} {{form_link}} {{role_label}}`}
                </code>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Reminders</CardTitle>
            <CardDescription>
              Auto-send a follow-up to providers who haven&apos;t submitted yet.
              Evaluated when you press &quot;Run reminders now&quot; on the
              campaign page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RemindersEditor initial={[]} templates={templates} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Throttling</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Max sends per day"
                name="maxSendsPerDay"
                type="number"
                defaultValue="100"
                help="Ultramsg bans are real. Start conservative."
              />
              <Field
                label="Max sends per provider"
                name="maxSendsPerProvider"
                type="number"
                defaultValue="4"
                help="Across invite + all reminders."
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button type="submit">Create draft</Button>
          <Button variant="outline" asChild>
            <Link href="/admin/campaigns">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  placeholder,
  required,
  help,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  help?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <Input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
      />
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
  );
}
