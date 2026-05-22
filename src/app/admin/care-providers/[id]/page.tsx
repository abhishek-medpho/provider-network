import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { setCareProviderStatus } from "@/lib/actions/care-providers";
import {
  ChevronLeft,
  Phone,
  Mail,
  MapPin,
  Calendar,
  ExternalLink,
  Inbox,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  LEAD: "outline",
  ENGAGED: "secondary",
  PROFILED: "secondary",
  PENDING_VERIFICATION: "secondary",
  VERIFIED: "default",
  ACTIVE: "default",
  PAUSED: "outline",
  BLOCKED: "destructive",
  OPTED_OUT: "outline",
  REJECTED: "destructive",
};

const EVENT_LABELS: Record<string, string> = {
  FORM_OPENED: "Form opened",
  FORM_SUBMITTED: "Form submitted",
  INVITE_SENT: "Invite sent",
  STATUS_CHANGED: "Status changed",
  MESSAGE_SENT: "Message sent",
  REMINDER_SENT: "Reminder sent",
};

const NEXT_STATUSES: Record<string, string[]> = {
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
      events: { orderBy: { createdAt: "desc" }, take: 50 },
      whatsappMessages: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { messageTemplate: { select: { name: true, code: true } } },
      },
      formResponses: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });

  if (!provider) notFound();

  const attrValues = (provider.attributes as Record<string, unknown>) ?? {};
  const attrKeys = Object.keys(attrValues);
  const attrDefs = attrKeys.length
    ? await prisma.attribute.findMany({ where: { key: { in: attrKeys } } })
    : [];
  const defByKey = new Map(attrDefs.map((a) => [a.key, a]));

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

  const display = provider.name ?? provider.phone;
  const initials = display
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  const transitions = NEXT_STATUSES[provider.status] ?? [];

  return (
    <div className="p-6 md:p-8 space-y-5 max-w-6xl">
      {/* Back */}
      <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
        <Link href="/admin/care-providers">
          <ChevronLeft className="size-4" />
          All care providers
        </Link>
      </Button>

      {/* Header */}
      <header className="flex items-start gap-4 flex-wrap">
        <Avatar className="size-12">
          <AvatarFallback className="text-base">{initials || "?"}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">
              {provider.name ?? (
                <span className="text-muted-foreground italic">Unnamed</span>
              )}
            </h1>
            <Badge
              variant={STATUS_VARIANT[provider.status] ?? "outline"}
              className="text-[10px] font-medium"
            >
              {provider.status}
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1 flex-wrap">
            <span className="flex items-center gap-1 font-mono">
              <Phone className="size-3.5" />
              {provider.phone}
            </span>
            {provider.email && (
              <span className="flex items-center gap-1">
                <Mail className="size-3.5" />
                {provider.email}
              </span>
            )}
            {provider.profileType && (
              <span className="flex items-center gap-1">
                <Inbox className="size-3.5" />
                {provider.profileType.label}
              </span>
            )}
            {provider.pincodeHome && (
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5" />
                {provider.pincodeHome}
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Left: 2/3 */}
        <div className="lg:col-span-2 space-y-5">
          {/* System */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">System</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[140px_1fr] gap-y-2 text-sm">
                <Label>Lead source</Label>
                <Value>
                  {provider.leadBatch?.name ?? provider.source ?? <Dash />}
                </Value>
                <Label>Language</Label>
                <Value>{provider.language}</Value>
                <Label>Created</Label>
                <Value>
                  {new Date(provider.createdAt).toLocaleString()}
                </Value>
                <Label>Last updated</Label>
                <Value>
                  {new Date(provider.updatedAt).toLocaleString()}
                </Value>
                {provider.lastContactedAt && (
                  <>
                    <Label>Last contacted</Label>
                    <Value>
                      {new Date(provider.lastContactedAt).toLocaleString()}
                    </Value>
                  </>
                )}
                {provider.blockedReason && (
                  <>
                    <Label>Blocked reason</Label>
                    <dd className="text-destructive text-sm">
                      {provider.blockedReason}
                    </dd>
                  </>
                )}
              </dl>
            </CardContent>
          </Card>

          {/* Attributes */}
          {rows.length === 0 ? (
            <Card>
              <CardContent className="p-10 text-center">
                <AlertCircle className="size-6 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  No attribute data yet. Provider hasn&apos;t submitted any form.
                </p>
              </CardContent>
            </Card>
          ) : (
            Object.entries(grouped).map(([category, items]) => (
              <Card key={category}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm capitalize">
                    {category}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {items.length} field{items.length === 1 ? "" : "s"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-[180px_1fr] gap-y-3 text-sm">
                    {items.map((r) => (
                      <FieldRow key={r.key} row={r} defByKey={defByKey} />
                    ))}
                  </dl>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Right: 1/3 */}
        <aside className="space-y-5">
          {/* Change status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Change status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {transitions.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No transitions available from {provider.status}.
                </p>
              ) : (
                transitions.map((s) => (
                  <form key={s} action={statusAction}>
                    <input type="hidden" name="status" value={s} />
                    <Button
                      type="submit"
                      variant="outline"
                      className="w-full justify-start font-normal"
                      size="sm"
                    >
                      → Move to
                      <Badge
                        variant={STATUS_VARIANT[s] ?? "outline"}
                        className="text-[10px] ml-1"
                      >
                        {s}
                      </Badge>
                    </Button>
                  </form>
                ))
              )}
            </CardContent>
          </Card>

          {/* Campaigns */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">
                Campaigns ({provider.campaignMemberships.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {provider.campaignMemberships.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Not in any campaign.
                </p>
              ) : (
                provider.campaignMemberships.map((m) => (
                  <div key={m.id} className="text-sm space-y-1">
                    <Link
                      href={`/admin/campaigns/${m.campaign.id}`}
                      className="font-medium hover:underline block truncate"
                    >
                      {m.campaign.name}
                    </Link>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="text-[10px]">
                        {m.status}
                      </Badge>
                      {m.remindersSent > 0 && (
                        <span className="text-[11px] text-muted-foreground">
                          {m.remindersSent} reminder
                          {m.remindersSent === 1 ? "" : "s"}
                        </span>
                      )}
                      <a
                        href={`/onboard/${m.token}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-muted-foreground hover:text-foreground ml-auto inline-flex items-center gap-0.5"
                      >
                        Form
                        <ExternalLink className="size-3" />
                      </a>
                    </div>
                    {m !== provider.campaignMemberships.at(-1) && (
                      <Separator className="mt-2" />
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Activity */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {provider.events.length === 0 ? (
                <p className="text-xs text-muted-foreground">No events yet.</p>
              ) : (
                <ul className="space-y-3 relative before:absolute before:left-[5px] before:top-1 before:bottom-1 before:w-px before:bg-border">
                  {provider.events.slice(0, 8).map((e) => (
                    <li
                      key={e.id}
                      className="text-sm pl-5 relative"
                    >
                      <span className="absolute left-0 top-1.5 size-2.5 rounded-full bg-foreground/80 ring-2 ring-background" />
                      <div className="text-xs font-medium">
                        {EVENT_LABELS[e.type] ?? prettify(e.type)}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {relTime(e.createdAt)}
                      </div>
                    </li>
                  ))}
                  {provider.events.length > 8 && (
                    <li className="text-[11px] text-muted-foreground pl-5">
                      + {provider.events.length - 8} more
                    </li>
                  )}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* WhatsApp messages */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">WhatsApp messages</CardTitle>
            </CardHeader>
            <CardContent>
              {provider.whatsappMessages.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No messages sent.
                </p>
              ) : (
                <ul className="space-y-3">
                  {provider.whatsappMessages.slice(0, 6).map((w) => (
                    <li key={w.id} className="text-xs space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate">
                          {w.messageTemplate?.name ?? "Custom"}
                        </span>
                        <MessageStatusPill status={w.status} />
                      </div>
                      <p className="text-muted-foreground line-clamp-2">
                        {w.body}
                      </p>
                      <div className="text-[10px] text-muted-foreground">
                        {relTime(w.createdAt)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

// ---------- atoms ----------

function Label({ children }: { children: React.ReactNode }) {
  return (
    <dt className="text-xs uppercase tracking-wider text-muted-foreground pt-0.5">
      {children}
    </dt>
  );
}
function Value({ children }: { children: React.ReactNode }) {
  return <dd className="text-sm">{children}</dd>;
}
function Dash() {
  return <span className="text-muted-foreground">—</span>;
}

function MessageStatusPill({ status }: { status: string }) {
  if (status === "SENT" || status === "DELIVERED" || status === "READ")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-success font-medium">
        <CheckCircle2 className="size-3" />
        {status}
      </span>
    );
  if (status === "FAILED")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-destructive font-medium">
        <AlertCircle className="size-3" />
        {status}
      </span>
    );
  if (status === "QUEUED" || status === "PENDING")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
        <Loader2 className="size-3" />
        {status}
      </span>
    );
  return (
    <span className="text-[10px] text-muted-foreground font-medium">
      {status}
    </span>
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
      <dt className="text-xs uppercase tracking-wider text-muted-foreground pt-1 flex items-center gap-1.5">
        <span>{row.label}</span>
        {(row.piiLevel === "MEDIUM" || row.piiLevel === "HIGH") && (
          <Badge
            variant="outline"
            className="text-[9px] px-1 py-0 h-3.5 text-warning border-warning/40"
            title={`PII: ${row.piiLevel}`}
          >
            PII
          </Badge>
        )}
      </dt>
      <dd className="text-sm">{rendered}</dd>
    </>
  );
}

function formatValue(
  value: unknown,
  type: string,
  options: unknown,
): React.ReactNode {
  if (value === null || value === undefined || value === "") return <Dash />;

  if (type === "SELFIE" || type === "FILE_IMAGE" || type === "FILE_DOC") {
    return <FileValue value={value} type={type} />;
  }

  if (type === "GEO_POINT") return <GeoValue value={value} />;

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
            <Badge key={i} variant="secondary" className="text-[10px]">
              {found ? found.label : String(v)}
            </Badge>
          );
        })}
      </div>
    );
  }
  if (type === "BOOLEAN") return value === true ? "Yes" : "No";
  if (type === "DATE") return String(value);
  return String(value);
}

function GeoValue({ value }: { value: unknown }) {
  if (!value || typeof value !== "object") return <Dash />;
  const v = value as {
    lat?: number;
    lng?: number;
    accuracy?: number | null;
    capturedAt?: string;
  };
  if (typeof v.lat !== "number" || typeof v.lng !== "number") return <Dash />;
  const mapsUrl = `https://www.google.com/maps?q=${v.lat},${v.lng}`;
  return (
    <div className="space-y-0.5">
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 hover:underline font-mono text-xs"
      >
        <MapPin className="size-3" />
        {v.lat.toFixed(5)}, {v.lng.toFixed(5)}
        <ExternalLink className="size-3" />
      </a>
      <div className="text-xs text-muted-foreground">
        {v.accuracy != null
          ? `±${Math.round(v.accuracy)}m`
          : "accuracy unknown"}
        {v.capturedAt && (
          <span className="ml-2">
            <Calendar className="inline size-3 mr-0.5" />
            {new Date(v.capturedAt).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
}

function FileValue({ value, type }: { value: unknown; type: string }) {
  if (!value || typeof value !== "object") return <Dash />;
  const v = value as { url?: string; originalName?: string; mimeType?: string };
  if (!v.url) return <Dash />;

  const isPdf = (v.mimeType ?? "").includes("pdf");
  if (isPdf || type === "FILE_DOC") {
    return (
      <a
        href={v.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border bg-muted/30 text-xs font-medium hover:bg-muted transition-colors"
      >
        📄 {v.originalName ?? "Document"}
        <ExternalLink className="size-3" />
      </a>
    );
  }
  return (
    <a href={v.url} target="_blank" rel="noopener noreferrer" className="block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={v.url}
        alt={v.originalName ?? "Uploaded image"}
        className="size-28 rounded-md object-cover border hover:opacity-90 transition-opacity"
      />
    </a>
  );
}

function prettify(s: string): string {
  return s
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function relTime(d: Date): string {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(d).toLocaleDateString();
}
