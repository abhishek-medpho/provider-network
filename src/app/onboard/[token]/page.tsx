import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { renderSection } from "@/lib/onboard/blockRenderer";
import {
  submitOnboarding,
  recordFormOpened,
} from "@/lib/actions/onboard";
import type { FormSection, FormAction } from "@/lib/types/form";
import { SubmitButton } from "@/components/onboard/SubmitButton";
import { ScrollToFirstError } from "@/components/onboard/ScrollToFirstError";

/**
 * Parse a server-side validation error message back into a per-field map.
 * submitOnboarding throws errors like:
 *   "Validation failed — selfie: required; nurse_procedures: pick at least 3"
 * We re-derive { selfie: "required", nurse_procedures: "pick at least 3" }
 * so the renderer can paint specific blocks red and the scroll helper can
 * land the viewport on the first one.
 */
function parseFieldErrors(error: string | undefined): Map<string, string> {
  const map = new Map<string, string>();
  if (!error) return map;
  const decoded = decodeURIComponent(error);
  const prefix = "Validation failed —";
  if (!decoded.startsWith(prefix)) return map;
  const body = decoded.slice(prefix.length).trim();
  for (const part of body.split(";")) {
    const [k, ...rest] = part.split(":");
    if (!k || rest.length === 0) continue;
    map.set(k.trim(), rest.join(":").trim());
  }
  return map;
}

export const metadata: Metadata = {
  title: "Labstack Provider — Complete your profile",
  description:
    "Submit your details to start receiving job opportunities from Labstack.",
};

export default async function OnboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const fieldErrors = parseFieldErrors(error);

  const member = await prisma.campaignMember.findUnique({
    where: { token },
    include: {
      careProvider: { select: { id: true, name: true, attributes: true } },
      campaign: {
        include: {
          formTemplate: true,
          profileType: { select: { label: true, code: true } },
        },
      },
    },
  });

  if (!member) notFound();

  // Record open event (best-effort, doesn't block render)
  if (!member.engagedAt) {
    recordFormOpened(token).catch(() => {});
  }

  // Already submitted? Show a friendly state.
  if (member.submittedAt) {
    return (
      <main className="max-w-md mx-auto px-5 py-12">
        <div className="rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
          <div className="size-12 mx-auto rounded-full bg-emerald-50 flex items-center justify-center text-emerald-700 text-2xl mb-3">
            ✓
          </div>
          <h1 className="text-xl font-semibold text-zinc-900">
            Profile submitted
          </h1>
          <p className="text-sm text-zinc-600 mt-1.5">
            We&apos;ve already received your details. Our team will be in touch
            via WhatsApp.
          </p>
          <p className="text-xs text-zinc-500 mt-6">
            Powered by{" "}
            <a
              href="https://www.labstack.in"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-700 hover:text-zinc-900 underline underline-offset-2"
            >
              Labstack
            </a>
          </p>
        </div>
      </main>
    );
  }

  const form = member.campaign.formTemplate;
  if (!form) {
    return (
      <main className="max-w-md mx-auto px-5 py-10">
        <p className="text-sm text-zinc-600">
          This campaign isn&apos;t fully configured yet. Please check back later.
        </p>
      </main>
    );
  }

  const sections = (form.sections as unknown as FormSection[]) ?? [];
  const actions = (form.actions as unknown as FormAction[]) ?? [];

  // Resolve all referenced attributes in one query
  const attrIds = new Set<string>();
  for (const s of sections)
    for (const b of s.blocks)
      if (b.type === "ATTRIBUTE") attrIds.add(b.attributeId);

  const attrs = await prisma.attribute.findMany({
    where: { id: { in: Array.from(attrIds) } },
  });
  const attrById = new Map(attrs.map((a) => [a.id, a]));

  // Pre-fill values: merge system fields from CareProvider with the
  // attribute JSON. CSV-imported leads have name/phone/email set on the
  // CareProvider record before the form ever opens.
  const cp = await prisma.careProvider.findUnique({
    where: { id: member.careProvider.id },
    select: { name: true, phone: true, email: true, pincodeHome: true },
  });
  const attrValues =
    (member.careProvider.attributes as Record<string, unknown>) ?? {};
  const values: Record<string, unknown> = {
    ...(cp?.name && !attrValues.full_name ? { full_name: cp.name } : {}),
    ...(cp?.phone && !attrValues.phone ? { phone: cp.phone } : {}),
    ...(cp?.email && !attrValues.email ? { email: cp.email } : {}),
    ...(cp?.pincodeHome && !attrValues.pincode_home
      ? { pincode_home: cp.pincodeHome }
      : {}),
    ...attrValues,
  };

  // Attribute keys that must not be edited by the provider (we use phone as
  // their identity; changing it would break the token mapping).
  const lockedAttributeKeys = new Set<string>(["phone"]);

  const context = {}; // onboarding has no patient/appointment context

  async function action(formData: FormData) {
    "use server";
    const { redirect } = await import("next/navigation");
    try {
      await submitOnboarding(token, formData);
    } catch (err) {
      // Re-throw NEXT_REDIRECT (success path) — Next.js uses thrown errors
      // to signal redirects internally.
      if (
        err &&
        typeof err === "object" &&
        "digest" in err &&
        String((err as { digest: string }).digest).startsWith("NEXT_REDIRECT")
      ) {
        throw err;
      }

      // Translate raw error text into something a care provider can act on.
      // Server-internal details (stack traces, Prisma codes, etc.) stay in
      // the logs; the user gets a friendly redirect.
      const raw = err instanceof Error ? err.message : "";
      console.error("[onboard] submit failed:", err);

      let friendly: string;
      if (raw.startsWith("Validation failed")) {
        // Already user-facing — pass through as-is.
        friendly = raw;
      } else if (/EACCES|ENOSPC|EBADF|ENOENT/.test(raw)) {
        friendly =
          "We couldn't save your uploaded files. Please try again or contact support.";
      } else if (/Invalid or expired link/i.test(raw)) {
        friendly =
          "This link has expired. Please request a fresh link from Labstack.";
      } else if (/connection|timeout|ECONNREFUSED/i.test(raw)) {
        friendly =
          "Our servers are temporarily unreachable. Please try again in a minute.";
      } else {
        friendly =
          "Something went wrong on our end. Please try again, or contact Labstack if it keeps failing.";
      }
      redirect(`/onboard/${token}?error=${encodeURIComponent(friendly)}`);
    }
  }

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      {/* Brand bar */}
      <div className="flex items-center justify-between mb-5 px-1">
        <a
          href="https://www.labstack.in"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2"
        >
          <div className="size-8 rounded-md bg-zinc-900 text-white flex items-center justify-center text-sm font-bold">
            L
          </div>
          <span className="text-sm font-semibold text-zinc-900">Labstack</span>
        </a>
        <span className="text-xs text-zinc-500">
          Step {sections.length > 0 ? "1" : "—"} of {sections.length}
        </span>
      </div>

      <header className="mb-5 px-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          {form.name}
        </h1>
        <p className="text-sm text-zinc-600 mt-1">
          {member.campaign.profileType.label} · {sections.length} section
          {sections.length === 1 ? "" : "s"} · takes ~3 min
        </p>
      </header>

      {error && (
        <>
          <ScrollToFirstError />
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 shadow-sm">
            <strong className="block mb-1 text-red-900">
              {fieldErrors.size > 0
                ? `Please fix ${fieldErrors.size} field${fieldErrors.size === 1 ? "" : "s"} below`
                : "We couldn't submit your form"}
            </strong>
            {fieldErrors.size > 0 ? (
              <ul className="mt-1 list-disc list-inside space-y-0.5">
                {Array.from(fieldErrors.entries()).map(([key, msg]) => {
                  const attr = Array.from(attrById.values()).find(
                    (a) => a.key === key,
                  );
                  const label = attr?.label ?? key;
                  return (
                    <li key={key}>
                      <a
                        href={`#field-${key}`}
                        className="underline underline-offset-2 hover:text-red-700"
                      >
                        {label}
                      </a>
                      {": "}
                      {msg}
                    </li>
                  );
                })}
              </ul>
            ) : (
              decodeURIComponent(error)
            )}
          </div>
        </>
      )}

      <form action={action} className="space-y-4">
        {sections.map((section) =>
          renderSection({
            section,
            attrById,
            values,
            context,
            lockedAttributeKeys,
            fieldErrors,
          }),
        )}

        <div className="pt-2 pb-10 flex flex-col gap-2 sm:flex-row sm:justify-end">
          {actions.length === 0 && <SubmitButton label="Submit" />}
          {actions.map((a) => (
            <SubmitButton
              key={a.key}
              label={a.label}
              name="_action"
              value={a.kind}
              className={buttonClass(a.style)}
            />
          ))}
        </div>
      </form>

      <footer className="text-center text-xs text-zinc-500 pb-6 space-y-1">
        <p>
          Powered by{" "}
          <a
            href="https://www.labstack.in"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-700 hover:text-zinc-900 underline underline-offset-2"
          >
            Labstack
          </a>
          {" · "}
          <a
            href="https://www.labstack.in"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-700 hover:text-zinc-900 underline underline-offset-2"
          >
            www.labstack.in
          </a>
        </p>
        <p>Your data is secure and only seen by our verification team.</p>
      </footer>
    </main>
  );
}

function buttonClass(style?: string) {
  const base =
    "w-full sm:w-auto px-6 py-3 rounded-lg text-base font-medium transition-colors";
  switch (style) {
    case "DANGER":
      return `${base} bg-white text-red-700 border border-red-200 hover:bg-red-50`;
    case "SECONDARY":
      return `${base} bg-white text-zinc-900 border border-zinc-300 hover:bg-zinc-50`;
    case "PRIMARY":
    default:
      return `${base} bg-zinc-900 text-white hover:bg-zinc-800`;
  }
}
