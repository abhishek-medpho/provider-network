import Link from "next/link";

export default function CheckWhatsAppPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-6">
      <div className="w-full max-w-md text-center">
        <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center mx-auto mb-6">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-6 h-6 text-green-600 dark:text-green-400"
          >
            <path d="M12.04 2c-5.51 0-9.98 4.47-9.98 9.98 0 1.76.46 3.41 1.26 4.85L2 22l5.31-1.39c1.39.76 2.98 1.19 4.69 1.19 5.51 0 9.98-4.47 9.98-9.98S17.55 2 12.04 2z" />
          </svg>
        </div>

        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
          Check your WhatsApp
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 mb-8">
          A login link has been sent to your WhatsApp. It&apos;s valid for{" "}
          <span className="font-medium text-zinc-900 dark:text-zinc-50">
            15 minutes
          </span>
          . Tap the link to sign in.
        </p>

        <div className="text-sm text-zinc-500 dark:text-zinc-400 space-y-2">
          <p>Didn&apos;t get it? Check that the number you entered is correct.</p>
          <p>
            <Link
              href="/login"
              className="text-zinc-900 dark:text-zinc-50 hover:underline"
            >
              ← Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
