import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import FormBuilder from "../_components/FormBuilder";
import {
  updateFormMetadata,
  updateFormSections,
  updateFormActions,
  publishForm,
  unpublishForm,
  archiveForm,
} from "@/lib/actions/forms";
import type { FormSection, FormAction } from "@/lib/types/form";
import { ChevronLeft, ExternalLink, Archive } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PURPOSE_LABELS: Record<string, string> = {
  ONBOARDING: "Onboarding (Invite)",
  APPOINTMENT_CONFIRM: "Appointment confirmation",
  APPOINTMENT_EXECUTION: "During appointment",
  POST_APPOINTMENT: "Post-appointment",
  CUSTOM: "Custom",
};

export default async function FormDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [form, profileTypes, attributes] = await Promise.all([
    prisma.formTemplate.findUnique({
      where: { id },
      include: { profileType: { select: { code: true, label: true } } },
    }),
    prisma.profileType.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, label: true },
    }),
    prisma.attribute.findMany({
      where: { archivedAt: null },
      orderBy: [{ category: "asc" }, { label: "asc" }],
      select: {
        id: true,
        key: true,
        label: true,
        type: true,
        category: true,
      },
    }),
  ]);

  if (!form) notFound();

  const sections = (form.sections as unknown as FormSection[]) ?? [];
  const actions = (form.actions as unknown as FormAction[]) ?? [];

  async function metadataAction(formData: FormData) {
    "use server";
    await updateFormMetadata(id, formData);
  }
  async function publishAction() {
    "use server";
    await publishForm(id);
  }
  async function unpublishAction() {
    "use server";
    await unpublishForm(id);
  }
  async function archiveAction() {
    "use server";
    await archiveForm(id);
  }
  async function saveSectionsAction(s: FormSection[]) {
    "use server";
    return await updateFormSections(id, s);
  }
  async function saveActionsAction(a: FormAction[]) {
    "use server";
    return await updateFormActions(id, a);
  }

  return (
    <div className="p-6 md:p-8 space-y-5 max-w-6xl">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/admin/forms">
          <ChevronLeft className="size-4" />
          All forms
        </Link>
      </Button>

      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">
              {form.name}
            </h1>
            <StatusBadge status={form.status} />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {PURPOSE_LABELS[form.purpose]} ·{" "}
            {form.profileType ? form.profileType.label : "All roles"} · v
            {form.version}
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <a
            href={`/onboard/preview/${form.id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Preview
            <ExternalLink className="size-3.5" />
          </a>
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={metadataAction} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={form.name}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="profileTypeId">Profile type scope</Label>
                <select
                  id="profileTypeId"
                  name="profileTypeId"
                  defaultValue={form.profileTypeId ?? ""}
                  className="w-full h-9 px-3 rounded-md border bg-background text-sm"
                >
                  <option value="">All roles</option>
                  {profileTypes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <Button type="submit" variant="secondary" size="sm">
              Save settings
            </Button>
          </form>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3">Structure</h2>
        <FormBuilder
          formId={form.id}
          initialSections={sections}
          initialActions={actions}
          attributes={attributes}
          purpose={form.purpose}
          saveSections={saveSectionsAction}
          saveActions={saveActionsAction}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Lifecycle</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {form.status === "DRAFT" && (
              <form action={publishAction}>
                <Button
                  type="submit"
                  className="bg-success text-success-foreground hover:bg-success/90"
                >
                  Publish
                </Button>
              </form>
            )}
            {form.status === "PUBLISHED" && (
              <form action={unpublishAction}>
                <Button type="submit" variant="outline">
                  Move to draft
                </Button>
              </form>
            )}
            <form action={archiveAction}>
              <Button
                type="submit"
                variant="outline"
                className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
              >
                <Archive className="size-3.5" />
                Archive
              </Button>
            </form>
          </div>
          <p className="text-xs text-muted-foreground">
            Only PUBLISHED forms can be referenced by live campaigns. Archived
            forms are hidden from selection.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "PUBLISHED"
      ? "default"
      : status === "ARCHIVED"
        ? "outline"
        : "secondary";
  return (
    <Badge variant={variant} className="text-[10px] uppercase tracking-wide">
      {status}
    </Badge>
  );
}
