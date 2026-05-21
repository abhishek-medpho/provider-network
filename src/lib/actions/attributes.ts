"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AttributeType, PiiLevel, type Prisma } from "@prisma/client";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user;
}

const KEY_REGEX = /^[a-z][a-z0-9_]*$/;

function parseJsonField<T>(input: FormDataEntryValue | null, fallback: T): T {
  if (!input || typeof input !== "string" || input.trim() === "")
    return fallback;
  try {
    return JSON.parse(input) as T;
  } catch {
    return fallback;
  }
}

function parseOptionRows(formData: FormData): Array<{ value: string; label: string }> {
  // Inputs named: option_value_0, option_label_0, option_value_1, ...
  const out: Array<{ value: string; label: string }> = [];
  const indices = new Set<number>();
  for (const key of formData.keys()) {
    const m = /^option_(value|label)_(\d+)$/.exec(key);
    if (m) indices.add(Number(m[2]));
  }
  for (const i of Array.from(indices).sort((a, b) => a - b)) {
    const value = String(formData.get(`option_value_${i}`) ?? "").trim();
    const label = String(formData.get(`option_label_${i}`) ?? "").trim();
    if (value && label) out.push({ value, label });
  }
  return out;
}

function buildValidation(formData: FormData): Record<string, unknown> | undefined {
  const v: Record<string, unknown> = {};
  const required = formData.get("validation_required");
  if (required === "on") v.required = true;
  const min = formData.get("validation_min");
  if (min && String(min).trim() !== "") v.min = Number(min);
  const max = formData.get("validation_max");
  if (max && String(max).trim() !== "") v.max = Number(max);
  const minItems = formData.get("validation_minItems");
  if (minItems && String(minItems).trim() !== "")
    v.minItems = Number(minItems);
  const maxItems = formData.get("validation_maxItems");
  if (maxItems && String(maxItems).trim() !== "")
    v.maxItems = Number(maxItems);
  const regex = formData.get("validation_regex");
  if (regex && String(regex).trim() !== "") v.regex = String(regex);
  const fileMaxKb = formData.get("validation_fileMaxKb");
  if (fileMaxKb && String(fileMaxKb).trim() !== "")
    v.fileMaxKb = Number(fileMaxKb);
  return Object.keys(v).length ? v : undefined;
}

export async function createAttribute(formData: FormData) {
  await requireAdmin();

  const key = String(formData.get("key") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  const typeStr = String(formData.get("type") ?? "");

  if (!KEY_REGEX.test(key)) {
    throw new Error(
      "Key must be snake_case: lowercase, starts with a letter, only letters/digits/underscores",
    );
  }
  if (!label) throw new Error("Label is required");
  if (!(typeStr in AttributeType))
    throw new Error(`Unknown attribute type: ${typeStr}`);

  const existing = await prisma.attribute.findUnique({ where: { key } });
  if (existing) throw new Error(`Attribute with key "${key}" already exists`);

  const category = String(formData.get("category") ?? "").trim() || null;
  const helpText = String(formData.get("helpText") ?? "").trim() || null;
  const piiLevelStr = String(formData.get("piiLevel") ?? "NONE");
  const piiLevel = (piiLevelStr in PiiLevel ? piiLevelStr : "NONE") as PiiLevel;
  const isSearchable = formData.get("isSearchable") === "on";

  const options = parseOptionRows(formData);
  const validation = buildValidation(formData);

  const created = await prisma.attribute.create({
    data: {
      key,
      label,
      type: typeStr as AttributeType,
      category,
      helpText,
      piiLevel,
      isSearchable,
      options: options.length ? (options as Prisma.InputJsonValue) : undefined,
      validation: validation as Prisma.InputJsonValue | undefined,
    },
  });

  revalidatePath("/admin/attributes");
  redirect(`/admin/attributes/${created.id}`);
}

export async function updateAttribute(id: string, formData: FormData) {
  await requireAdmin();

  const attr = await prisma.attribute.findUnique({ where: { id } });
  if (!attr) throw new Error("Attribute not found");

  const label = String(formData.get("label") ?? "").trim();
  if (!label) throw new Error("Label is required");

  const category = String(formData.get("category") ?? "").trim() || null;
  const helpText = String(formData.get("helpText") ?? "").trim() || null;
  const piiLevelStr = String(formData.get("piiLevel") ?? "NONE");
  const piiLevel = (piiLevelStr in PiiLevel ? piiLevelStr : "NONE") as PiiLevel;
  const isSearchable = formData.get("isSearchable") === "on";

  const options = parseOptionRows(formData);
  const validation = buildValidation(formData);

  // Type changes are dangerous if there's existing data — only allow for
  // non-system attributes and only between safe types (we just allow any
  // change for now and log; the form prevents this for system attrs)
  let nextType = attr.type;
  const typeStr = String(formData.get("type") ?? attr.type);
  if (typeStr !== attr.type && !attr.isSystem && typeStr in AttributeType) {
    nextType = typeStr as AttributeType;
  }

  await prisma.attribute.update({
    where: { id },
    data: {
      label,
      type: nextType,
      category,
      helpText,
      piiLevel,
      isSearchable,
      options: options.length
        ? (options as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      validation: (validation as Prisma.InputJsonValue) ?? Prisma.JsonNull,
    },
  });

  revalidatePath("/admin/attributes");
  revalidatePath(`/admin/attributes/${id}`);
}

export async function archiveAttribute(id: string) {
  await requireAdmin();
  const attr = await prisma.attribute.findUnique({ where: { id } });
  if (!attr) throw new Error("Attribute not found");
  if (attr.isSystem) throw new Error("Cannot archive system attributes");

  await prisma.attribute.update({
    where: { id },
    data: { archivedAt: new Date() },
  });

  revalidatePath("/admin/attributes");
  redirect("/admin/attributes");
}

export async function restoreAttribute(id: string) {
  await requireAdmin();
  await prisma.attribute.update({
    where: { id },
    data: { archivedAt: null },
  });
  revalidatePath("/admin/attributes");
  revalidatePath(`/admin/attributes/${id}`);
}
