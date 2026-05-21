import { prisma } from "@/lib/db";
import Link from "next/link";
import { createCampaign } from "@/lib/actions/campaigns";
import RemindersEditor from "../_components/RemindersEditor";

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
    <div className="px-8 py-8 max-w-3xl">
      <Link
        href="/admin/campaigns"
        className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 mb-4 inline-block"
      >
        ← All campaigns
      </Link>

      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
        New campaign
      </h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
        Saved as DRAFT first. Upload your CSV and review on the next screen
        before launching.
      </p>

      <form action={createCampaign} className="space-y-6">
        <Section title="Basics">
          <Field
            label="Campaign name"
            name="name"
            required
            placeholder="e.g. April 2026 — Bangalore Nurse Drive"
          />
          <div className="space-y-1">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Profile type <span className="text-red-500">*</span>
            </label>
            <select
              name="profileTypeId"
              required
              defaultValue=""
              className="w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
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
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              All uploaded leads will be tagged as this profile type.
            </p>
          </div>
        </Section>

        <Section title="What gets sent">
          <div className="space-y-1">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Onboarding form
            </label>
            <select
              name="formTemplateId"
              defaultValue=""
              className="w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
            >
              <option value="">— None (link will 404 until set) —</option>
              {forms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} {f.status === "DRAFT" ? " · draft" : ""}
                </option>
              ))}
            </select>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              The form care providers will fill via the WhatsApp link.
            </p>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Invite message template
            </label>
            <select
              name="inviteMessageTemplateId"
              defaultValue=""
              className="w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
            >
              <option value="">— None (cannot launch without one) —</option>
              {inviteTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.code})
                </option>
              ))}
            </select>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Variables: {`{{name}}, {{form_link}}, {{role_label}}`}, etc.
            </p>
          </div>
        </Section>

        <Section title="Reminders">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Auto-send a follow-up to providers who haven&apos;t submitted yet.
            Evaluated when you press &quot;Run reminders now&quot; on the
            campaign page (or by a cron, later).
          </p>
          <RemindersEditor initial={[]} templates={templates} />
        </Section>

        <Section title="Throttling">
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
        </Section>

        <div className="flex gap-3">
          <button
            type="submit"
            className="px-4 py-2 rounded-md bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200"
          >
            Create draft
          </button>
          <Link
            href="/admin/campaigns"
            className="px-4 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4">
      <h2 className="font-medium text-zinc-900 dark:text-zinc-50">{title}</h2>
      {children}
    </section>
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
        defaultValue={defaultValue}
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
