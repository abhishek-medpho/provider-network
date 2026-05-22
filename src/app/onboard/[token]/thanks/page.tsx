import { prisma } from "@/lib/db";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Thanks — profile submitted",
  description: "Your profile has been submitted to Labstack for verification.",
};

export default async function OnboardThanksPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const member = await prisma.campaignMember.findUnique({
    where: { token },
    include: { careProvider: { select: { name: true } } },
  });

  const firstName = member?.careProvider.name?.split(/\s+/)[0] ?? "there";

  return (
    <main className="min-h-screen flex items-center justify-center px-5 py-12">
      <div className="max-w-md w-full">
        <div className="rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
          <div className="size-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-7 h-7 text-emerald-600"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M20.704 5.293a1 1 0 010 1.414l-11 11a1 1 0 01-1.414 0l-5-5a1 1 0 011.414-1.414L9 15.586l10.29-10.293a1 1 0 011.414 0z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 mb-2">
            Thanks, {firstName}!
          </h1>
          <p className="text-sm text-zinc-600 leading-relaxed">
            We&apos;ve saved your profile. Our team will verify your details in
            the next 24–48 hours, and then we&apos;ll start sending you nearby
            job opportunities via WhatsApp.
          </p>

          <div className="mt-6 rounded-lg bg-zinc-50 p-3 text-left">
            <p className="text-xs font-medium text-zinc-700">What happens next</p>
            <ul className="text-xs text-zinc-600 mt-1.5 space-y-1">
              <li>• We verify your documents (1–2 days)</li>
              <li>• You receive job notifications matching your area + skills</li>
              <li>• Accept the ones that fit; we handle the rest</li>
            </ul>
          </div>
        </div>

        <p className="text-xs text-zinc-500 text-center mt-5">
          Powered by{" "}
          <a
            href="https://www.labstack.in"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-700 hover:text-zinc-900 underline underline-offset-2"
          >
            Labstack
          </a>
          {" · "}
          <a
            href="https://www.labstack.in"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-700 hover:text-zinc-900 underline underline-offset-2"
          >
            www.labstack.in
          </a>
        </p>
      </div>
    </main>
  );
}
