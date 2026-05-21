import { signIn } from "@/lib/auth";
import Link from "next/link";

type SearchParams = Promise<{ error?: string; next?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { error, next } = await searchParams;

  async function handleLogin(formData: FormData) {
    "use server";
    const phone = String(formData.get("phone") ?? "");
    const callbackUrl = String(formData.get("next") ?? "/admin");

    await signIn("whatsapp", {
      email: phone, // NextAuth's identifier; our normalizer turns it into a phone
      redirectTo: callbackUrl,
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-6">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 mb-8 inline-block"
        >
          ← Home
        </Link>

        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
          Admin sign in
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-8">
          We&apos;ll send a login link to your WhatsApp.
        </p>

        {error && (
          <div className="mb-6 p-3 rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-sm text-red-700 dark:text-red-300">
            {decodeURIComponent(error)}
          </div>
        )}

        <form action={handleLogin} className="space-y-4">
          <div>
            <label
              htmlFor="phone"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5"
            >
              WhatsApp number
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              placeholder="98765 43210"
              className="w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            />
            <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              Indian numbers — 10 digits without the +91.
            </p>
          </div>

          <input type="hidden" name="next" value={next ?? "/admin"} />

          <button
            type="submit"
            className="w-full px-4 py-2 rounded-md bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
          >
            Send WhatsApp login link
          </button>
        </form>

        <p className="mt-8 text-xs text-zinc-500 dark:text-zinc-400 text-center">
          Only authorized admin numbers can sign in.
        </p>
      </div>
    </div>
  );
}
