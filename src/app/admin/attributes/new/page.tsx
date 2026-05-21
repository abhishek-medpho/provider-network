import { AttributeType, PiiLevel } from "@prisma/client";
import { createAttribute } from "@/lib/actions/attributes";
import OptionsEditor from "../_components/OptionsEditor";
import Link from "next/link";

const TYPES_WITH_OPTIONS = ["SINGLE_SELECT", "MULTI_SELECT"];

export default function NewAttributePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  return <NewForm searchParams={searchParams} />;
}

async function NewForm({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const initialType = (type && type in AttributeType ? type : "TEXT") as string;

  return (
    <div className="px-8 py-8 max-w-2xl">
      <Link
        href="/admin/attributes"
        className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 mb-4 inline-block"
      >
        ← All attributes
      </Link>

      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-6">
        New attribute
      </h1>

      <form action={createAttribute} className="space-y-6">
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4">
          <Field
            label="Key"
            name="key"
            placeholder="snake_case_key"
            required
            help="Lowercase, underscores. Cannot be changed after create. e.g. years_experience, has_vehicle"
          />
          <Field label="Label" name="label" required placeholder="Shown to user" />
          <Field
            label="Help text"
            name="helpText"
            placeholder="Optional context shown below the input"
          />
          <Field
            label="Category"
            name="category"
            placeholder="e.g. identity, skills, commercials"
          />

          <div className="space-y-1">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Type <span className="text-red-500">*</span>
            </label>
            <select
              name="type"
              defaultValue={initialType}
              className="w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
            >
              {Object.keys(AttributeType).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        {TYPES_WITH_OPTIONS.includes(initialType) && (
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
            <h2 className="font-medium text-zinc-900 dark:text-zinc-50">
              Options
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Required for SELECT types. You can add more later.
            </p>
            <OptionsEditor initial={[{ value: "", label: "" }]} />
          </div>
        )}

        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
          <h2 className="font-medium text-zinc-900 dark:text-zinc-50">
            Validation
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-sm col-span-2">
              <input type="checkbox" name="validation_required" />
              Required
            </label>
            <Field label="Min" name="validation_min" type="number" />
            <Field label="Max" name="validation_max" type="number" />
            <Field
              label="Regex"
              name="validation_regex"
              placeholder="^[0-9]{6}$"
            />
            <Field
              label="File max KB"
              name="validation_fileMaxKb"
              type="number"
            />
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
          <h2 className="font-medium text-zinc-900 dark:text-zinc-50">
            Privacy & search
          </h2>
          <div className="space-y-1">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              PII Level
            </label>
            <select
              name="piiLevel"
              defaultValue="NONE"
              className="w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
            >
              {Object.keys(PiiLevel).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isSearchable" />
            Indexed for search
          </label>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            className="px-4 py-2 rounded-md bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200"
          >
            Create attribute
          </button>
          <Link
            href="/admin/attributes"
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
  placeholder,
  required,
  type = "text",
  help,
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  type?: string;
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
        type={type}
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
