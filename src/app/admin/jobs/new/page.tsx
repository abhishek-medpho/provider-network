import { prisma } from "@/lib/db";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createJob } from "@/lib/actions/jobs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const metadata = { title: "New job" };

export default async function NewJobPage() {
  const profileTypes = await prisma.profileType.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, label: true },
  });

  return (
    <div className="p-6 md:p-8 space-y-5 max-w-3xl">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/admin/jobs">
          <ChevronLeft className="size-4" />
          All jobs
        </Link>
      </Button>

      <header>
        <h1>New job</h1>
        <p className="text-sm text-muted-foreground">
          Saved as DRAFT. Review matched providers, then send offers.
        </p>
      </header>

      <form action={createJob} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Basics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                name="title"
                required
                placeholder="Night-shift nurse — Koramangala"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                rows={3}
                placeholder="What the role involves, requirements, etc."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="profileTypeId">
                  Role <span className="text-destructive">*</span>
                </Label>
                <select
                  id="profileTypeId"
                  name="profileTypeId"
                  className="w-full h-9 px-3 rounded-md border bg-background text-sm"
                  required
                >
                  {profileTypes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="slots">Slots</Label>
                <Input
                  id="slots"
                  name="slots"
                  type="number"
                  min={1}
                  defaultValue={1}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Location</CardTitle>
            <CardDescription>
              Match by pincode, or by geo radius if you have coordinates.
              Providers match if their home pincode equals this OR their GPS
              is within the radius.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pincode">Pincode</Label>
                <Input id="pincode" name="pincode" placeholder="560034" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="radiusKm">Radius (km)</Label>
                <Input
                  id="radiusKm"
                  name="radiusKm"
                  type="number"
                  min={1}
                  defaultValue={10}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lat">Latitude</Label>
                <Input
                  id="lat"
                  name="lat"
                  placeholder="12.9352"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lng">Longitude</Label>
                <Input
                  id="lng"
                  name="lng"
                  placeholder="77.6245"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Commercials</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="shiftType">Shift type</Label>
                <Input
                  id="shiftType"
                  name="shiftType"
                  placeholder="12h day / live-in / visit"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="payText">Pay</Label>
                <Input id="payText" name="payText" placeholder="₹1,200 / shift" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="offerTTLHours">Offer expiry (hours)</Label>
                <Input
                  id="offerTTLHours"
                  name="offerTTLHours"
                  type="number"
                  min={1}
                  defaultValue={48}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button type="submit">Create job</Button>
          <Button variant="outline" asChild>
            <Link href="/admin/jobs">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
