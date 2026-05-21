import { prisma } from "@/lib/db";

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
    <main className="min-h-screen flex items-center justify-center px-5">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-8 h-8 text-emerald-600"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M20.704 5.293a1 1 0 010 1.414l-11 11a1 1 0 01-1.414 0l-5-5a1 1 0 011.414-1.414L9 15.586l10.29-10.293a1 1 0 011.414 0z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold text-zinc-900 mb-2">
          Thanks {firstName}!
        </h1>
        <p className="text-base text-zinc-600 mb-6">
          We&apos;ve saved your profile. Our team will verify your details in the
          next 24-48 hours, and then we&apos;ll start sending you job
          opportunities in your area via WhatsApp.
        </p>
        <p className="text-xs text-zinc-500">
          Care Provider Platform · Your data is secure
        </p>
      </div>
    </main>
  );
}
