/**
 * Runtime channel configuration.
 *
 * Order of precedence (per channel):
 *   1. ChannelConfig row in DB (set by admin via /admin/settings)
 *   2. Environment variables (legacy / bootstrap)
 *   3. Null → sender treats as not-configured
 *
 * Results are cached in-process for `CACHE_TTL_MS` to avoid hammering the
 * DB on every send. The settings page calls `invalidateConfigCache()` after
 * writes so admins see their changes immediately.
 */

import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { Channel } from "./types";

const CACHE_TTL_MS = 60_000;

type WhatsAppConfig = {
  instanceId: string;
  token: string;
  baseUrl: string;
  defaultCountryCode: string;
  enabled: boolean;
};

type EmailConfig = {
  gmailUser: string;
  gmailAppPassword: string;
  fromName: string;
  replyTo: string;
  enabled: boolean;
};

type CacheEntry<T> = { value: T | null; fetchedAt: number };

const cache: {
  WHATSAPP?: CacheEntry<WhatsAppConfig>;
  EMAIL?: CacheEntry<EmailConfig>;
} = {};

export function invalidateConfigCache(channel?: Channel): void {
  if (!channel) {
    delete cache.WHATSAPP;
    delete cache.EMAIL;
    return;
  }
  if (channel === "WHATSAPP") delete cache.WHATSAPP;
  else if (channel === "EMAIL") delete cache.EMAIL;
}

function fresh(entry: CacheEntry<unknown> | undefined): boolean {
  return !!entry && Date.now() - entry.fetchedAt < CACHE_TTL_MS;
}

/**
 * Load the DB row for a channel. Returns the raw config blob + enabled flag,
 * or null if no row exists yet. Errors (e.g. DB connection blip) → null,
 * letting the caller fall back to env vars.
 */
async function loadFromDb(
  channel: Channel,
): Promise<{ enabled: boolean; config: Record<string, unknown> } | null> {
  try {
    const row = await prisma.channelConfig.findUnique({ where: { channel } });
    if (!row) return null;
    return {
      enabled: row.enabled,
      config: (row.config as Record<string, unknown>) ?? {},
    };
  } catch (err) {
    console.warn(`[channels/config] DB read failed for ${channel}:`, err);
    return null;
  }
}

export async function getWhatsAppConfig(): Promise<WhatsAppConfig | null> {
  if (fresh(cache.WHATSAPP)) return cache.WHATSAPP!.value;

  const dbRow = await loadFromDb("WHATSAPP");

  const fromDb = dbRow?.config ?? {};
  const instanceId =
    (fromDb.instanceId as string | undefined) ??
    process.env.ULTRAMSG_INSTANCE_ID ??
    "";
  const token =
    (fromDb.token as string | undefined) ?? process.env.ULTRAMSG_TOKEN ?? "";

  // If neither DB nor env has both creds, this channel is not configured.
  if (!instanceId || !token) {
    cache.WHATSAPP = { value: null, fetchedAt: Date.now() };
    return null;
  }

  const value: WhatsAppConfig = {
    instanceId,
    token,
    baseUrl:
      (fromDb.baseUrl as string | undefined) ??
      process.env.ULTRAMSG_BASE_URL ??
      "https://api.ultramsg.com",
    defaultCountryCode:
      (fromDb.defaultCountryCode as string | undefined) ??
      process.env.ULTRAMSG_DEFAULT_COUNTRY_CODE ??
      "91",
    enabled: dbRow?.enabled ?? true,
  };
  cache.WHATSAPP = { value, fetchedAt: Date.now() };
  return value;
}

export async function getEmailConfig(): Promise<EmailConfig | null> {
  if (fresh(cache.EMAIL)) return cache.EMAIL!.value;

  const dbRow = await loadFromDb("EMAIL");

  const fromDb = dbRow?.config ?? {};
  const gmailUser =
    (fromDb.gmailUser as string | undefined) ?? process.env.GMAIL_USER ?? "";
  const gmailAppPassword =
    (fromDb.gmailAppPassword as string | undefined) ??
    process.env.GMAIL_APP_PASSWORD ??
    "";

  if (!gmailUser || !gmailAppPassword) {
    cache.EMAIL = { value: null, fetchedAt: Date.now() };
    return null;
  }

  const value: EmailConfig = {
    gmailUser,
    gmailAppPassword,
    fromName:
      (fromDb.fromName as string | undefined) ??
      process.env.EMAIL_FROM_NAME ??
      "Labstack Network",
    replyTo:
      (fromDb.replyTo as string | undefined) ??
      process.env.EMAIL_REPLY_TO ??
      gmailUser,
    enabled: dbRow?.enabled ?? true,
  };
  cache.EMAIL = { value, fetchedAt: Date.now() };
  return value;
}

/**
 * Persist new config + invalidate the in-process cache. Caller is expected to
 * have validated input (e.g. mandatory fields per channel).
 */
export async function saveChannelConfig(
  channel: Channel,
  config: Record<string, unknown>,
  enabled: boolean,
  updatedById?: string,
): Promise<void> {
  const json = config as Prisma.InputJsonValue;
  await prisma.channelConfig.upsert({
    where: { channel },
    update: { config: json, enabled, updatedById: updatedById ?? null },
    create: { channel, config: json, enabled, updatedById: updatedById ?? null },
  });
  invalidateConfigCache(channel);
}
