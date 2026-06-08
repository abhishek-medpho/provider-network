import { prisma } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { renderSection } from "@/lib/onboard/blockRenderer";
import { submitGigCompletion } from "@/lib/actions/gig-complete";
import { gigTaskLabel } from "@/lib/gigs/labels";
import type { FormSection } from "@/lib/types/form";
import { SubmitButton } from "@/components/onboard/SubmitButton";

export const metadata: Metadata = {
  title: "Complete job — Labstack Provider",
};

export default async function GigCompletePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const gig = await prisma.gig.findUnique({
    where: { id },
    include: {
      sopFormTemplate: true,
      profileType: { select: { label: true } },
      assignedProvider: { select: { name: true } },
    },
  });
  if (!gig) notFound();

  // Already completed → friendly state.
  if (gig.status === "COMPLETED") {
    return (
      <main className="max-w-md mx-auto px-4 py-10">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
          <h1 className="text-lg font-semibold text-emerald-900">
            ✓ Job completed
          </h1>
          <p className="text-sm text-emerald-800 mt-1">
            Thanks — we&apos;ve recorded your report.
          </p>
        </div>
      </main>
    );
  }

  if (gig.status !== "CONFIRMED" || !gig.sopFormTemplate) {
    return (
      <main className="max-w-md mx-auto px-4 py-10">
        <p className="text-sm text-zinc-600">
          This job isn&apos;t ready for a completion report yet.
        </p>
      </main>
    );
  }

  const form = gig.sopFormTemplate;
  const sections = (form.sections as unknown as FormSection[]) ?? [];

  const attrIds = new Set<string>();
  for (const s of sections)
    for (const b of s.blocks)
      if (b.type === "ATTRIBUTE") attrIds.add(b.attributeId);
  const attrs = await prisma.attribute.findMany({
    where: { id: { in: Array.from(attrIds) } },
  });
  const attrById = new Map(attrs.map((a) => [a.id, a]));

  async function action(formData: FormData) {
    "use server";
    const { redirect } = await import("next/navigation");
    const r = await submitGigCompletion(id, formData);
    if (r.ok) {
      redirect(`/gig-complete/${id}`);
    }
    redirect(
      `/gig-complete/${id}?error=${encodeURIComponent(r.error ?? "Something went wrong")}`,
    );
  }

  const firstName = gig.assignedProvider?.name?.split(/\s+/)[0] ?? "there";

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <header className="mb-6 px-1">
        <p className="text-sm text-zinc-600">Hi {firstName} 👋</p>
        <h1 className="text-xl font-semibold text-zinc-900 capitalize">
          {gigTaskLabel(gig.type)} — completion report
        </h1>
        <p className="text-sm text-zinc-600 mt-0.5">
          Fill this in after the visit to close the job.
        </p>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong className="block mb-0.5">Couldn&apos;t submit:</strong>
          {decodeURIComponent(error)}
        </div>
      )}

      <form action={action} className="space-y-4">
        {sections.map((section) =>
          renderSection({
            section,
            attrById,
            values: {},
            context: {},
          }),
        )}

        <div className="pt-2 pb-10 flex justify-end">
          <SubmitButton label="Submit report" />
        </div>
      </form>

      <footer className="text-center text-xs text-zinc-500 pb-6">
        Powered by{" "}
        <a
          href="https://www.labstack.in"
          target="_blank"
          rel="noopener noreferrer"
          className="text-zinc-700 hover:text-zinc-900 underline underline-offset-2"
        >
          Labstack
        </a>
      </footer>
    </main>
  );
}
