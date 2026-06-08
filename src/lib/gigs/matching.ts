/**
 * Gig ↔ provider matching, wave-aware.
 *
 * Each broadcast wave widens the net:
 *   - Wave 1: tight radius, full skill requirements (the best, closest set)
 *   - Wave 2+: radius multiplied, skill strictness optionally relaxed
 *
 * Returns ACTIVE/VERIFIED providers of the right role, in range, with the
 * required skills, EXCLUDING anyone already in a GigResponse for this gig
 * (so each wave reaches fresh people). Ranked by distance.
 */

import { prisma } from "@/lib/db";

export type RequiredSkill = { attributeKey: string; values: string[] };

export type GigMatchCandidate = {
  careProviderId: string;
  name: string | null;
  phone: string;
  email: string | null;
  pincodeHome: string | null;
  distanceKm: number | null;
  matchedBy: "geo" | "pincode";
};

type GigForMatch = {
  id: string;
  profileTypeId: string;
  pincode: string | null;
  lat: number | null;
  lng: number | null;
  radiusKm: number;
  requiredSkills: unknown;
};

/**
 * Match candidates for a given wave. radiusMultiplier widens range; if
 * relaxSkills is true, the skill gate is dropped entirely (last-resort
 * waves where you just need a warm body of the right role nearby).
 */
export async function matchForWave(
  gig: GigForMatch,
  opts: {
    wave: number;
    radiusMultiplier?: number;
    relaxSkills?: boolean;
    limit?: number;
  },
): Promise<GigMatchCandidate[]> {
  const limit = opts.limit ?? 100;
  const radiusKm = gig.radiusKm * (opts.radiusMultiplier ?? 1);

  // Exclude anyone already broadcast to (any wave) for this gig.
  const existing = await prisma.gigResponse.findMany({
    where: { gigId: gig.id },
    select: { careProviderId: true },
  });
  const alreadyReached = new Set(existing.map((r) => r.careProviderId));

  const providers = await prisma.careProvider.findMany({
    where: {
      profileTypeId: gig.profileTypeId,
      status: { in: ["ACTIVE", "VERIFIED"] },
      optedOutAt: null,
      id: { notIn: Array.from(alreadyReached) },
    },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      pincodeHome: true,
      attributes: true,
    },
  });

  const requiredSkills = opts.relaxSkills
    ? []
    : parseRequiredSkills(gig.requiredSkills);
  const useGeo = typeof gig.lat === "number" && typeof gig.lng === "number";

  const candidates: GigMatchCandidate[] = [];
  for (const p of providers) {
    const attrs = (p.attributes as Record<string, unknown>) ?? {};
    if (!providerHasSkills(attrs, requiredSkills)) continue;

    let distanceKm: number | null = null;
    let matchedBy: "geo" | "pincode" | null = null;

    if (useGeo) {
      const geo = extractGeo(attrs["home_location"]);
      if (geo) {
        const d = haversineKm(gig.lat!, gig.lng!, geo.lat, geo.lng);
        if (d <= radiusKm) {
          distanceKm = Math.round(d * 10) / 10;
          matchedBy = "geo";
        }
      }
    }
    if (matchedBy === null && gig.pincode && p.pincodeHome === gig.pincode) {
      matchedBy = "pincode";
    }
    if (matchedBy === null) continue;

    candidates.push({
      careProviderId: p.id,
      name: p.name,
      phone: p.phone,
      email: p.email,
      pincodeHome: p.pincodeHome,
      distanceKm,
      matchedBy,
    });
  }

  candidates.sort((a, b) => {
    if (a.distanceKm !== null && b.distanceKm !== null)
      return a.distanceKm - b.distanceKm;
    if (a.distanceKm !== null) return -1;
    if (b.distanceKm !== null) return 1;
    return 0;
  });

  return candidates.slice(0, limit);
}

// ───────────── helpers ─────────────

function parseRequiredSkills(raw: unknown): RequiredSkill[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (r): r is RequiredSkill =>
        r &&
        typeof r === "object" &&
        typeof (r as RequiredSkill).attributeKey === "string" &&
        Array.isArray((r as RequiredSkill).values),
    )
    .map((r) => ({ attributeKey: r.attributeKey, values: r.values.map(String) }));
}

function providerHasSkills(
  attrs: Record<string, unknown>,
  required: RequiredSkill[],
): boolean {
  for (const req of required) {
    if (req.values.length === 0) continue;
    const have = attrs[req.attributeKey];
    const haveSet = new Set(
      Array.isArray(have) ? have.map(String) : have != null ? [String(have)] : [],
    );
    for (const v of req.values) if (!haveSet.has(v)) return false;
  }
  return true;
}

function extractGeo(value: unknown): { lat: number; lng: number } | null {
  if (!value || typeof value !== "object") return null;
  const v = value as { lat?: unknown; lng?: unknown };
  if (typeof v.lat === "number" && typeof v.lng === "number")
    return { lat: v.lat, lng: v.lng };
  return null;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
