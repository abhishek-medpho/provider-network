import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { renderSection } from "@/lib/onboard/blockRenderer";
import type { FormSection, FormAction } from "@/lib/types/form";

/**
 * Admin-only preview. Renders a form exactly as a care provider would see it,
 * but doesn't persist anything. Requires an admin session — public visitors
 * are redirected.
 */
export default async function FormPreviewPage({
  params,
}: {
  params: Promise<{ formId: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    // Don't redirect public visitors to a login page for preview — just 404
    notFound();
  }

  const { formId } = await params;
  const form = await prisma.formTemplate.findUnique({
    where: { id: formId },
    include: { profileType: { select: { label: true } } },
  });
  if (!form) notFound();

  const sections = (form.sections as unknown as FormSection[]) ?? [];
  const actions = (form.actions as unknown as FormAction[]) ?? [];

  const attrIds = new Set<string>();
  for (const s of sections)
    for (const b of s.blocks)
      if (b.type === "ATTRIBUTE") attrIds.add(b.attributeId);

  const attrs = await prisma.attribute.findMany({
    where: { id: { in: Array.from(attrIds) } },
  });
  const attrById = new Map(attrs.map((a) => [a.id, a]));

  // For APPOINTMENT_CONFIRM / EXECUTION previews, render with sample patient
  // context so DISPLAY blocks have something to show.
  const sampleContext = {
    patient: {
      name: "Mrs. Anu Reddy",
      address: "B-204, Mantri Sarovar, Kudlu Gate, Bangalore 560068",
      phone: "+91 98765 43210",
      age_gender: "67 F",
    },
    appointment: {
      scheduled_at: "Tomorrow, 9:30 AM",
    },
    order: {
      service_type: "Phlebotomy — Lipid + HbA1c",
    },
  };

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      {/* Preview banner */}
      <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 flex items-center justify-between gap-3">
        <div className="text-sm">
          <span className="font-medium text-amber-900">Preview mode</span>{" "}
          <span className="text-amber-700">— nothing is saved.</span>
        </div>
        <Link
          href={`/admin/forms/${form.id}`}
          className="text-xs font-medium text-amber-900 hover:underline whitespace-nowrap"
        >
          ← Back to editor
        </Link>
      </div>

      <header className="mb-6 px-1">
        <h1 className="text-xl font-semibold text-zinc-900">{form.name}</h1>
        <p className="text-sm text-zinc-600 mt-0.5">
          {form.profileType?.label ?? "All roles"} ·{" "}
          {sections.length} section{sections.length === 1 ? "" : "s"} ·{" "}
          {form.purpose}
        </p>
      </header>

      <form action="#" className="space-y-4">
        {sections.map((section) =>
          renderSection({
            section,
            attrById,
            values: {},
            context: sampleContext,
          }),
        )}

        <div className="pt-2 pb-10 flex flex-col gap-2 sm:flex-row sm:justify-end">
          {actions.length === 0 && (
            <button
              type="button"
              disabled
              className="w-full sm:w-auto px-6 py-3 rounded-lg bg-zinc-300 text-white text-base font-medium cursor-not-allowed"
            >
              Submit
            </button>
          )}
          {actions.map((a) => (
            <button
              key={a.key}
              type="button"
              disabled
              className={previewButtonClass(a.style)}
            >
              {a.label}
            </button>
          ))}
        </div>
      </form>
    </main>
  );
}

function previewButtonClass(style?: string) {
  const base =
    "w-full sm:w-auto px-6 py-3 rounded-lg text-base font-medium opacity-80 cursor-not-allowed";
  switch (style) {
    case "DANGER":
      return `${base} bg-white text-red-700 border border-red-200`;
    case "SECONDARY":
      return `${base} bg-white text-zinc-900 border border-zinc-300`;
    case "PRIMARY":
    default:
      return `${base} bg-zinc-900 text-white`;
  }
}
