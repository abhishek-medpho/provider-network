/**
 * Public layout for /gig-complete/* — the SOP completion form the assigned
 * provider fills after doing the job. No auth (gig-scoped link), mobile-
 * first, forced light theme.
 */
export default function GigCompleteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900">{children}</div>
  );
}
