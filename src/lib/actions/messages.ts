"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MessageTemplateKind } from "@prisma/client";
import { extractVariables, renderBody, SAMPLE_VARIABLES } from "@/lib/messageTemplate";
import { sendWhatsAppText } from "@/lib/ultramsg";
import { normalizePhone } from "@/lib/phone";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user;
}

const CODE_REGEX = /^[a-z][a-z0-9_]*$/;

function parseCommonFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const language =
    String(formData.get("language") ?? "en").trim().toLowerCase() || "en";
  const kindStr = String(formData.get("kind") ?? "CUSTOM");
  const kind = (kindStr in MessageTemplateKind
    ? kindStr
    : "CUSTOM") as MessageTemplateKind;
  const body = String(formData.get("body") ?? "");
  const profileTypeIdRaw = String(formData.get("profileTypeId") ?? "").trim();
  const profileTypeId = profileTypeIdRaw === "" ? null : profileTypeIdRaw;
  const active = formData.get("active") === "on";
  return { name, language, kind, body, profileTypeId, active };
}

export async function createMessageTemplate(formData: FormData) {
  await requireAdmin();

  const code = String(formData.get("code") ?? "").trim();
  if (!CODE_REGEX.test(code)) {
    throw new Error(
      "Code must be snake_case: lowercase, starts with a letter, only letters/digits/underscores",
    );
  }

  const { name, language, kind, body, profileTypeId } =
    parseCommonFields(formData);
  if (!name) throw new Error("Name is required");
  if (!body.trim()) throw new Error("Body is required");

  const existing = await prisma.messageTemplate.findUnique({
    where: { code_language: { code, language } },
  });
  if (existing)
    throw new Error(
      `Template with code "${code}" already exists in language "${language}"`,
    );

  const variables = extractVariables(body);

  const created = await prisma.messageTemplate.create({
    data: {
      code,
      name,
      language,
      kind,
      body,
      variables,
      profileTypeId,
      channel: "WHATSAPP",
      active: true,
    },
  });

  revalidatePath("/admin/messages");
  redirect(`/admin/messages/${created.id}`);
}

export async function updateMessageTemplate(id: string, formData: FormData) {
  await requireAdmin();

  const existing = await prisma.messageTemplate.findUnique({ where: { id } });
  if (!existing) throw new Error("Message template not found");

  const { name, language, kind, body, profileTypeId, active } =
    parseCommonFields(formData);
  if (!name) throw new Error("Name is required");
  if (!body.trim()) throw new Error("Body is required");

  const variables = extractVariables(body);

  await prisma.messageTemplate.update({
    where: { id },
    data: { name, language, kind, body, variables, profileTypeId, active },
  });

  revalidatePath("/admin/messages");
  revalidatePath(`/admin/messages/${id}`);
}

export async function archiveMessageTemplate(id: string) {
  await requireAdmin();
  await prisma.messageTemplate.update({
    where: { id },
    data: { active: false },
  });
  revalidatePath("/admin/messages");
  redirect("/admin/messages");
}

export async function activateMessageTemplate(id: string) {
  await requireAdmin();
  await prisma.messageTemplate.update({
    where: { id },
    data: { active: true },
  });
  revalidatePath("/admin/messages");
  revalidatePath(`/admin/messages/${id}`);
}

/**
 * Send a test WhatsApp message rendered with SAMPLE_VARIABLES.
 * Returns a result object so the UI can display success/failure inline.
 */
export async function sendTestMessage(
  id: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string; messageId?: string }> {
  await requireAdmin();
  const tpl = await prisma.messageTemplate.findUnique({ where: { id } });
  if (!tpl) return { ok: false, error: "Template not found" };

  const rawPhone = String(formData.get("test_phone") ?? "").trim();
  if (!rawPhone) return { ok: false, error: "Phone is required" };

  let normalized: string;
  try {
    normalized = normalizePhone(rawPhone);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Invalid phone",
    };
  }

  const rendered = renderBody(tpl.body, SAMPLE_VARIABLES);

  const result = await sendWhatsAppText(normalized, rendered);

  // Persist a record of the test send so it shows up in the messages log later
  await prisma.whatsAppMessage.create({
    data: {
      toPhone: normalized,
      body: rendered,
      messageTemplateId: tpl.id,
      status: result.ok ? "SENT" : "FAILED",
      ultramsgMessageId: result.ok ? result.messageId : null,
      errorMessage: !result.ok ? result.error : null,
      sentAt: result.ok ? new Date() : null,
    },
  });

  return result.ok
    ? { ok: true, messageId: result.messageId }
    : { ok: false, error: result.error };
}
