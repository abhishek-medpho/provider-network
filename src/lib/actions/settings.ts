"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  saveChannelConfig,
  invalidateConfigCache,
} from "@/lib/channels/config";
import { sendWhatsAppText } from "@/lib/ultramsg";
import { emailSender } from "@/lib/channels/email";
import type { Channel } from "@/lib/channels/types";
import { SECRET_UNCHANGED } from "@/lib/channels/constants";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user;
}

/**
 * Saved values returned to the UI. We mask credentials so an admin who
 * doesn't have the secret can't pull it back via Network tab.
 * `SECRET_UNCHANGED` (imported from constants.ts) is the sentinel used by
 * password inputs to mean "keep existing".
 */
function mask(secret: string | undefined | null): string {
  if (!secret) return "";
  if (secret.length <= 4) return "•".repeat(secret.length);
  return "••••••••" + secret.slice(-4);
}

export type WhatsAppFormState = {
  enabled: boolean;
  instanceId: string;
  /** Display-only mask of the saved token; empty if no token yet */
  tokenMasked: string;
  baseUrl: string;
  defaultCountryCode: string;
  configuredVia: "db" | "env" | "none";
};

export type EmailFormState = {
  enabled: boolean;
  gmailUser: string;
  /** Display-only mask of the saved app password */
  gmailAppPasswordMasked: string;
  fromName: string;
  replyTo: string;
  configuredVia: "db" | "env" | "none";
};

/**
 * Where is this channel currently configured from? Decides which "source"
 * label the UI shows so admins know whether saving will override env vars.
 */
async function configuredVia(channel: Channel): Promise<"db" | "env" | "none"> {
  const row = await prisma.channelConfig.findUnique({ where: { channel } });
  if (row) return "db";
  if (channel === "WHATSAPP" && process.env.ULTRAMSG_INSTANCE_ID) return "env";
  if (channel === "EMAIL" && process.env.GMAIL_USER) return "env";
  return "none";
}

export async function getWhatsAppFormState(): Promise<WhatsAppFormState> {
  await requireAdmin();
  const row = await prisma.channelConfig.findUnique({
    where: { channel: "WHATSAPP" },
  });
  const cfg = (row?.config as Record<string, unknown> | undefined) ?? {};
  return {
    enabled: row?.enabled ?? true,
    instanceId:
      (cfg.instanceId as string | undefined) ??
      process.env.ULTRAMSG_INSTANCE_ID ??
      "",
    tokenMasked: mask(
      (cfg.token as string | undefined) ?? process.env.ULTRAMSG_TOKEN,
    ),
    baseUrl:
      (cfg.baseUrl as string | undefined) ??
      process.env.ULTRAMSG_BASE_URL ??
      "https://api.ultramsg.com",
    defaultCountryCode:
      (cfg.defaultCountryCode as string | undefined) ??
      process.env.ULTRAMSG_DEFAULT_COUNTRY_CODE ??
      "91",
    configuredVia: await configuredVia("WHATSAPP"),
  };
}

export async function getEmailFormState(): Promise<EmailFormState> {
  await requireAdmin();
  const row = await prisma.channelConfig.findUnique({
    where: { channel: "EMAIL" },
  });
  const cfg = (row?.config as Record<string, unknown> | undefined) ?? {};
  const gmailUser =
    (cfg.gmailUser as string | undefined) ?? process.env.GMAIL_USER ?? "";
  return {
    enabled: row?.enabled ?? true,
    gmailUser,
    gmailAppPasswordMasked: mask(
      (cfg.gmailAppPassword as string | undefined) ??
        process.env.GMAIL_APP_PASSWORD,
    ),
    fromName:
      (cfg.fromName as string | undefined) ??
      process.env.EMAIL_FROM_NAME ??
      "Labstack Network",
    replyTo:
      (cfg.replyTo as string | undefined) ??
      process.env.EMAIL_REPLY_TO ??
      gmailUser,
    configuredVia: await configuredVia("EMAIL"),
  };
}

export async function saveWhatsAppConfig(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const enabled = formData.get("enabled") === "on";
  const instanceId = String(formData.get("instanceId") ?? "").trim();
  const tokenInput = String(formData.get("token") ?? "").trim();
  const baseUrl =
    String(formData.get("baseUrl") ?? "").trim() ||
    "https://api.ultramsg.com";
  const defaultCountryCode =
    String(formData.get("defaultCountryCode") ?? "").trim() || "91";

  if (!instanceId) throw new Error("Instance ID is required");

  // Resolve token: if admin left it as the mask sentinel, reuse the saved value.
  const existing = await prisma.channelConfig.findUnique({
    where: { channel: "WHATSAPP" },
  });
  const existingCfg =
    (existing?.config as Record<string, unknown> | undefined) ?? {};
  const token =
    tokenInput && tokenInput !== SECRET_UNCHANGED
      ? tokenInput
      : ((existingCfg.token as string | undefined) ??
        process.env.ULTRAMSG_TOKEN ??
        "");

  if (!token)
    throw new Error("Token is required (paste the Ultramsg token)");

  await saveChannelConfig(
    "WHATSAPP",
    { instanceId, token, baseUrl, defaultCountryCode },
    enabled,
    user.id,
  );
}

export async function saveEmailConfig(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const enabled = formData.get("enabled") === "on";
  const gmailUser = String(formData.get("gmailUser") ?? "").trim();
  const gmailAppPasswordInput = String(
    formData.get("gmailAppPassword") ?? "",
  ).trim();
  const fromName =
    String(formData.get("fromName") ?? "").trim() || "Labstack Network";
  const replyTo =
    String(formData.get("replyTo") ?? "").trim() || gmailUser;

  if (!gmailUser) throw new Error("Gmail address is required");

  const existing = await prisma.channelConfig.findUnique({
    where: { channel: "EMAIL" },
  });
  const existingCfg =
    (existing?.config as Record<string, unknown> | undefined) ?? {};
  const gmailAppPassword =
    gmailAppPasswordInput && gmailAppPasswordInput !== SECRET_UNCHANGED
      ? gmailAppPasswordInput
      : ((existingCfg.gmailAppPassword as string | undefined) ??
        process.env.GMAIL_APP_PASSWORD ??
        "");

  if (!gmailAppPassword)
    throw new Error("App password is required (16 chars from Google)");

  await saveChannelConfig(
    "EMAIL",
    { gmailUser, gmailAppPassword, fromName, replyTo },
    enabled,
    user.id,
  );
}

/**
 * Send a test message via the configured channel. Used by the settings page's
 * "Send test" button. Returns a result the UI can render — DOES NOT throw on
 * send failure; bad creds are a UX problem to surface, not a 500.
 */
export async function testWhatsApp(formData: FormData): Promise<{
  ok: boolean;
  message: string;
}> {
  await requireAdmin();
  const to = String(formData.get("to") ?? "").trim();
  if (!to) return { ok: false, message: "Phone number required" };

  // Invalidate cache so this send uses freshly-saved settings, not a
  // cached entry from before save.
  invalidateConfigCache("WHATSAPP");

  const result = await sendWhatsAppText(
    to,
    "✅ Labstack Network test message.\n\nIf you got this, your WhatsApp channel is wired up.",
  );
  return result.ok
    ? { ok: true, message: `Sent (id: ${result.messageId})` }
    : { ok: false, message: result.error };
}

export async function testEmail(formData: FormData): Promise<{
  ok: boolean;
  message: string;
}> {
  await requireAdmin();
  const to = String(formData.get("to") ?? "").trim();
  if (!to) return { ok: false, message: "Email address required" };

  invalidateConfigCache("EMAIL");

  const result = await emailSender.send({
    to,
    subject: "Labstack Network test email",
    body: "If you got this, your Email channel is wired up.\n\n— Labstack Network",
  });
  return result.ok
    ? { ok: true, message: `Sent (id: ${result.messageId})` }
    : { ok: false, message: result.error };
}
