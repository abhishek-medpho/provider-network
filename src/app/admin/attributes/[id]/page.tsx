import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { AttributeType, PiiLevel } from "@prisma/client";
import {
  updateAttribute,
  archiveAttribute,
  restoreAttribute,
} from "@/lib/actions/attributes";
import OptionsEditor from "../_components/OptionsEditor";
import Link from "next/link";

type Option = { value: string; label: string };

const TYPES_WITH_OPTIONS: AttributeType[] = [
  AttributeType.SINGLE_SELECT,
  AttributeType.MULTI_SELECT,
];

export default async function AttributeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const attr = await prisma.attribute.findUnique({
    where: { id },
    include: {
      profileTypeAttrs: {
        include: { profileType: { select: { code: true, label: true } } },
      },
    },
  });
  if (!attr) notFound();

  const options = Array.isArray(attr.options)
    ? (attr.options as unknown as Option[])
    : [];
  const validation =
    (attr.validation as Record<string, unknown> | null) ?? {};

  async function saveAction(formData: FormData) {
    "use server";
    await updateAttribute(id, formData);
  }

  async function archiveAction() {
    "use server";
    await archiveAttribute(id);
  }

  async function restoreAction() {
    "use server";
    await restoreAttribute(id);
  }

  return (
    <div className="px-8 py-8 max-w-3xl">
      <Link
        href="/admin/attributes"
        className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 mb-4 inline-block"
      >
        ← All attributes
      </Link>

      <header className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            {attr.label}
          </h1>
          {attr.isSystem && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
              system
            </span>
          )}
          {attr.archivedAt && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400">
              archived
            </span>
          )}
        </div>
        <p className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
          {attr.key}
        </p>
      </header>

      <form action={saveAction} className="space-y-6">
        <Section title="Basics">
          <Field label="Label" name="label" defaultValue={attr.label} required />
          <Field
            label="Help text"
            name="helpText"
            defaultValue={attr.helpText ?? ""}
            placeholder="Optional context shown below the input"
          />
          <Field
            label="Category"
            name="category"
            defaultValue={attr.category ?? ""}
            placeholder="e.g. identity, skills, commercials"
          />
        </Section>

        <Section title="Type & options">
          <div className="space-y-1">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Type
            </label>
            <select
              name="type"
              defaultValue={attr.type}
              disabled={attr.isSystem}
              className="w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {Object.keys(AttributeType).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            {attr.isSystem && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                System attribute — type is locked.
              </p>
            )}
          </div>

          {TYPES_WITH_OPTIONS.includes(attr.type) && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Options
              </label>
              <OptionsEditor initial={options} />
            </div>
          )}
        </Section>

        <Section title="Validation">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-sm col-span-2">
              <input
                type="checkbox"
                name="validation_required"
                defaultChecked={validation.required === true}
              />
              Required
            </label>
            <Field
              label="Min (number or string length)"
              name="validation_min"
              defaultValue={(validation.min as number | undefined) ?? ""}
              type="number"
            />
            <Field
              label="Max"
              name="validation_max"
              defaultValue={(validation.max as number | undefined) ?? ""}
              type="number"
            />
            <Field
              label="Min items (multi-select)"
              name="validation_minItems"
              defaultValue={(validation.minItems as number | undefined) ?? ""}
              type="number"
            />
            <Field
              label="Max items"
              name="validation_maxItems"
              defaultValue={(validation.maxItems as number | undefined) ?? ""}
              type="number"
            />
            <Field
              label="Regex"
              name="validation_regex"
              defaultValue={(validation.regex as string | undefined) ?? ""}
              placeholder="^[0-9]{6}$"
            />
            <Field
              label="File max KB"
              name="validation_fileMaxKb"
              defaultValue={
                (validation.fileMaxKb as number | undefined) ?? ""
              }
              type="number"
            />
          </div>
        </Section>

        <Section title="Privacy & search">
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                PII Level
              </label>
              <select
                name="piiLevel"
                defaultValue={attr.piiLevel}
                className="w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
              >
                {Object.keys(PiiLevel).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Higher PII = masked in admin UI, requires audit on access.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="isSearchable"
                defaultChecked={attr.isSearchable}
              />
              Indexed for search (use sparingly)
            </label>
          </div>
        </Section>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="px-4 py-2 rounded-md bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200"
          >
            Save changes
          </button>
          <Link
            href="/admin/attributes"
            className="px-4 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Cancel
          </Link>
        </div>
      </form>

      <Section title="Used in" className="mt-10">
        {attr.profileTypeAttrs.length === 0 && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Not assigned to any profile type yet.
          </p>
        )}
        {attr.profileTypeAttrs.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attr.profileTypeAttrs.map((b) => (
              <span
                key={b.id}
                className={`text-xs px-2 py-1 rounded ${
                  b.isRequired
                    ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                }`}
              >
                {b.profileType.label}
                {b.isRequired && " *"}
                <span className="text-zinc-400 ml-1">[{b.sectionKey}]</span>
              </span>
            ))}
          </div>
        )}
      </Section>

      {!attr.isSystem && (
        <Section title="Danger zone" className="mt-10">
          {attr.archivedAt ? (
            <form action={restoreAction}>
              <button
                type="submit"
                className="px-4 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                Restore
              </button>
            </form>
          ) : (
            <form action={archiveAction}>
              <button
                type="submit"
                className="px-4 py-2 rounded-md border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-950/40"
              >
                Archive attribute
              </button>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                Archived attributes are hidden from forms and the default list.
                Existing data is preserved. Can be restored later.
              </p>
            </form>
          )}
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4 ${className ?? ""}`}
    >
      <h2 className="font-medium text-zinc-900 dark:text-zinc-50">{title}</h2>
      {children}
    </section>
  );
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  required,
  type = "text",
}: {
  label: string;
  name: string;
  defaultValue?: string | number;
  placeholder?: string;
  required?: boolean;
  type?: string;
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
        type={type}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        required={required}
        className="w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
      />
    </div>
  );
}
