import { prisma } from "@/lib/db";
import { FormPurpose } from "@prisma/client";
import Link from "next/link";
import { createForm } from "@/lib/actions/forms";

const PURPOSE_LABELS: Record<string, string> = {
  ONBOARDING: "Onboarding (Invite)",
  APPOINTMENT_CONFIRM: "Appointment confirmation",
  APPOINTMENT_EXECUTION: "During appointment",
  POST_APPOINTMENT: "Post-appointment",
  CUSTOM: "Custom",
};

const PURPOSE_HELP: Record<string, string> = {
  ONBOARDING: "Sent to leads via WhatsApp. Mostly input fields.",
  APPOINTMENT_CONFIRM:
    "Patient details + Accept / Can't make it buttons. Starts with display blocks.",
  APPOINTMENT_EXECUTION:
    "Mix of patient context display + data capture fields (vitals, notes...).",
  POST_APPOINTMENT: "Wrap-up form after the visit. Often a rating + notes.",
  CUSTOM: "Empty starter. Build from scratch.",
};

export default async function NewFormPage() {
  const profileTypes = await prisma.profileType.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, label: true },
  });

  return (
    <div className="px-8 py-8 max-w-2xl">
      <Link
        href="/admin/forms"
        className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 mb-4 inline-block"
      >
        ← All forms
      </Link>

      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
        New form
      </h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
        We&apos;ll create the form with starter sections + default action
        buttons based on the purpose. You can customise everything after.
      </p>

      <form action={createForm} className="space-y-6">
        <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4">
          <div className="space-y-1">
            <label
              htmlFor="name"
              className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Form name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              name="name"
              required
              placeholder="e.g. Nurse onboarding v1"
              className="w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Purpose <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {Object.keys(FormPurpose).map((p, idx) => (
                <label
                  key={p}
                  className="flex items-start gap-3 p-3 rounded-md border border-zinc-200 dark:border-zinc-800 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                >
                  <input
                    type="radio"
                    name="purpose"
                    value={p}
                    defaultChecked={idx === 0}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {PURPOSE_LABELS[p]}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {PURPOSE_HELP[p]}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="profileTypeId"
              className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Scope (profile type)
            </label>
            <select
              id="profileTypeId"
              name="profileTypeId"
              defaultValue=""
              className="w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
            >
              <option value="">All roles</option>
              {profileTypes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Leave on &quot;All roles&quot; for forms that apply regardless of
              provider type (e.g. appointment confirmation).
            </p>
          </div>
        </section>

        <div className="flex gap-3">
          <button
            type="submit"
            className="px-4 py-2 rounded-md bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200"
          >
            Create form
          </button>
          <Link
            href="/admin/forms"
            className="px-4 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
