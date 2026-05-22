import { prisma } from "@/lib/db";
import Link from "next/link";
import { CareProviderStatus } from "@prisma/client";
import { Search, X } from "lucide-react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type SearchParams = Promise<{
  q?: string;
  status?: string;
  profileType?: string;
  pincode?: string;
}>;

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

export default async function CareProvidersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { q, status, profileType, pincode } = await searchParams;

  const providers = await prisma.careProvider.findMany({
    where: {
      ...(status ? { status: status as CareProviderStatus } : {}),
      ...(profileType ? { profileTypeId: profileType } : {}),
      ...(pincode ? { pincodeHome: pincode } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { phone: { contains: q } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      profileType: { select: { code: true, label: true } },
      leadBatch: { select: { name: true } },
      _count: { select: { campaignMemberships: true } },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 200,
  });

  const profileTypes = await prisma.profileType.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, label: true },
  });

  const statusCountsRaw = await prisma.careProvider.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const statusCounts: Record<string, number> = {};
  for (const r of statusCountsRaw) statusCounts[r.status] = r._count._all;
  const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);

  const filteredAny = q || status || profileType || pincode;

  return (
    <div className="p-6 md:p-8 space-y-5">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1>Care Providers</h1>
          <p className="text-sm text-muted-foreground">
            {total.toLocaleString()} total · status flows LEAD → ENGAGED →
            PROFILED → VERIFIED → ACTIVE
          </p>
        </div>
      </header>

      {/* Status filter strip */}
      <div className="flex flex-wrap gap-1.5">
        <Link
          href="/admin/care-providers"
          className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
            !status
              ? "bg-foreground text-background border-foreground"
              : "bg-card hover:bg-accent border-border text-muted-foreground"
          }`}
        >
          All <span className="tabular-nums opacity-70 ml-1">{total}</span>
        </Link>
        {Object.keys(CareProviderStatus).map((s) => (
          <Link
            key={s}
            href={`/admin/care-providers?status=${s}`}
            className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
              status === s
                ? "bg-foreground text-background border-foreground"
                : "bg-card hover:bg-accent border-border text-muted-foreground"
            }`}
          >
            {s}
            <span className="tabular-nums opacity-70 ml-1">
              {statusCounts[s] ?? 0}
            </span>
          </Link>
        ))}
      </div>

      {/* Search + filters */}
      <Card>
        <CardContent className="p-4">
          <form
            method="GET"
            action="/admin/care-providers"
            className="flex flex-wrap items-center gap-2"
          >
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                type="search"
                name="q"
                defaultValue={q ?? ""}
                placeholder="Search name, phone, or email…"
                className="pl-8"
              />
            </div>
            <select
              name="profileType"
              defaultValue={profileType ?? ""}
              className="h-9 px-3 rounded-md border bg-background text-sm"
            >
              <option value="">All roles</option>
              {profileTypes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <Input
              type="text"
              name="pincode"
              defaultValue={pincode ?? ""}
              placeholder="Pincode"
              className="w-28"
            />
            {status && <input type="hidden" name="status" value={status} />}
            <Button type="submit" variant="secondary" size="sm">
              Apply
            </Button>
            {filteredAny && (
              <Button variant="ghost" size="sm" asChild>
                <Link href="/admin/care-providers">
                  <X className="size-3.5" />
                  Clear
                </Link>
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Results */}
      {providers.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-sm text-muted-foreground">
              No care providers match these filters.
            </p>
            {filteredAny && (
              <Button variant="link" asChild className="mt-2">
                <Link href="/admin/care-providers">Clear filters</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pincode</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Campaigns</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {providers.map((p) => {
                const initials = (p.name ?? p.phone ?? "?")
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((s) => s[0]?.toUpperCase())
                  .join("");
                return (
                  <TableRow key={p.id}>
                    <TableCell className="py-2.5">
                      <Link
                        href={`/admin/care-providers/${p.id}`}
                        className="flex items-center gap-2.5 group"
                      >
                        <Avatar className="size-7">
                          <AvatarFallback className="text-[10px]">
                            {initials || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="font-medium group-hover:underline truncate">
                            {p.name ?? (
                              <span className="text-muted-foreground italic">
                                Unnamed
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-mono text-muted-foreground">
                            {p.phone}
                          </div>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.profileType?.label ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={STATUS_VARIANT[p.status] ?? "outline"}
                        className="text-[10px] font-medium tracking-wide"
                      >
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground tabular-nums">
                      {p.pincodeHome ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate max-w-[180px]">
                      {p.leadBatch?.name ?? p.source ?? "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                      {p._count.campaignMemberships}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {relTime(p.updatedAt)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        {providers.length === 200
          ? "Showing first 200 — refine filters to see more"
          : `${providers.length} provider${providers.length === 1 ? "" : "s"} shown`}
      </p>
    </div>
  );
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
