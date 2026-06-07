import { prisma } from "@/lib/db";
import Link from "next/link";
import { Plus, Briefcase, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Jobs" };

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  DRAFT: "outline",
  OPEN: "default",
  FILLED: "secondary",
  CLOSED: "outline",
  CANCELLED: "destructive",
};

export default async function JobsPage() {
  const jobs = await prisma.job.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      profileType: { select: { label: true } },
      _count: { select: { offers: true } },
    },
    take: 100,
  });

  // Accepted counts per job for the fill indicator.
  const acceptedByJob = new Map<string, number>();
  if (jobs.length) {
    const accepted = await prisma.jobOffer.groupBy({
      by: ["jobId"],
      where: { jobId: { in: jobs.map((j) => j.id) }, status: "ACCEPTED" },
      _count: { _all: true },
    });
    for (const a of accepted) acceptedByJob.set(a.jobId, a._count._all);
  }

  return (
    <div className="p-6 md:p-8 space-y-5">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1>Jobs</h1>
          <p className="text-sm text-muted-foreground">
            Open positions. Match active providers by area + skills and send
            offers.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/jobs/new">
            <Plus className="size-4" />
            New job
          </Link>
        </Button>
      </header>

      {jobs.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Briefcase className="size-6 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              No jobs yet. Create one to start matching providers.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Title</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Area</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Offers</TableHead>
                <TableHead className="text-right">Filled</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((j) => (
                <TableRow key={j.id}>
                  <TableCell className="py-2.5">
                    <Link
                      href={`/admin/jobs/${j.id}`}
                      className="font-medium hover:underline"
                    >
                      {j.title}
                    </Link>
                    {j.shiftType && (
                      <div className="text-xs text-muted-foreground">
                        {j.shiftType}
                        {j.payText ? ` · ${j.payText}` : ""}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {j.profileType.label}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {j.pincode ?? (j.lat != null ? "geo" : "—")}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={STATUS_VARIANT[j.status] ?? "outline"}
                      className="text-[10px]"
                    >
                      {j.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                    {j._count.offers}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {acceptedByJob.get(j.id) ?? 0}/{j.slots}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/admin/jobs/${j.id}`}
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
