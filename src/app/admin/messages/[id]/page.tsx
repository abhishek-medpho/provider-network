import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { MessageTemplateKind } from "@prisma/client";
import Link from "next/link";
import BodyEditor from "../_components/BodyEditor";
import TestSender from "../_components/TestSender";
import {
  updateMessageTemplate,
  archiveMessageTemplate,
  activateMessageTemplate,
  sendTestMessage,
} from "@/lib/actions/messages";
import { ChevronLeft, Send } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export default async function MessageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [template, profileTypes] = await Promise.all([
    prisma.messageTemplate.findUnique({
      where: { id },
      include: {
        profileType: { select: { code: true, label: true } },
        _count: {
          select: { whatsappMessages: true, inviteForCampaigns: true },
        },
      },
    }),
    prisma.profileType.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, label: true, code: true },
    }),
  ]);

  if (!template) notFound();

  async function saveAction(formData: FormData) {
    "use server";
    await updateMessageTemplate(id, formData);
  }
  async function archiveAction() {
    "use server";
    await archiveMessageTemplate(id);
  }
  async function activateAction() {
    "use server";
    await activateMessageTemplate(id);
  }
  async function testAction(formData: FormData) {
    "use server";
    return await sendTestMessage(id, formData);
  }

  return (
    <div className="p-6 md:p-8 space-y-5 max-w-4xl">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/admin/messages">
          <ChevronLeft className="size-4" />
          All templates
        </Link>
      </Button>

      <header>
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <h1 className="text-2xl font-semibold tracking-tight">{template.name}</h1>
          {template.active ? (
            <Badge className="text-[10px]">Active</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">
              Inactive
            </Badge>
          )}
          <Badge variant="secondary" className="text-[10px]">
            {template.kind}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
          <code className="font-mono">{template.code}</code>
          <span>·</span>
          <span className="uppercase">{template.language}</span>
          <span>·</span>
          <span>sent {template._count.whatsappMessages}×</span>
          <span>·</span>
          <span>
            used in {template._count.inviteForCampaigns} campaign
            {template._count.inviteForCampaigns === 1 ? "" : "s"}
          </span>
        </div>
      </header>

      <form action={saveAction} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Name"
                name="name"
                defaultValue={template.name}
                required
              />
              <div className="space-y-1.5">
                <Label htmlFor="channel">Channel</Label>
                <select
                  id="channel"
                  name="channel"
                  defaultValue={template.channel}
                  className="w-full h-9 px-3 rounded-md border bg-background text-sm"
                >
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="EMAIL">Email</option>
                  <option value="SMS">SMS</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="kind">Kind</Label>
                <select
                  id="kind"
                  name="kind"
                  defaultValue={template.kind}
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
                defaultValue={template.language}
                placeholder="en"
              />
              <div className="space-y-1.5">
                <Label htmlFor="profileTypeId">Scope (profile type)</Label>
                <select
                  id="profileTypeId"
                  name="profileTypeId"
                  defaultValue={template.profileTypeId ?? ""}
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
            <label className="flex items-center gap-2 text-sm pt-1">
              <Checkbox
                name="active"
                id="active"
                defaultChecked={template.active}
              />
              <span>Active (available for use in campaigns)</span>
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Subject (email only)</CardTitle>
            <CardDescription>
              Required when channel = EMAIL. Supports merge tags like body.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Field
              label="Subject"
              name="subject"
              defaultValue={template.subject ?? ""}
              placeholder="Subject line shown in inbox"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Body</CardTitle>
            <CardDescription>
              Plain-text body / email text fallback. Use{" "}
              <code className="font-mono text-xs px-1 py-px bg-muted rounded">
                {`{{variable_name}}`}
              </code>{" "}
              for merge tags.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BodyEditor initial={template.body} helpText="" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">HTML body (email only)</CardTitle>
            <CardDescription>
              Optional. Open + click tracking pixels are auto-injected at
              send time.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <textarea
              name="html"
              defaultValue={template.html ?? ""}
              rows={10}
              placeholder={`<!doctype html><body>\n  <h1>Hi {{name}}</h1>\n  <p><a href="{{form_link}}">Complete your profile</a></p>\n</body>`}
              className="w-full min-h-[180px] px-3 py-2 rounded-md border bg-background text-xs font-mono"
            />
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button type="submit">Save changes</Button>
          <Button variant="outline" asChild>
            <Link href="/admin/messages">Cancel</Link>
          </Button>
        </div>
      </form>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Send className="size-4" />
            Send test message
          </CardTitle>
          <CardDescription>
            Render the template with sample variables and ping a real WhatsApp
            number via Ultramsg.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TestSender action={testAction} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Lifecycle</CardTitle>
        </CardHeader>
        <CardContent>
          {template.active ? (
            <form action={archiveAction} className="space-y-2">
              <Button type="submit" variant="outline" size="sm">
                Deactivate template
              </Button>
              <p className="text-xs text-muted-foreground">
                Hides from campaign selection. Existing scheduled messages keep
                the rendered body.
              </p>
            </form>
          ) : (
            <form action={activateAction}>
              <Button type="submit" variant="outline" size="sm">
                Activate template
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  required,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
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
    </div>
  );
}
