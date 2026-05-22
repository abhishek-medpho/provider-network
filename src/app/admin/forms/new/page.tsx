import { prisma } from "@/lib/db";
import { FormPurpose } from "@prisma/client";
import Link from "next/link";
import { createForm } from "@/lib/actions/forms";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PURPOSE_LABELS: Record<string, string> = {
  ONBOARDING: "Onboarding (Invite)",
  APPOINTMENT_CONFIRM: "Appointment confirmation",
  APPOINTMENT_EXECUTION: "During appointment",
  POST_APPOINTMENT: "Post-appointment",
  CUSTOM: "Custom",
};

const PURPOSE_HELP: Record<string, string> = {
  ONBOARDING: "Sent to leads via WhatsApp. Mostly input fields.",
  APPOINTMENT_CONFIRM:
    "Patient details + Accept / Can't make it buttons. Starts with display blocks.",
  APPOINTMENT_EXECUTION:
    "Mix of patient context display + data capture fields (vitals, notes...).",
  POST_APPOINTMENT: "Wrap-up form after the visit. Often a rating + notes.",
  CUSTOM: "Empty starter. Build from scratch.",
};

export default async function NewFormPage() {
  const profileTypes = await prisma.profileType.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, label: true },
  });

  return (
    <div className="p-6 md:p-8 space-y-5 max-w-3xl">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/admin/forms">
          <ChevronLeft className="size-4" />
          All forms
        </Link>
      </Button>

      <header>
        <h1>New form</h1>
        <p className="text-sm text-muted-foreground">
          We&apos;ll create the form with starter sections + default action
          buttons based on the purpose. You can customise everything after.
        </p>
      </header>

      <form action={createForm} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Basics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">
                Form name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                name="name"
                required
                placeholder="e.g. Nurse onboarding v1"
              />
            </div>

            <div className="space-y-2">
              <Label>
                Purpose <span className="text-destructive">*</span>
              </Label>
              <div className="space-y-2">
                {Object.keys(FormPurpose).map((p, idx) => (
                  <label
                    key={p}
                    className="flex items-start gap-3 p-3 rounded-md border bg-background cursor-pointer has-[:checked]:border-foreground has-[:checked]:bg-accent transition-colors"
                  >
                    <input
                      type="radio"
                      name="purpose"
                      value={p}
                      defaultChecked={idx === 0}
                      className="mt-1 accent-foreground"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium">
                        {PURPOSE_LABELS[p]}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {PURPOSE_HELP[p]}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="profileTypeId">Scope (profile type)</Label>
              <select
                id="profileTypeId"
                name="profileTypeId"
                defaultValue=""
                className="w-full h-9 px-3 rounded-md border bg-background text-sm"
              >
                <option value="">All roles</option>
                {profileTypes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Leave on &quot;All roles&quot; for forms that apply regardless
                of provider type (e.g. appointment confirmation).
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button type="submit">Create form</Button>
          <Button variant="outline" asChild>
            <Link href="/admin/forms">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
