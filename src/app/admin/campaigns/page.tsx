import { prisma } from "@/lib/db";
import Link from "next/link";
import { Plus, Megaphone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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

export default async function CampaignsPage() {
  const campaigns = await prisma.campaign.findMany({
    where: { status: { not: "ARCHIVED" } },
    include: {
      profileType: { select: { label: true } },
      formTemplate: { select: { name: true } },
      _count: { select: { members: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const stats = await prisma.campaignMember.groupBy({
    by: ["campaignId", "status"],
    _count: { _all: true },
    where: { campaignId: { in: campaigns.map((c) => c.id) } },
  });

  type StatusBuckets = Partial<Record<string, number>>;
  const buckets: Record<string, StatusBuckets> = {};
  for (const row of stats) {
    if (!buckets[row.campaignId]) buckets[row.campaignId] = {};
    buckets[row.campaignId][row.status] = row._count._all;
  }

  return (
    <div className="p-6 md:p-8 space-y-5">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1>Campaigns</h1>
          <p className="text-sm text-muted-foreground">
            Upload leads, send invites, run automated reminders.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/campaigns/new">
            <Plus className="size-4" />
            New campaign
          </Link>
        </Button>
      </header>

      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Megaphone className="size-8 mx-auto text-muted-foreground mb-3" />
            <h3 className="text-base mb-1">No campaigns yet</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              A campaign ties together a profile type, an onboarding form, an
              invite message template, and a list of leads. Upload a CSV and
              launch — invites go out over WhatsApp via Ultramsg.
            </p>
            <Button asChild>
              <Link href="/admin/campaigns/new">
                <Plus className="size-4" />
                Create your first campaign
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Form</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Members</TableHead>
                <TableHead className="text-right">Sent</TableHead>
                <TableHead className="text-right">Submitted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((c) => {
                const b = buckets[c.id] ?? {};
                const sentLike =
                  (b.SENT ?? 0) +
                  (b.ENGAGED ?? 0) +
                  (b.SUBMITTED ?? 0) +
                  (b.COMPLETED ?? 0);
                const submitted = (b.SUBMITTED ?? 0) + (b.COMPLETED ?? 0);
                const submitRate =
                  c._count.members > 0
                    ? Math.round((submitted / c._count.members) * 100)
                    : 0;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="py-2.5">
                      <Link
                        href={`/admin/campaigns/${c.id}`}
                        className="font-medium hover:underline"
                      >
                        {c.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.profileType.label}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground truncate max-w-[200px]">
                      {c.formTemplate?.name ?? (
                        <span className="text-destructive">— missing</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <CampaignStatusBadge status={c.status} />
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {c._count.members}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                      {sentLike}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      <span className="font-medium">{submitted}</span>
                      {c._count.members > 0 && (
                        <span className="text-muted-foreground ml-1.5 text-xs">
                          ({submitRate}%)
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function CampaignStatusBadge({ status }: { status: string }) {
  if (status === "RUNNING")
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-success">
        <span className="size-1.5 rounded-full bg-success animate-pulse" />
        Running
      </span>
    );
  const variant =
    status === "COMPLETED"
      ? "secondary"
      : status === "PAUSED"
        ? "outline"
        : "outline";
  return (
    <Badge variant={variant} className="text-[10px] uppercase tracking-wide">
      {status}
    </Badge>
  );
}
