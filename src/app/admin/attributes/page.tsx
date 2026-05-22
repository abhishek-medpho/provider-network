import { prisma } from "@/lib/db";
import Link from "next/link";
import { AttributeType } from "@prisma/client";
import { Plus, Search, X, ListChecks } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  type?: string;
  archived?: string;
  category?: string;
}>;

export default async function AttributesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { q, type, archived, category } = await searchParams;

  const attributes = await prisma.attribute.findMany({
    where: {
      ...(archived === "1"
        ? { NOT: { archivedAt: null } }
        : { archivedAt: null }),
      ...(type ? { type: type as AttributeType } : {}),
      ...(category ? { category } : {}),
      ...(q
        ? {
            OR: [
              { key: { contains: q, mode: "insensitive" } },
              { label: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ category: "asc" }, { label: "asc" }],
    include: { _count: { select: { profileTypeAttrs: true } } },
  });

  const allCategories = await prisma.attribute.findMany({
    where: { archivedAt: null, category: { not: null } },
    distinct: ["category"],
    select: { category: true },
    orderBy: { category: "asc" },
  });

  const hasFilters = q || type || category || archived === "1";

  return (
    <div className="p-6 md:p-8 space-y-5">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1>Attributes</h1>
          <p className="text-sm text-muted-foreground">
            Atomic data points captured per care provider. Profile types bundle
            these into roles.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/attributes/new">
            <Plus className="size-4" />
            New attribute
          </Link>
        </Button>
      </header>

      <Card>
        <CardContent className="p-4">
          <form
            method="GET"
            action="/admin/attributes"
            className="flex flex-wrap items-center gap-2"
          >
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                type="search"
                name="q"
                defaultValue={q ?? ""}
                placeholder="Search key or label…"
                className="pl-8"
              />
            </div>
            <select
              name="type"
              defaultValue={type ?? ""}
              className="h-9 px-3 rounded-md border bg-background text-sm"
            >
              <option value="">All types</option>
              {Object.keys(AttributeType).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select
              name="category"
              defaultValue={category ?? ""}
              className="h-9 px-3 rounded-md border bg-background text-sm"
            >
              <option value="">All categories</option>
              {allCategories
                .map((c) => c.category)
                .filter(Boolean)
                .map((c) => (
                  <option key={c!} value={c!}>
                    {c}
                  </option>
                ))}
            </select>
            <select
              name="archived"
              defaultValue={archived ?? "0"}
              className="h-9 px-3 rounded-md border bg-background text-sm"
            >
              <option value="0">Active only</option>
              <option value="1">Archived only</option>
            </select>
            <Button type="submit" variant="secondary" size="sm">
              Apply
            </Button>
            {hasFilters && (
              <Button variant="ghost" size="sm" asChild>
                <Link href="/admin/attributes">
                  <X className="size-3.5" />
                  Clear
                </Link>
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      {attributes.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <ListChecks className="size-8 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              No attributes match these filters.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Key / Label</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>PII</TableHead>
                <TableHead className="text-right">Used in</TableHead>
                <TableHead>Flags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attributes.map((a) => {
                const usedIn = (
                  a as { _count: { profileTypeAttrs: number } } & typeof a
                )._count.profileTypeAttrs;
                return (
                  <TableRow key={a.id}>
                    <TableCell className="py-2.5">
                      <Link
                        href={`/admin/attributes/${a.id}`}
                        className="font-medium hover:underline"
                      >
                        {a.label}
                      </Link>
                      <div className="font-mono text-[11px] text-muted-foreground mt-0.5">
                        {a.key}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {a.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {a.category ?? "—"}
                    </TableCell>
                    <TableCell>
                      <PiiBadge level={a.piiLevel} />
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                      {usedIn} role{usedIn === 1 ? "" : "s"}
                    </TableCell>
                    <TableCell className="space-x-1">
                      {a.isSystem && (
                        <Badge variant="outline" className="text-[10px]">
                          system
                        </Badge>
                      )}
                      {a.isSearchable && (
                        <Badge variant="secondary" className="text-[10px]">
                          searchable
                        </Badge>
                      )}
                      {a.archivedAt && (
                        <Badge variant="outline" className="text-[10px]">
                          archived
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Showing {attributes.length} attribute{attributes.length === 1 ? "" : "s"}.
      </p>
    </div>
  );
}

function PiiBadge({ level }: { level: string }) {
  if (level === "NONE")
    return <span className="text-xs text-muted-foreground">—</span>;
  const tone =
    level === "HIGH"
      ? "bg-destructive/15 text-destructive"
      : level === "MEDIUM"
        ? "bg-warning/15 text-warning"
        : "bg-success/15 text-success";
  return (
    <span
      className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${tone}`}
    >
      {level}
    </span>
  );
}
