import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { recordOfferViewed, respondToOffer } from "@/lib/actions/offers";
import { OfferActions } from "./_components/OfferActions";

export const metadata: Metadata = {
  title: "Job offer — Labstack Provider",
};

export default async function OfferPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const offer = await prisma.jobOffer.findUnique({
    where: { token },
    include: {
      job: { include: { profileType: { select: { label: true } } } },
      careProvider: { select: { name: true } },
    },
  });

  if (!offer) notFound();

  // Record the view (best-effort, doesn't block render).
  recordOfferViewed(token).catch(() => {});

  const { job } = offer;
  const firstName = offer.careProvider.name?.split(/\s+/)[0] ?? "there";

  async function respond(decision: "ACCEPTED" | "DECLINED") {
    "use server";
    return await respondToOffer(token, decision);
  }

  return (
    <main className="max-w-md mx-auto px-4 py-8">
      <p className="text-sm text-zinc-600 mb-1">Hi {firstName} 👋</p>
      <h1 className="text-xl font-semibold text-zinc-900 mb-4">
        A new job for you
      </h1>

      <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-3 mb-6">
        <div>
          <div className="text-lg font-semibold text-zinc-900">
            {job.title}
          </div>
          <div className="text-sm text-zinc-500">{job.profileType.label}</div>
        </div>

        <dl className="grid grid-cols-[90px_1fr] gap-y-2 text-sm">
          {job.shiftType && (
            <>
              <dt className="text-zinc-500">Shift</dt>
              <dd className="text-zinc-900">{job.shiftType}</dd>
            </>
          )}
          {job.payText && (
            <>
              <dt className="text-zinc-500">Pay</dt>
              <dd className="text-zinc-900 font-medium">{job.payText}</dd>
            </>
          )}
          {job.pincode && (
            <>
              <dt className="text-zinc-500">Area</dt>
              <dd className="text-zinc-900">{job.pincode}</dd>
            </>
          )}
          {offer.distanceKm != null && (
            <>
              <dt className="text-zinc-500">Distance</dt>
              <dd className="text-zinc-900">~{offer.distanceKm} km away</dd>
            </>
          )}
        </dl>

        {job.description && (
          <p className="text-sm text-zinc-600 border-t border-zinc-100 pt-3">
            {job.description}
          </p>
        )}
      </div>

      <OfferActions respond={respond} initialStatus={offer.status} />

      <footer className="text-center text-xs text-zinc-500 mt-8">
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
