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
        _count: { select: { whatsappMessages: true, inviteForCampaigns: true } },
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
    <div className="px-8 py-8 max-w-5xl">
      <Link
        href="/admin/messages"
        className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 mb-4 inline-block"
      >
        ← All templates
      </Link>

      <header className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            {template.name}
          </h1>
          {!template.active && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
              inactive
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
          <code className="font-mono">{template.code}</code>
          <span>·</span>
          <span>{template.language}</span>
          <span>·</span>
          <span>
            sent {template._count.whatsappMessages}× · used in{" "}
            {template._count.inviteForCampaigns} campaign
            {template._count.inviteForCampaigns === 1 ? "" : "s"}
          </span>
        </div>
      </header>

      <form action={saveAction} className="space-y-6">
        <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Name"
              name="name"
              defaultValue={template.name}
              required
            />
            <div className="space-y-1">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Kind
              </label>
              <select
                name="kind"
                defaultValue={template.kind}
                className="w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
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
            <div className="space-y-1">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Scope (profile type)
              </label>
              <select
                name="profileTypeId"
                defaultValue={template.profileTypeId ?? ""}
                className="w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
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
            <input
              type="checkbox"
              name="active"
              defaultChecked={template.active}
            />
            Active (available for use in campaigns)
          </label>
        </section>

        <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
          <BodyEditor
            initial={template.body}
            helpText="Use {{variable_name}} for merge tags. Variables are auto-detected on save."
          />
        </section>

        <div className="flex gap-3">
          <button
            type="submit"
            className="px-4 py-2 rounded-md bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200"
          >
            Save changes
          </button>
          <Link
            href="/admin/messages"
            className="px-4 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Cancel
          </Link>
        </div>
      </form>

      <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 mt-8">
        <h2 className="font-medium text-zinc-900 dark:text-zinc-50 mb-3">
          Send test message
        </h2>
        <TestSender action={testAction} />
      </section>

      <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 mt-8">
        <h2 className="font-medium text-zinc-900 dark:text-zinc-50 mb-3">
          Status
        </h2>
        {template.active ? (
          <form action={archiveAction}>
            <button
              type="submit"
              className="px-4 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              Deactivate template
            </button>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
              Hides from campaign selection. Existing scheduled messages keep
              the rendered body.
            </p>
          </form>
        ) : (
          <form action={activateAction}>
            <button
              type="submit"
              className="px-4 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              Activate template
            </button>
          </form>
        )}
      </section>
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
    <div className="space-y-1">
      <label
        htmlFor={name}
        className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
      >
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type="text"
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        required={required}
        className="w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
      />
    </div>
  );
}
