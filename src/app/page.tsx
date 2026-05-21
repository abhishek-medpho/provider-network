import Link from "next/link";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-6">
      <div className="max-w-2xl w-full">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 mb-3">
            Care Provider Platform
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400">
            Configurable engagement platform for healthcare workforce onboarding.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Link
            href={session ? "/admin" : "/login"}
            className="block p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
          >
            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">
              Admin
            </div>
            <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {session ? "Open dashboard →" : "Sign in →"}
            </div>
            <div className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
              Manage profile types, forms, messages, campaigns, and care providers.
            </div>
          </Link>

          <Link
            href="/onboard"
            className="block p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
          >
            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">
              Care Provider
            </div>
            <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Complete your onboarding →
            </div>
            <div className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
              Public form for nurses, phlebotomists, and other care providers.
            </div>
          </Link>
        </div>

        {session?.user && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center mt-8">
            Signed in as {session.user.name ?? session.user.phone} · {session.user.role}
          </p>
        )}
      </div>
    </div>
  );
}
