"use server";

import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { saveLocalFile } from "@/lib/storage";
import type { FormSection } from "@/lib/types/form";

/**
 * Submit the SOP completion form for a gig. Reuses the same form engine as
 * onboarding: walk the SOP form's ATTRIBUTE blocks, coerce + save files,
 * persist a FormResponse linked to the gig + assigned provider, then flip
 * the gig to COMPLETED.
 *
 * Only the currently-assigned, CONFIRMED provider's gig can be completed —
 * we key by gig id (the completion link is gig-scoped, opened by the
 * confirmed provider who already has the address).
 */
export async function submitGigCompletion(
  gigId: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const gig = await prisma.gig.findUnique({
    where: { id: gigId },
    include: { sopFormTemplate: true },
  });
  if (!gig) return { ok: false, error: "Gig not found" };
  if (!gig.assignedProviderId)
    return { ok: false, error: "No provider assigned" };
  if (gig.status === "COMPLETED")
    return { ok: false, error: "Already completed" };
  if (gig.status !== "CONFIRMED")
    return { ok: false, error: "Gig isn't confirmed yet" };
  if (!gig.sopFormTemplate)
    return { ok: false, error: "No SOP form configured for this gig" };

  const form = gig.sopFormTemplate;
  const sections = (form.sections as unknown as FormSection[]) ?? [];

  // Resolve referenced attributes.
  const attrIds = new Set<string>();
  for (const s of sections)
    for (const b of s.blocks)
      if (b.type === "ATTRIBUTE") attrIds.add(b.attributeId);
  const attrs = await prisma.attribute.findMany({
    where: { id: { in: Array.from(attrIds) } },
  });
  const attrById = new Map(attrs.map((a) => [a.id, a]));

  const collected: Record<string, unknown> = {};
  const errors: Record<string, string> = {};

  for (const section of sections) {
    for (const block of section.blocks) {
      if (block.type !== "ATTRIBUTE") continue;
      const attr = attrById.get(block.attributeId);
      if (!attr) continue;

      const validation = (attr.validation as Record<string, unknown>) ?? {};
      const required = block.isRequired === true || validation.required === true;
      const raw = formData.getAll(attr.key);
      const isFile =
        attr.type === "SELFIE" ||
        attr.type === "FILE_IMAGE" ||
        attr.type === "FILE_DOC";

      if (isFile) {
        const f = raw.find(
          (r): r is File => typeof r !== "string" && r instanceof File,
        );
        if (!f || f.size === 0) {
          if (required) errors[attr.key] = "required";
          continue;
        }
        try {
          const kind = attr.type === "SELFIE" ? "image" : "document";
          const saved = await saveLocalFile(f, {
            careProviderId: gig.assignedProviderId!,
            kind,
          });
          collected[attr.key] = saved;
        } catch (e) {
          errors[attr.key] = e instanceof Error ? e.message : "upload failed";
        }
        continue;
      }

      const values = raw.map(String).filter((v) => v !== "");
      if (values.length === 0) {
        if (required) errors[attr.key] = "required";
        continue;
      }
      collected[attr.key] =
        attr.type === "MULTI_SELECT" ? values : values[0];
    }
  }

  if (Object.keys(errors).length > 0) {
    const msg = Object.entries(errors)
      .map(([k, v]) => `${k}: ${v}`)
      .join("; ");
    return { ok: false, error: `Validation failed — ${msg}` };
  }

  await prisma.$transaction([
    prisma.formResponse.create({
      data: {
        careProviderId: gig.assignedProviderId,
        formTemplateId: form.id,
        partKey: `gig:${gigId}`,
        data: collected as Prisma.InputJsonValue,
      },
    }),
    prisma.gig.update({
      where: { id: gigId },
      data: { status: "COMPLETED", completedAt: new Date() },
    }),
    prisma.careProviderEvent.create({
      data: {
        careProviderId: gig.assignedProviderId,
        type: "GIG_COMPLETED",
        payload: { gigId, gigTitle: gig.title },
      },
    }),
  ]);

  revalidatePath(`/admin/gigs/${gigId}`);
  return { ok: true };
}
