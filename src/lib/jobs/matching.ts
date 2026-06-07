/**
 * Job ↔ provider matching.
 *
 * Given a Job, find ACTIVE providers of the right profile type who are
 * within range and have the required skills, excluding anyone who already
 * has an offer for this job. Ranked by distance (closest first).
 *
 * Location matching is two-pronged:
 *   - If the job has lat/lng AND a provider has a home_location geo point,
 *     we compute haversine distance and gate on radiusKm.
 *   - Otherwise we fall back to pincode equality (job.pincode ===
 *     provider.pincodeHome). Pincode matches get distanceKm = null.
 *
 * Skills matching: job.requiredSkills is a list of
 * { attributeKey, values[] }. A provider matches if, for every required
 * attribute, their stored attribute value (array or scalar) contains ALL
 * the required values. Empty/absent requiredSkills means "no skill gate".
 */

import { prisma } from "@/lib/db";

export type RequiredSkill = { attributeKey: string; values: string[] };

export type MatchCandidate = {
  careProviderId: string;
  name: string | null;
  phone: string;
  email: string | null;
  pincodeHome: string | null;
  distanceKm: number | null;
  matchedBy: "geo" | "pincode";
};

type JobForMatch = {
  id: string;
  profileTypeId: string;
  pincode: string | null;
  lat: number | null;
  lng: number | null;
  radiusKm: number;
  requiredSkills: unknown;
};

export async function matchProvidersForJob(
  jobId: string,
  opts: { limit?: number } = {},
): Promise<MatchCandidate[]> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      profileTypeId: true,
      pincode: true,
      lat: true,
      lng: true,
      radiusKm: true,
      requiredSkills: true,
    },
  });
  if (!job) return [];
  return matchProviders(job, opts);
}

/**
 * Core matcher — exported separately so the admin "preview matches"
 * action can run it against an unsaved job draft too.
 */
export async function matchProviders(
  job: JobForMatch,
  opts: { limit?: number } = {},
): Promise<MatchCandidate[]> {
  const limit = opts.limit ?? 200;

  // Providers already offered this job — exclude.
  const existingOffers = await prisma.jobOffer.findMany({
    where: { jobId: job.id },
    select: { careProviderId: true },
  });
  const alreadyOffered = new Set(existingOffers.map((o) => o.careProviderId));

  // Base pool: ACTIVE (or VERIFIED) providers of the right profile type,
  // not opted out, not already offered.
  const providers = await prisma.careProvider.findMany({
    where: {
      profileTypeId: job.profileTypeId,
      status: { in: ["ACTIVE", "VERIFIED"] },
      optedOutAt: null,
      id: { notIn: Array.from(alreadyOffered) },
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

  const requiredSkills = parseRequiredSkills(job.requiredSkills);
  const useGeo = typeof job.lat === "number" && typeof job.lng === "number";

  const candidates: MatchCandidate[] = [];

  for (const p of providers) {
    const attrs = (p.attributes as Record<string, unknown>) ?? {};

    // Skill gate
    if (!providerHasSkills(attrs, requiredSkills)) continue;

    // Location gate
    let distanceKm: number | null = null;
    let matchedBy: "geo" | "pincode" | null = null;

    if (useGeo) {
      const geo = extractGeo(attrs["home_location"]);
      if (geo) {
        const d = haversineKm(job.lat!, job.lng!, geo.lat, geo.lng);
        if (d <= job.radiusKm) {
          distanceKm = Math.round(d * 10) / 10;
          matchedBy = "geo";
        }
      }
    }
    // Pincode fallback (also used when geo didn't match but pincode does —
    // a provider whose GPS is stale but whose home pincode matches the job
    // is still a reasonable candidate).
    if (matchedBy === null && job.pincode && p.pincodeHome === job.pincode) {
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

  // Rank: geo matches by ascending distance first, then pincode matches.
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
    .map((r) => ({
      attributeKey: r.attributeKey,
      values: r.values.map(String),
    }));
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
    // Provider must have ALL required values for this attribute.
    for (const v of req.values) {
      if (!haveSet.has(v)) return false;
    }
  }
  return true;
}

function extractGeo(value: unknown): { lat: number; lng: number } | null {
  if (!value || typeof value !== "object") return null;
  const v = value as { lat?: unknown; lng?: unknown };
  if (typeof v.lat === "number" && typeof v.lng === "number") {
    return { lat: v.lat, lng: v.lng };
  }
  return null;
}

/** Great-circle distance in km between two lat/lng points. */
function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371; // km
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
