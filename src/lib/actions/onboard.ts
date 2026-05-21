"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Attribute, AttributeType, Prisma } from "@prisma/client";
import type { FormSection } from "@/lib/types/form";
import { saveLocalFile } from "@/lib/storage";

type AttributeOption = { value: string; label: string };

function getOptions(attr: Attribute): AttributeOption[] {
  if (!attr.options) return [];
  if (Array.isArray(attr.options))
    return attr.options as unknown as AttributeOption[];
  return [];
}

function getValidation(attr: Attribute): Record<string, unknown> {
  return (attr.validation as Record<string, unknown> | null) ?? {};
}

/**
 * Coerce raw formData values into the typed shape we store on
 * CareProvider.attributes. Returns a value or `null` (cleared) or `undefined`
 * (not present, leave alone).
 */
function coerce(
  attr: Attribute,
  rawValues: FormDataEntryValue[],
): { value: unknown; error?: string } {
  const validation = getValidation(attr);
  const required = validation.required === true;

  // For most types, a single value; for MULTI_SELECT, an array.
  const single = rawValues.length > 0 ? String(rawValues[0]) : "";

  switch (attr.type as AttributeType) {
    case "TEXT":
    case "RICH_TEXT":
    case "LONG_TEXT":
      if (!single) return required ? { value: null, error: "required" } : { value: null };
      return { value: single };

    case "NUMBER":
    case "YEAR": {
      if (!single) return required ? { value: null, error: "required" } : { value: null };
      const n = Number(single);
      if (!Number.isFinite(n)) return { value: null, error: "must be a number" };
      if (validation.min !== undefined && n < (validation.min as number))
        return { value: null, error: `must be at least ${validation.min}` };
      if (validation.max !== undefined && n > (validation.max as number))
        return { value: null, error: `must be at most ${validation.max}` };
      return { value: n };
    }

    case "EMAIL": {
      if (!single) return required ? { value: null, error: "required" } : { value: null };
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(single);
      if (!ok) return { value: null, error: "invalid email" };
      return { value: single.toLowerCase() };
    }

    case "PHONE":
    case "OTP_VERIFIED_PHONE": {
      if (!single) return required ? { value: null, error: "required" } : { value: null };
      const digits = single.replace(/\D/g, "");
      if (digits.length < 7 || digits.length > 15)
        return { value: null, error: "invalid phone" };
      return { value: digits };
    }

    case "PINCODE": {
      if (!single) return required ? { value: null, error: "required" } : { value: null };
      if (!/^\d{6}$/.test(single))
        return { value: null, error: "must be 6 digits" };
      return { value: single };
    }

    case "DATE": {
      if (!single) return required ? { value: null, error: "required" } : { value: null };
      const d = new Date(single);
      if (Number.isNaN(d.getTime())) return { value: null, error: "invalid date" };
      return { value: single }; // store ISO yyyy-mm-dd
    }

    case "SINGLE_SELECT": {
      if (!single) return required ? { value: null, error: "required" } : { value: null };
      const valid = getOptions(attr).some((o) => o.value === single);
      if (!valid) return { value: null, error: "invalid option" };
      return { value: single };
    }

    case "MULTI_SELECT": {
      const opts = getOptions(attr);

      // Open-set multi-select (no predefined options): one text input
      // with comma-separated values.
      let items: string[];
      if (opts.length === 0) {
        items =
          rawValues.length === 1
            ? String(rawValues[0])
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            : rawValues.map(String).filter(Boolean);
      } else {
        const allValid = rawValues
          .map(String)
          .every((v) => opts.some((o) => o.value === v));
        if (!allValid) return { value: null, error: "invalid option(s)" };
        items = rawValues.map(String);
      }

      if (required && items.length === 0)
        return { value: null, error: "required" };
      if (
        validation.minItems !== undefined &&
        items.length < (validation.minItems as number)
      )
        return {
          value: null,
          error: `pick at least ${validation.minItems}`,
        };
      if (
        validation.maxItems !== undefined &&
        items.length > (validation.maxItems as number)
      )
        return {
          value: null,
          error: `pick at most ${validation.maxItems}`,
        };
      return { value: items };
    }

    case "BOOLEAN": {
      const truthy = single === "true" || single === "on";
      return { value: truthy };
    }

    case "SELFIE":
    case "FILE_IMAGE":
    case "FILE_DOC":
      // Uploads not wired yet — accept null without erroring even if required
      return { value: null };

    case "SECTION_HEADING":
    case "INFO_BLOCK":
      return { value: undefined };

    default:
      return { value: null };
  }
}

/**
 * Submit an onboarding form bound to a CampaignMember token.
 * Validates each attribute block, persists values to CareProvider.attributes,
 * writes a FormResponse and a CareProviderEvent.
 */
export async function submitOnboarding(token: string, formData: FormData) {
  const member = await prisma.campaignMember.findUnique({
    where: { token },
    include: {
      careProvider: true,
      campaign: {
        include: {
          formTemplate: true,
        },
      },
    },
  });
  if (!member) throw new Error("Invalid or expired link");
  if (!member.campaign.formTemplate)
    throw new Error("This campaign has no form template configured");

  const form = member.campaign.formTemplate;
  const sections = (form.sections as unknown as FormSection[]) ?? [];

  // Gather all attribute IDs referenced in the form
  const attrIds = new Set<string>();
  for (const s of sections)
    for (const b of s.blocks)
      if (b.type === "ATTRIBUTE") attrIds.add(b.attributeId);

  const attrs = await prisma.attribute.findMany({
    where: { id: { in: Array.from(attrIds) } },
  });
  const attrById = new Map(attrs.map((a) => [a.id, a]));

  // Process each ATTRIBUTE block
  const collected: Record<string, unknown> = {};
  const errors: Record<string, string> = {};

  for (const section of sections) {
    for (const block of section.blocks) {
      if (block.type !== "ATTRIBUTE") continue;
      const attr = attrById.get(block.attributeId);
      if (!attr) continue;

      const required =
        block.isRequired === true ||
        (getValidation(attr).required === true);

      const raw = formData.getAll(attr.key);
      const isFileType =
        attr.type === "SELFIE" ||
        attr.type === "FILE_IMAGE" ||
        attr.type === "FILE_DOC";

      // File types: save uploaded file, store { key, url, ... } in attributes.
      if (isFileType) {
        const f = raw.find(
          (r): r is File => typeof r !== "string" && r instanceof File,
        );
        const existing = (member.careProvider.attributes as Record<string, unknown>)?.[
          attr.key
        ];

        // No new file picked
        if (!f || f.size === 0) {
          if (existing) {
            // keep existing
            collected[attr.key] = existing;
          } else if (required) {
            errors[attr.key] = "required";
          }
          continue;
        }

        try {
          const kind: "image" | "document" =
            attr.type === "FILE_DOC" ? "document" : "image";
          const saved = await saveLocalFile(f, {
            careProviderId: member.careProviderId,
            kind,
          });
          collected[attr.key] = saved;
        } catch (err) {
          errors[attr.key] =
            err instanceof Error ? err.message : "upload failed";
        }
        continue;
      }

      // For BOOLEAN, unchecked checkbox sends nothing — treat as false
      const effectiveRaw =
        attr.type === "BOOLEAN" && raw.length === 0 ? ["false"] : raw;

      const { value, error } = coerce(
        { ...attr, validation: { ...getValidation(attr), required } } as Attribute,
        effectiveRaw,
      );

      if (error) errors[attr.key] = error;
      if (value !== undefined) collected[attr.key] = value;
    }
  }

  if (Object.keys(errors).length > 0) {
    const msg = Object.entries(errors)
      .map(([k, v]) => `${k}: ${v}`)
      .join("; ");
    throw new Error(`Validation failed — ${msg}`);
  }

  // Persist
  const now = new Date();
  const currentAttrs =
    (member.careProvider.attributes as Record<string, unknown>) ?? {};
  const nextAttrs = { ...currentAttrs, ...collected };

  // Pull system fields out of collected for first-class storage too
  const systemUpdates: Prisma.CareProviderUpdateInput = {
    attributes: nextAttrs as Prisma.InputJsonValue,
    status:
      member.careProvider.status === "LEAD" ||
      member.careProvider.status === "ENGAGED"
        ? "PROFILED"
        : member.careProvider.status,
  };
  if (typeof collected.full_name === "string")
    systemUpdates.name = collected.full_name;
  if (typeof collected.email === "string")
    systemUpdates.email = collected.email;
  if (typeof collected.pincode_home === "string")
    systemUpdates.pincodeHome = collected.pincode_home;
  const selfieVal = collected.selfie as
    | { url?: string }
    | string
    | undefined;
  if (selfieVal && typeof selfieVal === "object" && selfieVal.url)
    systemUpdates.selfieUrl = selfieVal.url;

  await prisma.$transaction([
    prisma.careProvider.update({
      where: { id: member.careProviderId },
      data: systemUpdates,
    }),
    prisma.formResponse.create({
      data: {
        careProviderId: member.careProviderId,
        formTemplateId: form.id,
        partKey: "full",
        data: collected as Prisma.InputJsonValue,
      },
    }),
    prisma.careProviderEvent.create({
      data: {
        careProviderId: member.careProviderId,
        type: "FORM_SUBMITTED",
        payload: {
          formTemplateId: form.id,
          formName: form.name,
          fields: Object.keys(collected).length,
        } as Prisma.InputJsonValue,
      },
    }),
    prisma.campaignMember.update({
      where: { id: member.id },
      data: { status: "SUBMITTED", submittedAt: now },
    }),
  ]);

  revalidatePath(`/onboard/${token}`);
  redirect(`/onboard/${token}/thanks`);
}

/** Mark a member as ENGAGED (form opened) — fire-and-forget from the page. */
export async function recordFormOpened(token: string) {
  try {
    const member = await prisma.campaignMember.findUnique({
      where: { token },
      select: { id: true, status: true, careProviderId: true, engagedAt: true },
    });
    if (!member) return;
    if (member.engagedAt) return; // already recorded
    await prisma.campaignMember.update({
      where: { id: member.id },
      data: {
        status: member.status === "PENDING" ? "ENGAGED" : member.status,
        engagedAt: new Date(),
      },
    });
    await prisma.careProviderEvent.create({
      data: {
        careProviderId: member.careProviderId,
        type: "FORM_OPENED",
      },
    });
  } catch {
    // best-effort
  }
}
