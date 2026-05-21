/**
 * Public layout — used for /onboard/* (form renderer) and /onboard/preview/*.
 * No auth, mobile-first, light theme regardless of system preference (Indian
 * Android default is light; dark inversions look broken on whatsapp clicks).
 */
export default function OnboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900">{children}</div>
  );
}
