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
    <div className="px-8 py-8 max-w-5xl">
      <Link
        href="/admin/forms"
        className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 mb-4 inline-block"
      >
        ← All forms
      </Link>

      <header className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            {form.name}
          </h1>
          <StatusBadge status={form.status} />
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {PURPOSE_LABELS[form.purpose]} ·{" "}
          {form.profileType ? form.profileType.label : "All roles"} · v
          {form.version}
        </p>
      </header>

      {/* Metadata edit */}
      <form
        action={metadataAction}
        className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4 mb-6"
      >
        <h2 className="font-medium text-zinc-900 dark:text-zinc-50">Settings</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Name
            </label>
            <input
              name="name"
              defaultValue={form.name}
              required
              className="w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Profile type scope
            </label>
            <select
              name="profileTypeId"
              defaultValue={form.profileTypeId ?? ""}
              className="w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
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
        <div className="flex gap-3">
          <button
            type="submit"
            className="px-3 py-1.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 text-sm font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700"
          >
            Save settings
          </button>
        </div>
      </form>

      {/* Builder */}
      <h2 className="font-medium text-zinc-900 dark:text-zinc-50 mb-3">
        Structure
      </h2>
      <FormBuilder
        formId={form.id}
        initialSections={sections}
        initialActions={actions}
        attributes={attributes}
        purpose={form.purpose}
        saveSections={saveSectionsAction}
        saveActions={saveActionsAction}
      />

      {/* Lifecycle */}
      <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 mt-8">
        <h2 className="font-medium text-zinc-900 dark:text-zinc-50 mb-3">
          Lifecycle
        </h2>
        <div className="flex flex-wrap gap-3">
          {form.status === "DRAFT" && (
            <form action={publishAction}>
              <button
                type="submit"
                className="px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium"
              >
                Publish
              </button>
            </form>
          )}
          {form.status === "PUBLISHED" && (
            <form action={unpublishAction}>
              <button
                type="submit"
                className="px-4 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                Move to draft
              </button>
            </form>
          )}
          <form action={archiveAction}>
            <button
              type="submit"
              className="px-4 py-2 rounded-md border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-950/40"
            >
              Archive
            </button>
          </form>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-3">
          Only PUBLISHED forms can be referenced by live campaigns. Archived
          forms are hidden from selection.
        </p>
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400",
    PUBLISHED:
      "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400",
    ARCHIVED:
      "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400",
  };
  return (
    <span
      className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${map[status] ?? map.DRAFT}`}
    >
      {status}
    </span>
  );
}
