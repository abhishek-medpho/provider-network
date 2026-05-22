import { AttributeType, PiiLevel } from "@prisma/client";
import { createAttribute } from "@/lib/actions/attributes";
import OptionsEditor from "../_components/OptionsEditor";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";

const TYPES_WITH_OPTIONS = ["SINGLE_SELECT", "MULTI_SELECT"];

export default function NewAttributePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  return <NewForm searchParams={searchParams} />;
}

async function NewForm({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const initialType = (type && type in AttributeType ? type : "TEXT") as string;

  return (
    <div className="p-6 md:p-8 space-y-5 max-w-3xl">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/admin/attributes">
          <ChevronLeft className="size-4" />
          All attributes
        </Link>
      </Button>

      <header>
        <h1>New attribute</h1>
        <p className="text-sm text-muted-foreground">
          Atomic data point captured per care provider.
        </p>
      </header>

      <form action={createAttribute} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Basics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field
              label="Key"
              name="key"
              placeholder="snake_case_key"
              required
              help="Lowercase, underscores. Cannot be changed after create. e.g. years_experience, has_vehicle"
            />
            <Field
              label="Label"
              name="label"
              required
              placeholder="Shown to user"
            />
            <Field
              label="Help text"
              name="helpText"
              placeholder="Optional context shown below the input"
            />
            <Field
              label="Category"
              name="category"
              placeholder="e.g. identity, skills, commercials"
            />

            <div className="space-y-1.5">
              <Label htmlFor="type">
                Type <span className="text-destructive">*</span>
              </Label>
              <select
                id="type"
                name="type"
                defaultValue={initialType}
                className="w-full h-9 px-3 rounded-md border bg-background text-sm"
              >
                {Object.keys(AttributeType).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {TYPES_WITH_OPTIONS.includes(initialType) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Options</CardTitle>
              <CardDescription>
                Required for SELECT types. You can add more later.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <OptionsEditor initial={[{ value: "", label: "" }]} />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Validation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox name="validation_required" id="validation_required" />
              <span>Required</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Min" name="validation_min" type="number" />
              <Field label="Max" name="validation_max" type="number" />
              <Field
                label="Regex"
                name="validation_regex"
                placeholder="^[0-9]{6}$"
              />
              <Field
                label="File max KB"
                name="validation_fileMaxKb"
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
                defaultValue="NONE"
                className="w-full h-9 px-3 rounded-md border bg-background text-sm"
              >
                {Object.keys(PiiLevel).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox name="isSearchable" id="isSearchable" />
              <span>Indexed for search</span>
            </label>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button type="submit">Create attribute</Button>
          <Button variant="outline" asChild>
            <Link href="/admin/attributes">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  placeholder,
  required,
  type = "text",
  help,
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  type?: string;
  help?: string;
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
        placeholder={placeholder}
        required={required}
      />
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
  );
}
