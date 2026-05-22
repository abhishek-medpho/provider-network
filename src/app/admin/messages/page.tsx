import { prisma } from "@/lib/db";
import Link from "next/link";
import { MessageTemplateKind } from "@prisma/client";
import { Plus, Search, X, MessageSquare } from "lucide-react";
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
  kind?: string;
  active?: string;
  profileType?: string;
}>;

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { q, kind, active, profileType } = await searchParams;

  const templates = await prisma.messageTemplate.findMany({
    where: {
      ...(active === "0" ? { active: false } : active === "1" ? { active: true } : {}),
      ...(kind ? { kind: kind as MessageTemplateKind } : {}),
      ...(profileType
        ? profileType === "_none"
          ? { profileTypeId: null }
          : { profileTypeId: profileType }
        : {}),
      ...(q
        ? {
            OR: [
              { code: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
              { body: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { profileType: { select: { code: true, label: true } } },
    orderBy: [{ kind: "asc" }, { name: "asc" }],
  });

  const profileTypes = await prisma.profileType.findMany({
    where: { active: true },
    select: { id: true, label: true, code: true },
    orderBy: { sortOrder: "asc" },
  });

  const hasFilters = q || kind || profileType || active;

  return (
    <div className="p-6 md:p-8 space-y-5">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1>Message Templates</h1>
          <p className="text-sm text-muted-foreground">
            WhatsApp copy for invites, reminders, and confirmations.{" "}
            <code className="text-xs font-mono px-1 py-px rounded bg-muted">
              {`{{name}}`}
            </code>{" "}
            variables substitute at send time.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/messages/new">
            <Plus className="size-4" />
            New template
          </Link>
        </Button>
      </header>

      <Card>
        <CardContent className="p-4">
          <form
            method="GET"
            action="/admin/messages"
            className="flex flex-wrap items-center gap-2"
          >
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                type="search"
                name="q"
                defaultValue={q ?? ""}
                placeholder="Search code, name, or body…"
                className="pl-8"
              />
            </div>
            <select
              name="kind"
              defaultValue={kind ?? ""}
              className="h-9 px-3 rounded-md border bg-background text-sm"
            >
              <option value="">All kinds</option>
              {Object.keys(MessageTemplateKind).map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <select
              name="profileType"
              defaultValue={profileType ?? ""}
              className="h-9 px-3 rounded-md border bg-background text-sm"
            >
              <option value="">Any scope</option>
              <option value="_none">Global (no scope)</option>
              {profileTypes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <select
              name="active"
              defaultValue={active ?? ""}
              className="h-9 px-3 rounded-md border bg-background text-sm"
            >
              <option value="">All</option>
              <option value="1">Active</option>
              <option value="0">Inactive</option>
            </select>
            <Button type="submit" variant="secondary" size="sm">
              Apply
            </Button>
            {hasFilters && (
              <Button variant="ghost" size="sm" asChild>
                <Link href="/admin/messages">
                  <X className="size-3.5" />
                  Clear
                </Link>
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <MessageSquare className="size-8 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              No templates match these filters.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Code / Name</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Lang</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Variables</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="py-2.5">
                    <Link
                      href={`/admin/messages/${t.id}`}
                      className="font-medium hover:underline"
                    >
                      {t.name}
                    </Link>
                    <div className="font-mono text-[11px] text-muted-foreground mt-0.5">
                      {t.code}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px]">
                      {t.kind}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground uppercase tabular-nums">
                    {t.language}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {t.profileType ? t.profileType.label : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {t.variables.length === 0 && (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                      {t.variables.slice(0, 4).map((v) => (
                        <code
                          key={v}
                          className="font-mono text-[10px] px-1 py-px rounded bg-muted text-foreground/80"
                        >
                          {v}
                        </code>
                      ))}
                      {t.variables.length > 4 && (
                        <span className="text-xs text-muted-foreground">
                          +{t.variables.length - 4}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {t.active ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-success">
                        <span className="size-1.5 rounded-full bg-success" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                        <span className="size-1.5 rounded-full bg-muted-foreground" />
                        Inactive
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        {templates.length} template{templates.length === 1 ? "" : "s"} shown.
      </p>
    </div>
  );
}
