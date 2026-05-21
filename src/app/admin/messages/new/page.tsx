import { prisma } from "@/lib/db";
import { MessageTemplateKind } from "@prisma/client";
import Link from "next/link";
import BodyEditor from "../_components/BodyEditor";
import { createMessageTemplate } from "@/lib/actions/messages";

export default async function NewMessageTemplatePage() {
  const profileTypes = await prisma.profileType.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, label: true },
  });

  return (
    <div className="px-8 py-8 max-w-5xl">
      <Link
        href="/admin/messages"
        className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 mb-4 inline-block"
      >
        ← All templates
      </Link>

      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-6">
        New message template
      </h1>

      <form action={createMessageTemplate} className="space-y-6">
        <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4">
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
            <div className="space-y-1">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Kind <span className="text-red-500">*</span>
              </label>
              <select
                name="kind"
                defaultValue="INVITE"
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
              defaultValue="en"
              help="ISO code: en, hi, kn, ta..."
            />
            <div className="space-y-1 col-span-2">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Scope (profile type)
              </label>
              <select
                name="profileTypeId"
                defaultValue=""
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
        </section>

        <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
          <BodyEditor
            initial=""
            helpText="Use {{variable_name}} for merge tags. Variables are auto-detected on save."
          />
        </section>

        <div className="flex gap-3">
          <button
            type="submit"
            className="px-4 py-2 rounded-md bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200"
          >
            Create template
          </button>
          <Link
            href="/admin/messages"
            className="px-4 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Cancel
          </Link>
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
      {help && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{help}</p>
      )}
    </div>
  );
}
