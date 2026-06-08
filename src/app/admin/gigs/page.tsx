import { prisma } from "@/lib/db";
import Link from "next/link";
import { Plus, Briefcase, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Gigs" };

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  DRAFT: "outline",
  OPEN: "secondary",
  ASSIGNED: "secondary",
  CONFIRMED: "default",
  COMPLETED: "default",
  CANCELLED: "destructive",
};

const TYPE_LABEL: Record<string, string> = {
  SAMPLE_COLLECTION: "Sample pickup",
  HOME_NURSING_VISIT: "Nursing visit",
  OTHER: "Other",
};

function fmt(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(new Date(d));
}

export default async function GigsPage() {
  const gigs = await prisma.gig.findMany({
    orderBy: { scheduledFor: "desc" },
    include: {
      profileType: { select: { label: true } },
      assignedProvider: { select: { name: true, phone: true } },
      _count: { select: { responses: true } },
    },
    take: 100,
  });

  // Interested counts per gig.
  const interestedByGig = new Map<string, number>();
  if (gigs.length) {
    const grouped = await prisma.gigResponse.groupBy({
      by: ["gigId"],
      where: { gigId: { in: gigs.map((g) => g.id) }, status: "INTERESTED" },
      _count: { _all: true },
    });
    for (const g of grouped) interestedByGig.set(g.gigId, g._count._all);
  }

  return (
    <div className="p-6 md:p-8 space-y-5">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1>Gigs</h1>
          <p className="text-sm text-muted-foreground">
            Transactional dispatch — broadcast a request, pick a willing
            provider, confirm, complete.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/gigs/new">
            <Plus className="size-4" />
            New gig
          </Link>
        </Button>
      </header>

      {gigs.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Briefcase className="size-6 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              No gigs yet. Create one to dispatch a request.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Gig</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>When</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Willing</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gigs.map((g) => (
                <TableRow key={g.id}>
                  <TableCell className="py-2.5">
                    <Link
                      href={`/admin/gigs/${g.id}`}
                      className="font-medium hover:underline"
                    >
                      {g.title}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {g.profileType.label}
                      {g.siteArea ? ` · ${g.siteArea}` : g.pincode ? ` · ${g.pincode}` : ""}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {TYPE_LABEL[g.type] ?? g.type}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {fmt(g.scheduledFor)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={STATUS_VARIANT[g.status] ?? "outline"}
                      className="text-[10px]"
                    >
                      {g.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                    {interestedByGig.get(g.id) ?? 0}
                  </TableCell>
                  <TableCell className="text-sm">
                    {g.assignedProvider ? (
                      <span className="text-foreground">
                        {g.assignedProvider.name ?? g.assignedProvider.phone}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/admin/gigs/${g.id}`}
                      className="text-muted-foreground hover:text-foreground inline-flex"
                    >
                      <ArrowUpRight className="size-4" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
