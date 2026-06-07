import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, MapPin, Users } from "lucide-react";
import { matchProvidersForJob } from "@/lib/jobs/matching";
import { dispatchJobOffers, setJobStatus } from "@/lib/actions/jobs";
import { DispatchOffers } from "./_components/DispatchOffers";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const OFFER_TONE: Record<string, string> = {
  PENDING: "bg-muted text-muted-foreground",
  SENT: "bg-muted text-foreground/70",
  VIEWED: "bg-foreground/10 text-foreground",
  ACCEPTED: "bg-success/15 text-success",
  DECLINED: "bg-destructive/15 text-destructive",
  EXPIRED: "bg-warning/15 text-warning",
  WITHDRAWN: "bg-muted text-muted-foreground",
};

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      profileType: { select: { label: true } },
      offers: {
        include: {
          careProvider: { select: { id: true, name: true, phone: true } },
        },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      },
    },
  });
  if (!job) notFound();

  // Live match preview (excludes already-offered providers).
  const candidates = await matchProvidersForJob(id, { limit: 100 });

  const acceptedCount = job.offers.filter(
    (o) => o.status === "ACCEPTED",
  ).length;

  async function dispatchAction() {
    "use server";
    return await dispatchJobOffers(id);
  }
  async function closeAction() {
    "use server";
    await setJobStatus(id, "CLOSED");
  }
  async function reopenAction() {
    "use server";
    await setJobStatus(id, "OPEN");
  }

  return (
    <div className="p-6 md:p-8 space-y-5 max-w-5xl">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/admin/jobs">
          <ChevronLeft className="size-4" />
          All jobs
        </Link>
      </Button>

      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">
              {job.title}
            </h1>
            <Badge variant="secondary" className="text-[10px]">
              {job.status}
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1 flex-wrap">
            <span>{job.profileType.label}</span>
            <span className="flex items-center gap-1">
              <MapPin className="size-3.5" />
              {job.pincode ?? (job.lat != null ? `geo · ${job.radiusKm}km` : "—")}
            </span>
            {job.shiftType && <span>{job.shiftType}</span>}
            {job.payText && <span>{job.payText}</span>}
            <span className="flex items-center gap-1">
              <Users className="size-3.5" />
              {acceptedCount}/{job.slots} filled
            </span>
          </div>
          {job.description && (
            <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
              {job.description}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {job.status === "CLOSED" ? (
            <form action={reopenAction}>
              <Button type="submit" variant="outline" size="sm">
                Reopen
              </Button>
            </form>
          ) : (
            <form action={closeAction}>
              <Button type="submit" variant="outline" size="sm">
                Close job
              </Button>
            </form>
          )}
        </div>
      </header>

      {/* Matched candidates + dispatch */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm">Matched providers</CardTitle>
            <CardDescription>
              ACTIVE providers in range with the required skills, not already
              offered.
            </CardDescription>
          </div>
          <DispatchOffers
            action={dispatchAction}
            candidateCount={candidates.length}
          />
        </CardHeader>
        <CardContent className="px-0">
          {candidates.length === 0 ? (
            <p className="px-6 py-6 text-sm text-muted-foreground text-center">
              No new matches. Either everyone in range was already offered, or
              no ACTIVE provider matches the location/skills.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Pincode</TableHead>
                  <TableHead>Match</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.slice(0, 50).map((c) => (
                  <TableRow key={c.careProviderId}>
                    <TableCell className="py-2">
                      <Link
                        href={`/admin/care-providers/${c.careProviderId}`}
                        className="font-medium hover:underline"
                      >
                        {c.name ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {c.phone}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.pincodeHome ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.matchedBy === "geo"
                        ? `${c.distanceKm} km`
                        : "pincode"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Sent offers + their status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            Offers ({job.offers.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {job.offers.length === 0 ? (
            <p className="px-6 py-6 text-sm text-muted-foreground text-center">
              No offers sent yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Provider</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Responded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {job.offers.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="py-2">
                      <Link
                        href={`/admin/care-providers/${o.careProvider.id}`}
                        className="font-medium hover:underline"
                      >
                        {o.careProvider.name ?? o.careProvider.phone}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {o.channel ?? "—"}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${OFFER_TONE[o.status]}`}
                      >
                        {o.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {o.sentAt ? relTime(o.sentAt) : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {o.respondedAt ? relTime(o.respondedAt) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
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
