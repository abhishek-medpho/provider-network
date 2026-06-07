/**
 * Public layout for /offer/* — the job offer accept/decline page providers
 * open from their WhatsApp/email. No auth, mobile-first, forced light theme
 * (same rationale as /onboard: WhatsApp link clicks on Android default to
 * light and dark inversions look broken).
 */
export default function OfferLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900">{children}</div>
  );
}
