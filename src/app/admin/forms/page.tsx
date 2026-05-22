import { prisma } from "@/lib/db";
import Link from "next/link";
import { FormPurpose } from "@prisma/client";
import { Plus, FileText, ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const PURPOSE_LABELS: Record<string, string> = {
  ONBOARDING: "Onboarding (Invite)",
  APPOINTMENT_CONFIRM: "Appointment confirmation",
  APPOINTMENT_EXECUTION: "During appointment",
  POST_APPOINTMENT: "Post-appointment",
  CUSTOM: "Custom",
};

const PURPOSE_DESC: Record<string, string> = {
  ONBOARDING:
    "Capture profile details from a new care provider via WhatsApp link.",
  APPOINTMENT_CONFIRM:
    "Show patient + appointment details; provider taps Accept or Decline.",
  APPOINTMENT_EXECUTION:
    "Shown during the visit. Mixes patient context with configurable data capture.",
  POST_APPOINTMENT: "Final wrap-up after the visit ends.",
  CUSTOM: "Anything else.",
};

export default async function FormsPage() {
  const forms = await prisma.formTemplate.findMany({
    where: { status: { not: "ARCHIVED" } },
    include: { profileType: { select: { code: true, label: true } } },
    orderBy: [{ purpose: "asc" }, { updatedAt: "desc" }],
  });

  const grouped = forms.reduce<Record<string, typeof forms>>((acc, f) => {
    (acc[f.purpose] = acc[f.purpose] || []).push(f);
    return acc;
  }, {});

  return (
    <div className="p-6 md:p-8 space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1>Forms</h1>
          <p className="text-sm text-muted-foreground">
            Configurable forms shown to care providers at each lifecycle stage.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/forms/new">
            <Plus className="size-4" />
            New form
          </Link>
        </Button>
      </header>

      {forms.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="size-8 mx-auto text-muted-foreground mb-3" />
            <h3 className="text-base mb-1">No forms yet</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              Create one form per lifecycle stage. Each has a purpose
              (onboarding, appointment, execution) that drives the default
              structure and action buttons.
            </p>
            <Button asChild>
              <Link href="/admin/forms/new">
                <Plus className="size-4" />
                Create your first form
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        Object.keys(FormPurpose).map((purpose) => {
          const items = grouped[purpose] ?? [];
          if (items.length === 0) return null;
          return (
            <section key={purpose} className="space-y-3">
              <div>
                <h2>{PURPOSE_LABELS[purpose]}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {PURPOSE_DESC[purpose]}
                </p>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map((f) => (
                  <Card
                    key={f.id}
                    className="hover:border-foreground/20 transition-colors group"
                  >
                    <Link
                      href={`/admin/forms/${f.id}`}
                      className="block p-4 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-medium truncate">{f.name}</h3>
                        <StatusBadge status={f.status} />
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Badge
                          variant="outline"
                          className="text-[10px] font-mono"
                        >
                          {purpose}
                        </Badge>
                        <span>·</span>
                        <span>
                          {f.profileType ? f.profileType.label : "All roles"}
                        </span>
                        <span>·</span>
                        <span>v{f.version}</span>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        Open form
                        <ArrowUpRight className="size-3" />
                      </div>
                    </Link>
                  </Card>
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "PUBLISHED"
      ? "default"
      : status === "ARCHIVED"
        ? "outline"
        : "secondary";
  return (
    <Badge variant={variant} className="text-[10px] uppercase tracking-wide">
      {status}
    </Badge>
  );
}
