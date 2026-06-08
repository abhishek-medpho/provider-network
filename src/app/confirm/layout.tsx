/**
 * Public layout for /confirm/* — the gig reconfirmation page. No auth,
 * mobile-first, forced light theme.
 */
export default function ConfirmLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900">{children}</div>
  );
}
