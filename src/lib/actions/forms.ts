"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FormPurpose, FormTemplateStatus, type Prisma } from "@prisma/client";
import {
  defaultActionsForPurpose,
  defaultStarterSections,
  type FormSection,
  type FormAction,
} from "@/lib/types/form";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user;
}

export async function createForm(formData: FormData) {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name is required");

  const purposeStr = String(formData.get("purpose") ?? "ONBOARDING");
  const purpose = (purposeStr in FormPurpose
    ? purposeStr
    : "ONBOARDING") as FormPurpose;

  const profileTypeIdRaw = String(formData.get("profileTypeId") ?? "").trim();
  const profileTypeId = profileTypeIdRaw === "" ? null : profileTypeIdRaw;

  const sections = defaultStarterSections(purpose);
  const actions = defaultActionsForPurpose(purpose);

  const created = await prisma.formTemplate.create({
    data: {
      name,
      purpose,
      profileTypeId,
      sections: sections as unknown as Prisma.InputJsonValue,
      actions: actions as unknown as Prisma.InputJsonValue,
      status: "DRAFT",
    },
  });

  revalidatePath("/admin/forms");
  redirect(`/admin/forms/${created.id}`);
}

export async function updateFormMetadata(id: string, formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name is required");

  const profileTypeIdRaw = String(formData.get("profileTypeId") ?? "").trim();
  const profileTypeId = profileTypeIdRaw === "" ? null : profileTypeIdRaw;

  await prisma.formTemplate.update({
    where: { id },
    data: { name, profileTypeId },
  });
  revalidatePath(`/admin/forms/${id}`);
  revalidatePath("/admin/forms");
}

/** Persist a complete sections array (used by the visual builder). */
export async function updateFormSections(
  id: string,
  sections: FormSection[],
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  try {
    await prisma.formTemplate.update({
      where: { id },
      data: { sections: sections as unknown as Prisma.InputJsonValue },
    });
    revalidatePath(`/admin/forms/${id}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Persist actions array. */
export async function updateFormActions(
  id: string,
  actions: FormAction[],
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  try {
    await prisma.formTemplate.update({
      where: { id },
      data: { actions: actions as unknown as Prisma.InputJsonValue },
    });
    revalidatePath(`/admin/forms/${id}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function publishForm(id: string) {
  await requireAdmin();
  await prisma.formTemplate.update({
    where: { id },
    data: { status: FormTemplateStatus.PUBLISHED, publishedAt: new Date() },
  });
  revalidatePath(`/admin/forms/${id}`);
  revalidatePath("/admin/forms");
}

export async function unpublishForm(id: string) {
  await requireAdmin();
  await prisma.formTemplate.update({
    where: { id },
    data: { status: FormTemplateStatus.DRAFT },
  });
  revalidatePath(`/admin/forms/${id}`);
  revalidatePath("/admin/forms");
}

export async function archiveForm(id: string) {
  await requireAdmin();
  await prisma.formTemplate.update({
    where: { id },
    data: { status: FormTemplateStatus.ARCHIVED, archivedAt: new Date() },
  });
  revalidatePath("/admin/forms");
  redirect("/admin/forms");
}
