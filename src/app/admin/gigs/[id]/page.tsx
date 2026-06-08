import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, MapPin, Clock, User, Phone } from "lucide-react";
import { broadcastWave, cancelGig } from "@/lib/actions/gigs";
import { gigTaskLabel } from "@/lib/gigs/labels";
import { assignGig } from "@/lib/actions/gig-assign";
import { BroadcastButton, AssignButton } from "./_components/GigActions";
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

const RESP_TONE: Record<string, string> = {
  NOTIFIED: "bg-muted text-muted-foreground",
  INTERESTED: "bg-success/15 text-success",
  DECLINED: "bg-destructive/15 text-destructive",
  EXPIRED: "bg-muted text-muted-foreground",
};

function fmtFull(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(new Date(d));
}
function relTime(d: Date): string {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default async function GigDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const gig = await prisma.gig.findUnique({
    where: { id },
    include: {
      profileType: { select: { label: true } },
      sopFormTemplate: { select: { name: true } },
      assignedProvider: { select: { id: true, name: true, phone: true } },
      responses: {
        include: {
          careProvider: { select: { id: true, name: true, phone: true } },
        },
        orderBy: [{ status: "asc" }, { distanceKm: "asc" }],
      },
    },
  });
  if (!gig) notFound();

  const willing = gig.responses.filter((r) => r.status === "INTERESTED");
  const others = gig.responses.filter((r) => r.status !== "INTERESTED");

  async function broadcastAction() {
    "use server";
    return await broadcastWave(id);
  }
  async function cancelAction() {
    "use server";
    await cancelGig(id);
  }

  const canBroadcast = gig.status === "DRAFT" || gig.status === "OPEN";
  const canAssign = gig.status === "OPEN" || gig.status === "ASSIGNED";

  return (
    <div className="p-6 md:p-8 space-y-5 max-w-5xl">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/admin/gigs">
          <ChevronLeft className="size-4" />
          All gigs
        </Link>
      </Button>

      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">{gig.title}</h1>
            <Badge variant={STATUS_VARIANT[gig.status] ?? "outline"} className="text-[10px]">
              {gig.status}
            </Badge>
            <Badge variant="secondary" className="text-[10px] capitalize">
              {gigTaskLabel(gig.type)}
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1 flex-wrap">
            <span>{gig.profileType.label}</span>
            <span className="flex items-center gap-1">
              <Clock className="size-3.5" />
              {fmtFull(gig.scheduledFor)}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="size-3.5" />
              {gig.siteArea ?? gig.pincode ?? "—"}
            </span>
            {gig.payText && <span>{gig.payText}</span>}
          </div>
          {gig.description && (
            <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
              {gig.description}
            </p>
          )}
        </div>
        {gig.status !== "CANCELLED" && gig.status !== "COMPLETED" && (
          <form action={cancelAction}>
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
            >
              Cancel gig
            </Button>
          </form>
        )}
      </header>

      {/* Assignment status banner */}
      {gig.assignedProvider && (
        <Card>
          <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
            <div className="text-sm">
              <span className="text-muted-foreground">
                {gig.assignmentStatus === "AWAITING"
                  ? "Awaiting reconfirmation from"
                  : gig.status === "CONFIRMED"
                    ? "Confirmed:"
                    : gig.status === "COMPLETED"
                      ? "Completed by"
                      : "Assigned to"}
              </span>{" "}
              <Link
                href={`/admin/care-providers/${gig.assignedProvider.id}`}
                className="font-medium hover:underline"
              >
                {gig.assignedProvider.name ?? gig.assignedProvider.phone}
              </Link>
              {gig.assignmentStatus === "AWAITING" && gig.confirmDeadline && (
                <span className="text-muted-foreground">
                  {" "}
                  · confirm by {fmtFull(gig.confirmDeadline)}
                </span>
              )}
            </div>
            <Badge
              variant={gig.status === "CONFIRMED" || gig.status === "COMPLETED" ? "default" : "secondary"}
              className="text-[10px]"
            >
              {gig.assignmentStatus}
            </Badge>
          </CardContent>
        </Card>
      )}

      {/* Broadcast control */}
      {canBroadcast && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm">Broadcast</CardTitle>
              <CardDescription>
                Reach matched providers. Each wave widens the radius (and from
                wave 3, relaxes the skill gate).
              </CardDescription>
            </div>
            <BroadcastButton action={broadcastAction} wave={gig.currentWave} />
          </CardHeader>
        </Card>
      )}

      {/* Willing list — assign from here */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            Willing providers ({willing.length})
          </CardTitle>
          <CardDescription>
            Everyone who tapped &quot;I&apos;m available&quot;. Pick one to
            assign — they&apos;ll get a reconfirm prompt before the address is
            revealed. The rest stay as standby.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {willing.length === 0 ? (
            <p className="px-6 py-6 text-sm text-muted-foreground text-center">
              No willing providers yet. Broadcast to collect interest.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Provider</TableHead>
                  <TableHead>Distance</TableHead>
                  <TableHead>Wave</TableHead>
                  <TableHead>Responded</TableHead>
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {willing.map((r) => {
                  const isAssignee =
                    gig.assignedProviderId === r.careProviderId;
                  async function assignThis() {
                    "use server";
                    return await assignGig(id, r.careProviderId);
                  }
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="py-2">
                        <Link
                          href={`/admin/care-providers/${r.careProvider.id}`}
                          className="font-medium hover:underline"
                        >
                          {r.careProvider.name ?? r.careProvider.phone}
                        </Link>
                        <div className="text-xs font-mono text-muted-foreground">
                          {r.careProvider.phone}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.distanceKm != null ? `${r.distanceKm} km` : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.wave}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.respondedAt ? relTime(r.respondedAt) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {isAssignee ? (
                          <Badge variant="secondary" className="text-[10px]">
                            assigned
                          </Badge>
                        ) : (
                          <AssignButton
                            action={assignThis}
                            disabled={!canAssign}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* All responses (notified/declined/expired) */}
      {others.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Other responses ({others.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Provider</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Wave</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {others.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="py-2 text-sm">
                      {r.careProvider.name ?? r.careProvider.phone}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${RESP_TONE[r.status]}`}
                      >
                        {r.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.wave}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
