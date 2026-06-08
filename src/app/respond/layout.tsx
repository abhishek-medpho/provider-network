/**
 * Public layout for /respond/* — the gig broadcast "I'm available" page.
 * No auth, mobile-first, forced light theme (WhatsApp link clicks).
 */
export default function RespondLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900">{children}</div>
  );
}
