import { prisma } from "@/lib/db";
import { MessageTemplateKind } from "@prisma/client";
import Link from "next/link";
import BodyEditor from "../_components/BodyEditor";
import { createMessageTemplate } from "@/lib/actions/messages";
import { ChevronLeft } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function NewMessageTemplatePage() {
  const profileTypes = await prisma.profileType.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, label: true },
  });

  return (
    <div className="p-6 md:p-8 space-y-5 max-w-4xl">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/admin/messages">
          <ChevronLeft className="size-4" />
          All templates
        </Link>
      </Button>

      <header>
        <h1>New message template</h1>
        <p className="text-sm text-muted-foreground">
          WhatsApp copy used for invites, reminders, and confirmations.
        </p>
      </header>

      <form action={createMessageTemplate} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Basics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Code"
                name="code"
                required
                placeholder="snake_case_code"
                help="Unique per language. e.g. nurse_invite_v2"
              />
              <Field
                label="Name"
                name="name"
                required
                placeholder="Shown in admin"
              />
              <div className="space-y-1.5">
                <Label htmlFor="channel">
                  Channel <span className="text-destructive">*</span>
                </Label>
                <select
                  id="channel"
                  name="channel"
                  defaultValue="WHATSAPP"
                  className="w-full h-9 px-3 rounded-md border bg-background text-sm"
                >
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="EMAIL">Email</option>
                  <option value="SMS">SMS (not yet wired)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="kind">
                  Kind <span className="text-destructive">*</span>
                </Label>
                <select
                  id="kind"
                  name="kind"
                  defaultValue="INVITE"
                  className="w-full h-9 px-3 rounded-md border bg-background text-sm"
                >
                  {Object.keys(MessageTemplateKind).map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>
              <Field
                label="Language"
                name="language"
                defaultValue="en"
                help="ISO code: en, hi, kn, ta…"
              />
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="profileTypeId">Scope (profile type)</Label>
                <select
                  id="profileTypeId"
                  name="profileTypeId"
                  defaultValue=""
                  className="w-full h-9 px-3 rounded-md border bg-background text-sm"
                >
                  <option value="">Global (any role)</option>
                  {profileTypes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Subject (email only)</CardTitle>
            <CardDescription>
              Required if channel = EMAIL. Supports{" "}
              <code className="font-mono text-xs px-1 py-px bg-muted rounded">
                {`{{merge_tags}}`}
              </code>{" "}
              like the body.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Field
              label="Subject"
              name="subject"
              placeholder="Quick onboarding for {{role_label}} roles — {{name}}"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Body</CardTitle>
            <CardDescription>
              Plain-text body. For email this is the text/plain fallback
              shown by clients that don&apos;t render HTML. Use{" "}
              <code className="font-mono text-xs px-1 py-px bg-muted rounded">
                {`{{variable_name}}`}
              </code>{" "}
              for merge tags.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BodyEditor initial="" helpText="" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">HTML body (email only)</CardTitle>
            <CardDescription>
              Optional. If left blank, the body text is wrapped in a minimal
              HTML template at send time. Open + click tracking pixels are
              auto-injected.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <textarea
              name="html"
              rows={10}
              placeholder={`<!doctype html><body>\n  <h1>Hi {{name}}</h1>\n  <p><a href="{{form_link}}">Complete your profile</a></p>\n</body>`}
              className="w-full min-h-[180px] px-3 py-2 rounded-md border bg-background text-xs font-mono"
            />
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button type="submit">Create template</Button>
          <Button variant="outline" asChild>
            <Link href="/admin/messages">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  required,
  help,
}: {
  label: string;
  name: string;
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
        type="text"
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        required={required}
      />
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
  );
}
