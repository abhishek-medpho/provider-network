import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { confirmGig } from "@/lib/actions/gig-confirm";
import { gigTaskLabel } from "@/lib/gigs/labels";
import { ConfirmAction } from "./_components/ConfirmAction";

export const metadata: Metadata = {
  title: "Confirm job — Labstack Provider",
};

function formatWhen(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(new Date(d));
}

export default async function ConfirmPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const resp = await prisma.gigResponse.findUnique({
    where: { token },
    include: {
      gig: { include: { profileType: { select: { label: true } } } },
      careProvider: { select: { name: true } },
    },
  });
  if (!resp) notFound();

  const { gig } = resp;
  const firstName = resp.careProvider.name?.split(/\s+/)[0] ?? "there";

  // Is this token still the active assignee + awaiting?
  const isActiveAssignee =
    gig.assignedProviderId === resp.careProviderId &&
    gig.assignmentStatus === "AWAITING" &&
    gig.status === "ASSIGNED";
  const alreadyConfirmed =
    gig.assignedProviderId === resp.careProviderId &&
    gig.status === "CONFIRMED";

  const initialStatus = alreadyConfirmed
    ? "CONFIRMED"
    : isActiveAssignee
      ? "AWAITING"
      : "LAPSED";

  async function confirm() {
    "use server";
    return await confirmGig(token);
  }

  return (
    <main className="max-w-md mx-auto px-4 py-8">
      <p className="text-sm text-zinc-600 mb-1">Hi {firstName} 👋</p>
      <h1 className="text-xl font-semibold text-zinc-900 mb-4">
        You&apos;ve been selected — confirm to lock it in
      </h1>

      <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-3 mb-6">
        <div className="text-lg font-semibold text-zinc-900 capitalize">
          {gigTaskLabel(gig.type)}
        </div>
        <dl className="grid grid-cols-[90px_1fr] gap-y-2 text-sm">
          <dt className="text-zinc-500">Role</dt>
          <dd className="text-zinc-900">{gig.profileType.label}</dd>
          <dt className="text-zinc-500">When</dt>
          <dd className="text-zinc-900 font-medium">
            {formatWhen(gig.scheduledFor)}
          </dd>
          {(gig.siteArea || gig.pincode) && (
            <>
              <dt className="text-zinc-500">Area</dt>
              <dd className="text-zinc-900">{gig.siteArea ?? gig.pincode}</dd>
            </>
          )}
          {gig.payText && (
            <>
              <dt className="text-zinc-500">Pay</dt>
              <dd className="text-zinc-900 font-medium">{gig.payText}</dd>
            </>
          )}
        </dl>
        <p className="text-xs text-zinc-500 border-t border-zinc-100 pt-3">
          Confirm and we&apos;ll send you the exact address and patient
          details right away.
        </p>
      </div>

      <ConfirmAction confirm={confirm} initialStatus={initialStatus} />

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
