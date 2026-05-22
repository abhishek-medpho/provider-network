import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Uploads too large",
};

export default function TooLargePage() {
  return (
    <main className="max-w-md mx-auto px-4 py-16 text-center">
      <div className="text-5xl mb-4">📦</div>
      <h1 className="text-xl font-semibold text-zinc-900 mb-2">
        Your uploads were too large
      </h1>
      <p className="text-sm text-zinc-600 mb-6">
        We weren&apos;t able to receive your photos because they exceeded the
        allowed size. Please go back, retake the photos in lower quality, and
        try submitting again.
      </p>
      <p className="text-xs text-zinc-500 mb-6">
        Tip: most modern phones default to very high resolution. Open your
        camera app settings and switch to a smaller size (1080p / 2 MP is
        plenty for ID photos).
      </p>
      <Link
        href="javascript:history.back()"
        className="inline-block px-5 py-2.5 rounded-lg bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800"
      >
        ← Go back
      </Link>
    </main>
  );
}
