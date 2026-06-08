import { prisma } from "@/lib/db";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createGig } from "@/lib/actions/gigs";
import { SkillsPicker, type SkillAttribute } from "../_components/SkillsPicker";
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

export const metadata = { title: "New gig" };

export default async function NewGigPage() {
  const [profileTypes, skillAttrs, sopForms] = await Promise.all([
    prisma.profileType.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, label: true },
    }),
    prisma.attribute.findMany({
      where: {
        type: { in: ["MULTI_SELECT", "SINGLE_SELECT"] },
        category: { in: ["skills", "service"] },
        archivedAt: null,
      },
      orderBy: { label: "asc" },
      select: { key: true, label: true, options: true },
    }),
    prisma.formTemplate.findMany({
      where: { status: { not: "ARCHIVED" } },
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, purpose: true },
    }),
  ]);

  const skillAttributes: SkillAttribute[] = skillAttrs.map((a) => ({
    key: a.key,
    label: a.label,
    options: Array.isArray(a.options)
      ? (a.options as { value: string; label: string }[])
      : [],
  }));

  return (
    <div className="p-6 md:p-8 space-y-5 max-w-3xl">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/admin/gigs">
          <ChevronLeft className="size-4" />
          All gigs
        </Link>
      </Button>

      <header>
        <h1>New gig</h1>
        <p className="text-sm text-muted-foreground">
          Saved as DRAFT. Broadcast to matched providers, pick a willing one,
          they confirm, then complete.
        </p>
      </header>

      <form action={createGig} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Basics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="type">Type</Label>
                <select
                  id="type"
                  name="type"
                  defaultValue="SAMPLE_COLLECTION"
                  className="w-full h-9 px-3 rounded-md border bg-background text-sm"
                >
                  <option value="SAMPLE_COLLECTION">Sample collection</option>
                  <option value="HOME_NURSING_VISIT">Home nursing visit</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
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
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                name="title"
                required
                placeholder="Blood draw — Mr. Rao"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Instructions / notes</Label>
              <Textarea
                id="description"
                name="description"
                rows={2}
                placeholder="Fasting sample, 2 vials, etc."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="scheduledFor">
                  Scheduled for <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="scheduledFor"
                  name="scheduledFor"
                  type="datetime-local"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="payText">Pay</Label>
                <Input id="payText" name="payText" placeholder="₹350 / pickup" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Patient & location</CardTitle>
            <CardDescription>
              Full address stays private — only the confirmed provider sees it.
              Area + pincode/geo drive matching.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="patientName">Patient name</Label>
                <Input id="patientName" name="patientName" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="siteArea">Area / landmark (public)</Label>
                <Input
                  id="siteArea"
                  name="siteArea"
                  placeholder="Koramangala 5th Block"
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="siteAddress">Full address (private)</Label>
                <Input
                  id="siteAddress"
                  name="siteAddress"
                  placeholder="123, 5th Cross, Koramangala…"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pincode">Pincode</Label>
                <Input id="pincode" name="pincode" placeholder="560034" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="radiusKm">Match radius (km)</Label>
                <Input
                  id="radiusKm"
                  name="radiusKm"
                  type="number"
                  min={1}
                  defaultValue={8}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lat">Latitude</Label>
                <Input id="lat" name="lat" placeholder="12.9352" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lng">Longitude</Label>
                <Input id="lng" name="lng" placeholder="77.6245" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Requester (optional)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="requesterName">Clinic / lab / contact</Label>
                <Input id="requesterName" name="requesterName" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="requesterPhone">Contact phone</Label>
                <Input id="requesterPhone" name="requesterPhone" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Required skills</CardTitle>
            <CardDescription>
              Optional gate — only providers with every checked skill match.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SkillsPicker attributes={skillAttributes} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Completion (SOP) form</CardTitle>
            <CardDescription>
              The form the provider fills after the visit to close the gig.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <select
              name="sopFormTemplateId"
              defaultValue=""
              className="w-full h-9 px-3 rounded-md border bg-background text-sm"
            >
              <option value="">— None —</option>
              {sopForms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button type="submit">Create gig</Button>
          <Button variant="outline" asChild>
            <Link href="/admin/gigs">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
