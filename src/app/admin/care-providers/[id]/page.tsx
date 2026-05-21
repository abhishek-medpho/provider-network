import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CareProviderStatus } from "@prisma/client";
import { setCareProviderStatus } from "@/lib/actions/care-providers";

const STATUS_COLORS: Record<string, string> = {
  LEAD: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400",
  ENGAGED: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400",
  PROFILED:
    "bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400",
  PENDING_VERIFICATION:
    "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400",
  VERIFIED:
    "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400",
  ACTIVE:
    "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400",
  PAUSED: "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400",
  BLOCKED: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400",
  OPTED_OUT: "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400",
  REJECTED: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400",
};

const MEMBER_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400",
  SENT: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400",
  ENGAGED:
    "bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400",
  SUBMITTED:
    "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400",
  COMPLETED:
    "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400",
  OPTED_OUT: "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400",
  FAILED: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400",
};

const EVENT_LABELS: Record<string, string> = {
  FORM_OPENED: "Form opened",
  FORM_SUBMITTED: "Form submitted",
  INVITE_SENT: "Invite sent",
  STATUS_CHANGED: "Status changed",
  MESSAGE_SENT: "Message sent",
};

type Option = { value: string; label: string };

export default async function CareProviderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const provider = await prisma.careProvider.findUnique({
    where: { id },
    include: {
      profileType: { select: { code: true, label: true } },
      leadBatch: { select: { name: true, source: true, filename: true } },
      campaignMemberships: {
        include: {
          campaign: { select: { id: true, name: true, status: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      events: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      whatsappMessages: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { messageTemplate: { select: { name: true, code: true } } },
      },
      formResponses: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  if (!provider) notFound();

  // Resolve attribute defs once for all keys present on this provider
  const attrValues =
    (provider.attributes as Record<string, unknown>) ?? {};
  const attrKeys = Object.keys(attrValues);
  const attrDefs = attrKeys.length
    ? await prisma.attribute.findMany({
        where: { key: { in: attrKeys } },
      })
    : [];
  const defByKey = new Map(attrDefs.map((a) => [a.key, a]));

  // Group by category
  type Row = {
    key: string;
    label: string;
    value: unknown;
    type: string;
    category: string;
    piiLevel: string;
  };
  const rows: Row[] = attrKeys.map((k) => {
    const def = defByKey.get(k);
    return {
      key: k,
      label: def?.label ?? k,
      value: attrValues[k],
      type: def?.type ?? "TEXT",
      category: def?.category ?? "other",
      piiLevel: def?.piiLevel ?? "NONE",
    };
  });

  const grouped = rows.reduce<Record<string, Row[]>>((acc, r) => {
    (acc[r.category] = acc[r.category] || []).push(r);
    return acc;
  }, {});

  async function statusAction(formData: FormData) {
    "use server";
    const status = String(formData.get("status") ?? "");
    const reason = String(formData.get("reason") ?? "") || undefined;
    await setCareProviderStatus(id, status, reason);
  }

  const nextStatuses: Record<string, string[]> = {
    LEAD: ["ENGAGED", "BLOCKED", "OPTED_OUT"],
    ENGAGED: ["PROFILED", "BLOCKED", "OPTED_OUT"],
    PROFILED: ["PENDING_VERIFICATION", "VERIFIED", "REJECTED"],
    PENDING_VERIFICATION: ["VERIFIED", "REJECTED"],
    VERIFIED: ["ACTIVE", "PAUSED", "BLOCKED"],
    ACTIVE: ["PAUSED", "BLOCKED"],
    PAUSED: ["ACTIVE", "BLOCKED"],
    BLOCKED: ["LEAD"],
    OPTED_OUT: [],
    REJECTED: ["LEAD"],
  };

  return (
    <div className="px-8 py-8 max-w-5xl">
      <Link
        href="/admin/care-providers"
        className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 mb-4 inline-block"
      >
        ← All care providers
      </Link>

      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              {provider.name ?? "(no name)"}
            </h1>
            <span
              className={`text-xs uppercase tracking-wide px-1.5 py-0.5 rounded ${STATUS_COLORS[provider.status]}`}
            >
              {provider.status}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
            <span className="font-mono">{provider.phone}</span>
            {provider.email && <span>· {provider.email}</span>}
            {provider.profileType && (
              <span>· {provider.profileType.label}</span>
            )}
            {provider.pincodeHome && (
              <span>· {provider.pincodeHome}</span>
            )}
          </div>
        </div>
      </header>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: attributes (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* System */}
          <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
            <h2 className="font-medium text-zinc-900 dark:text-zinc-50 mb-3">
              System
            </h2>
            <dl className="grid grid-cols-[140px_1fr] gap-y-2 text-sm">
              <dt className="text-zinc-500 dark:text-zinc-400">Lead source</dt>
              <dd className="text-zinc-900 dark:text-zinc-50">
                {provider.leadBatch?.name ??
                  provider.source ?? (
                    <span className="text-zinc-400">—</span>
                  )}
              </dd>
              <dt className="text-zinc-500 dark:text-zinc-400">Language</dt>
              <dd className="text-zinc-900 dark:text-zinc-50">
                {provider.language}
              </dd>
              <dt className="text-zinc-500 dark:text-zinc-400">Created</dt>
              <dd className="text-zinc-900 dark:text-zinc-50">
                {new Date(provider.createdAt).toLocaleString()}
              </dd>
              <dt className="text-zinc-500 dark:text-zinc-400">Last updated</dt>
              <dd className="text-zinc-900 dark:text-zinc-50">
                {new Date(provider.updatedAt).toLocaleString()}
              </dd>
              {provider.lastContactedAt && (
                <>
                  <dt className="text-zinc-500 dark:text-zinc-400">
                    Last contacted
                  </dt>
                  <dd className="text-zinc-900 dark:text-zinc-50">
                    {new Date(provider.lastContactedAt).toLocaleString()}
                  </dd>
                </>
              )}
              {provider.blockedReason && (
                <>
                  <dt className="text-zinc-500 dark:text-zinc-400">
                    Blocked reason
                  </dt>
                  <dd className="text-red-700 dark:text-red-400">
                    {provider.blockedReason}
                  </dd>
                </>
              )}
            </dl>
          </section>

          {/* Attributes grouped */}
          {rows.length === 0 && (
            <section className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 text-center">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No attribute data yet. Provider hasn&apos;t submitted any form.
              </p>
            </section>
          )}
          {Object.entries(grouped).map(([category, items]) => (
            <section
              key={category}
              className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5"
            >
              <h2 className="font-medium text-zinc-900 dark:text-zinc-50 mb-3 capitalize">
                {category}
              </h2>
              <dl className="grid grid-cols-[180px_1fr] gap-y-2.5 text-sm">
                {items.map((r) => (
                  <FieldRow key={r.key} row={r} defByKey={defByKey} />
                ))}
              </dl>
            </section>
          ))}
        </div>

        {/* Right: status, campaigns, events, messages */}
        <aside className="space-y-6">
          {/* Status changer */}
          <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
            <h2 className="font-medium text-zinc-900 dark:text-zinc-50 mb-3">
              Change status
            </h2>
            {nextStatuses[provider.status]?.length === 0 ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                No transitions available from {provider.status}.
              </p>
            ) : (
              <div className="space-y-2">
                {nextStatuses[provider.status]?.map((s) => (
                  <form key={s} action={statusAction}>
                    <input type="hidden" name="status" value={s} />
                    <button
                      type="submit"
                      className="w-full px-3 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 text-left"
                    >
                      →{" "}
                      <span
                        className={`text-xs uppercase tracking-wide px-1.5 py-0.5 rounded ${STATUS_COLORS[s]}`}
                      >
                        {s}
                      </span>
                    </button>
                  </form>
                ))}
              </div>
            )}
          </section>

          {/* Campaign memberships */}
          <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
            <h2 className="font-medium text-zinc-900 dark:text-zinc-50 mb-3">
              Campaigns ({provider.campaignMemberships.length})
            </h2>
            {provider.campaignMemberships.length === 0 ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Not in any campaign.
              </p>
            ) : (
              <ul className="space-y-2">
                {provider.campaignMemberships.map((m) => (
                  <li key={m.id} className="text-sm">
                    <Link
                      href={`/admin/campaigns/${m.campaign.id}`}
                      className="text-zinc-900 dark:text-zinc-50 hover:underline font-medium block"
                    >
                      {m.campaign.name}
                    </Link>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${MEMBER_STATUS_COLORS[m.status]}`}
                      >
                        {m.status}
                      </span>
                      {m.remindersSent > 0 && (
                        <span className="text-[10px] text-zinc-500">
                          · {m.remindersSent} reminder{m.remindersSent === 1 ? "" : "s"}
                        </span>
                      )}
                      <Link
                        href={`/onboard/${m.token}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-zinc-500 hover:underline ml-auto"
                      >
                        Form ↗
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Recent events */}
          <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
            <h2 className="font-medium text-zinc-900 dark:text-zinc-50 mb-3">
              Activity
            </h2>
            {provider.events.length === 0 ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                No events yet.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {provider.events.map((e) => (
                  <li key={e.id} className="text-sm">
                    <div className="font-medium text-zinc-900 dark:text-zinc-50">
                      {EVENT_LABELS[e.type] ?? e.type}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      {new Date(e.createdAt).toLocaleString()}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Recent WA messages */}
          <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
            <h2 className="font-medium text-zinc-900 dark:text-zinc-50 mb-3">
              WhatsApp messages
            </h2>
            {provider.whatsappMessages.length === 0 ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                No messages sent.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {provider.whatsappMessages.map((w) => (
                  <li key={w.id} className="text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-zinc-900 dark:text-zinc-50">
                        {w.messageTemplate?.name ?? "Custom"}
                      </span>
                      <span
                        className={`uppercase tracking-wide ${
                          w.status === "SENT" || w.status === "DELIVERED" || w.status === "READ"
                            ? "text-emerald-600"
                            : w.status === "FAILED"
                              ? "text-red-600"
                              : "text-zinc-500"
                        }`}
                      >
                        {w.status}
                      </span>
                    </div>
                    <p className="text-zinc-600 dark:text-zinc-400 line-clamp-2">
                      {w.body}
                    </p>
                    <div className="text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {new Date(w.createdAt).toLocaleString()}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function FieldRow({
  row,
  defByKey,
}: {
  row: {
    key: string;
    label: string;
    value: unknown;
    type: string;
    category: string;
    piiLevel: string;
  };
  defByKey: Map<string, { type: string; options: unknown }>;
}) {
  const def = defByKey.get(row.key);
  const rendered = formatValue(row.value, row.type, def?.options);
  return (
    <>
      <dt className="text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wide pt-0.5">
        {row.label}
        {row.piiLevel === "MEDIUM" || row.piiLevel === "HIGH" ? (
          <span
            className="ml-1 text-[9px] px-1 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 uppercase"
            title={`PII: ${row.piiLevel}`}
          >
            PII
          </span>
        ) : null}
      </dt>
      <dd className="text-zinc-900 dark:text-zinc-50">{rendered}</dd>
    </>
  );
}

function formatValue(
  value: unknown,
  type: string,
  options: unknown,
): React.ReactNode {
  if (value === null || value === undefined || value === "")
    return <span className="text-zinc-400">—</span>;

  if (type === "SELFIE" || type === "FILE_IMAGE" || type === "FILE_DOC") {
    return <FileValue value={value} type={type} />;
  }

  if (type === "GEO_POINT") {
    return <GeoValue value={value} />;
  }

  if (type === "SINGLE_SELECT") {
    const opts = Array.isArray(options) ? (options as Option[]) : [];
    const found = opts.find((o) => o.value === value);
    return found ? found.label : String(value);
  }
  if (type === "MULTI_SELECT") {
    const arr = Array.isArray(value) ? value : [value];
    const opts = Array.isArray(options) ? (options as Option[]) : [];
    return (
      <div className="flex flex-wrap gap-1">
        {arr.map((v, i) => {
          const found = opts.find((o) => o.value === v);
          return (
            <span
              key={i}
              className="text-xs px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
            >
              {found ? found.label : String(v)}
            </span>
          );
        })}
      </div>
    );
  }
  if (type === "BOOLEAN") {
    return value === true ? "Yes" : "No";
  }
  if (type === "DATE") {
    return String(value);
  }
  return String(value);
}

function GeoValue({ value }: { value: unknown }) {
  if (!value || typeof value !== "object") {
    return <span className="text-zinc-400">—</span>;
  }
  const v = value as {
    lat?: number;
    lng?: number;
    accuracy?: number | null;
    capturedAt?: string;
  };
  if (typeof v.lat !== "number" || typeof v.lng !== "number") {
    return <span className="text-zinc-400">—</span>;
  }
  const mapsUrl = `https://www.google.com/maps?q=${v.lat},${v.lng}`;
  return (
    <div className="space-y-0.5">
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-zinc-900 dark:text-zinc-50 hover:underline font-mono text-xs"
      >
        📍 {v.lat.toFixed(5)}, {v.lng.toFixed(5)} ↗
      </a>
      <div className="text-xs text-zinc-500 dark:text-zinc-400">
        {v.accuracy != null ? `±${Math.round(v.accuracy)}m` : "accuracy unknown"}
        {v.capturedAt && (
          <span className="ml-2">
            · captured {new Date(v.capturedAt).toLocaleString()}
          </span>
        )}
      </div>
    </div>
  );
}

function FileValue({ value, type }: { value: unknown; type: string }) {
  if (!value || typeof value !== "object") {
    return <span className="text-zinc-400">—</span>;
  }
  const v = value as { url?: string; originalName?: string; mimeType?: string };
  if (!v.url) return <span className="text-zinc-400">—</span>;

  const isPdf = (v.mimeType ?? "").includes("pdf");
  if (isPdf || type === "FILE_DOC") {
    return (
      <a
        href={v.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
      >
        📄 {v.originalName ?? "Document"} ↗
      </a>
    );
  }
  // Image
  return (
    <a href={v.url} target="_blank" rel="noopener noreferrer" className="block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={v.url}
        alt={v.originalName ?? "Uploaded image"}
        className="w-32 h-32 rounded-md object-cover bg-zinc-100 border border-zinc-200 dark:border-zinc-800 hover:opacity-90"
      />
    </a>
  );
}
