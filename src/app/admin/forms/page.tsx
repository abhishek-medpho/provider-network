import { prisma } from "@/lib/db";
import Link from "next/link";
import { FormPurpose } from "@prisma/client";

const PURPOSE_LABELS: Record<string, string> = {
  ONBOARDING: "Onboarding (Invite)",
  APPOINTMENT_CONFIRM: "Appointment confirmation",
  APPOINTMENT_EXECUTION: "During appointment",
  POST_APPOINTMENT: "Post-appointment",
  CUSTOM: "Custom",
};

const PURPOSE_DESC: Record<string, string> = {
  ONBOARDING:
    "Capture profile details from a new care provider via WhatsApp link.",
  APPOINTMENT_CONFIRM:
    "Show patient + appointment details; provider taps Accept or Decline.",
  APPOINTMENT_EXECUTION:
    "Shown during the visit. Mixes patient context with configurable data capture.",
  POST_APPOINTMENT: "Final wrap-up after the visit ends.",
  CUSTOM: "Anything else.",
};

const PURPOSE_COLORS: Record<string, string> = {
  ONBOARDING: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400",
  APPOINTMENT_CONFIRM:
    "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400",
  APPOINTMENT_EXECUTION:
    "bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400",
  POST_APPOINTMENT:
    "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400",
  CUSTOM: "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300",
};

export default async function FormsPage() {
  const forms = await prisma.formTemplate.findMany({
    where: { status: { not: "ARCHIVED" } },
    include: { profileType: { select: { code: true, label: true } } },
    orderBy: [{ purpose: "asc" }, { updatedAt: "desc" }],
  });

  const grouped = forms.reduce<Record<string, typeof forms>>((acc, f) => {
    (acc[f.purpose] = acc[f.purpose] || []).push(f);
    return acc;
  }, {});

  return (
    <div className="px-8 py-8">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Forms
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Configurable forms shown to care providers at each lifecycle stage.
          </p>
        </div>
        <Link
          href="/admin/forms/new"
          className="px-4 py-2 rounded-md bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200"
        >
          + New form
        </Link>
      </header>

      {forms.length === 0 && (
        <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-10 text-center">
          <h3 className="font-medium text-zinc-900 dark:text-zinc-50 mb-1">
            No forms yet
          </h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4 max-w-md mx-auto">
            Create one form per lifecycle stage. Each has a purpose (onboarding,
            appointment confirmation, execution) that drives the default
            structure and action buttons.
          </p>
          <Link
            href="/admin/forms/new"
            className="inline-block px-4 py-2 rounded-md bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200"
          >
            Create your first form
          </Link>
        </div>
      )}

      <div className="space-y-6">
        {Object.keys(FormPurpose).map((purpose) => {
          const items = grouped[purpose] ?? [];
          if (items.length === 0) return null;
          return (
            <section key={purpose}>
              <div className="flex items-baseline gap-3 mb-3">
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                  {PURPOSE_LABELS[purpose]}
                </h2>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {PURPOSE_DESC[purpose]}
                </span>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map((f) => (
                  <Link
                    key={f.id}
                    href={`/admin/forms/${f.id}`}
                    className="block p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700"
                  >
                    <div className="flex items-start justify-between mb-1.5">
                      <h3 className="font-medium text-zinc-900 dark:text-zinc-50 truncate">
                        {f.name}
                      </h3>
                      <StatusBadge status={f.status} />
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 space-x-2">
                      <span
                        className={`px-1.5 py-0.5 rounded ${PURPOSE_COLORS[purpose]}`}
                      >
                        {purpose}
                      </span>
                      <span>
                        {f.profileType ? f.profileType.label : "All roles"}
                      </span>
                      <span>· v{f.version}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
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
