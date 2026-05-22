import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { AttributeType, PiiLevel } from "@prisma/client";
import {
  updateAttribute,
  archiveAttribute,
  restoreAttribute,
} from "@/lib/actions/attributes";
import OptionsEditor from "../_components/OptionsEditor";
import Link from "next/link";
import { ChevronLeft, Archive, RotateCcw } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

type Option = { value: string; label: string };

const TYPES_WITH_OPTIONS: AttributeType[] = [
  AttributeType.SINGLE_SELECT,
  AttributeType.MULTI_SELECT,
];

export default async function AttributeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const attr = await prisma.attribute.findUnique({
    where: { id },
    include: {
      profileTypeAttrs: {
        include: { profileType: { select: { code: true, label: true } } },
      },
    },
  });
  if (!attr) notFound();

  const options = Array.isArray(attr.options)
    ? (attr.options as unknown as Option[])
    : [];
  const validation =
    (attr.validation as Record<string, unknown> | null) ?? {};

  async function saveAction(formData: FormData) {
    "use server";
    await updateAttribute(id, formData);
  }
  async function archiveAction() {
    "use server";
    await archiveAttribute(id);
  }
  async function restoreAction() {
    "use server";
    await restoreAttribute(id);
  }

  return (
    <div className="p-6 md:p-8 space-y-5 max-w-3xl">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/admin/attributes">
          <ChevronLeft className="size-4" />
          All attributes
        </Link>
      </Button>

      <header>
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <h1 className="text-2xl font-semibold tracking-tight">{attr.label}</h1>
          {attr.isSystem && (
            <Badge variant="outline" className="text-[10px]">
              system
            </Badge>
          )}
          {attr.archivedAt && (
            <Badge variant="outline" className="text-[10px] text-warning border-warning/40">
              archived
            </Badge>
          )}
        </div>
        <p className="font-mono text-xs text-muted-foreground">{attr.key}</p>
      </header>

      <form action={saveAction} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Basics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field
              label="Label"
              name="label"
              defaultValue={attr.label}
              required
            />
            <Field
              label="Help text"
              name="helpText"
              defaultValue={attr.helpText ?? ""}
              placeholder="Optional context shown below the input"
            />
            <Field
              label="Category"
              name="category"
              defaultValue={attr.category ?? ""}
              placeholder="e.g. identity, skills, commercials"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Type & options</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="type">Type</Label>
              <select
                id="type"
                name="type"
                defaultValue={attr.type}
                disabled={attr.isSystem}
                className="w-full h-9 px-3 rounded-md border bg-background text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {Object.keys(AttributeType).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              {attr.isSystem && (
                <p className="text-xs text-muted-foreground">
                  System attribute — type is locked.
                </p>
              )}
            </div>
            {TYPES_WITH_OPTIONS.includes(attr.type) && (
              <div className="space-y-1.5">
                <Label>Options</Label>
                <OptionsEditor initial={options} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Validation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                name="validation_required"
                id="validation_required"
                defaultChecked={validation.required === true}
              />
              <span>Required</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Min (number or string length)"
                name="validation_min"
                defaultValue={(validation.min as number | undefined) ?? ""}
                type="number"
              />
              <Field
                label="Max"
                name="validation_max"
                defaultValue={(validation.max as number | undefined) ?? ""}
                type="number"
              />
              <Field
                label="Min items (multi-select)"
                name="validation_minItems"
                defaultValue={(validation.minItems as number | undefined) ?? ""}
                type="number"
              />
              <Field
                label="Max items"
                name="validation_maxItems"
                defaultValue={(validation.maxItems as number | undefined) ?? ""}
                type="number"
              />
              <Field
                label="Regex"
                name="validation_regex"
                defaultValue={(validation.regex as string | undefined) ?? ""}
                placeholder="^[0-9]{6}$"
              />
              <Field
                label="File max KB"
                name="validation_fileMaxKb"
                defaultValue={
                  (validation.fileMaxKb as number | undefined) ?? ""
                }
                type="number"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Privacy & search</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="piiLevel">PII Level</Label>
              <select
                id="piiLevel"
                name="piiLevel"
                defaultValue={attr.piiLevel}
                className="w-full h-9 px-3 rounded-md border bg-background text-sm"
              >
                {Object.keys(PiiLevel).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Higher PII = masked in admin UI, requires audit on access.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                name="isSearchable"
                id="isSearchable"
                defaultChecked={attr.isSearchable}
              />
              <span>Indexed for search (use sparingly)</span>
            </label>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button type="submit">Save changes</Button>
          <Button variant="outline" asChild>
            <Link href="/admin/attributes">Cancel</Link>
          </Button>
        </div>
      </form>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Used in</CardTitle>
          <CardDescription>
            Profile types that bundle this attribute into their form.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {attr.profileTypeAttrs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Not assigned to any profile type yet.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {attr.profileTypeAttrs.map((b) => (
                <Badge
                  key={b.id}
                  variant={b.isRequired ? "destructive" : "secondary"}
                  className="text-[10px]"
                >
                  {b.profileType.label}
                  {b.isRequired && " *"}
                  <span className="opacity-60 ml-1">[{b.sectionKey}]</span>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {!attr.isSystem && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-sm text-destructive">
              Danger zone
            </CardTitle>
          </CardHeader>
          <CardContent>
            {attr.archivedAt ? (
              <form action={restoreAction}>
                <Button type="submit" variant="outline" size="sm">
                  <RotateCcw className="size-3.5" />
                  Restore
                </Button>
              </form>
            ) : (
              <form action={archiveAction} className="space-y-2">
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                >
                  <Archive className="size-3.5" />
                  Archive attribute
                </Button>
                <p className="text-xs text-muted-foreground">
                  Archived attributes are hidden from forms and the default
                  list. Existing data is preserved. Can be restored later.
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  required,
  type = "text",
}: {
  label: string;
  name: string;
  defaultValue?: string | number;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <Input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}
