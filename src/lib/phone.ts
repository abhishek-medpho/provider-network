/**
 * Phone normalization for India-first use.
 *
 * Input: user-typed phone in any format (e.g. "+91 98765 43210", "9876543210",
 * "098765-43210", "919876543210").
 * Output: digits-only E.164-like string WITHOUT the leading plus, with country
 * code prefixed (e.g. "919876543210").
 *
 * If the user enters a 10-digit Indian mobile, the default country code from
 * env (ULTRAMSG_DEFAULT_COUNTRY_CODE, default "91") is prepended.
 */
export function normalizePhone(input: string): string {
  if (!input) throw new Error("Phone is required");

  const digits = input.replace(/\D/g, "");
  if (!digits) throw new Error("Phone must contain digits");

  const defaultCC = process.env.ULTRAMSG_DEFAULT_COUNTRY_CODE ?? "91";

  // Strip leading 0 for Indian numbers (legacy STD prefix)
  let cleaned = digits.replace(/^0+/, "");

  // 10 digits → assume domestic, prepend default CC
  if (cleaned.length === 10) {
    cleaned = `${defaultCC}${cleaned}`;
  }

  // 12 digits → likely already prefixed (e.g. 91 + 10-digit)
  // 11 digits → could be 1 + US number, leave as-is
  // anything 8-15 digits passes; outside that fails
  if (cleaned.length < 8 || cleaned.length > 15) {
    throw new Error("Phone number is not a valid length");
  }

  return cleaned;
}

/** Strict Indian mobile validator: 10 digits starting with 6-9 after CC stripped. */
export function isValidIndianMobile(normalized: string): boolean {
  const defaultCC = process.env.ULTRAMSG_DEFAULT_COUNTRY_CODE ?? "91";
  if (!normalized.startsWith(defaultCC)) return false;
  const local = normalized.slice(defaultCC.length);
  return /^[6-9]\d{9}$/.test(local);
}

/** Format for display: "+91 98765 43210" */
export function formatPhone(normalized: string): string {
  if (!normalized) return "";
  const defaultCC = process.env.ULTRAMSG_DEFAULT_COUNTRY_CODE ?? "91";
  if (normalized.startsWith(defaultCC)) {
    const local = normalized.slice(defaultCC.length);
    if (local.length === 10) {
      return `+${defaultCC} ${local.slice(0, 5)} ${local.slice(5)}`;
    }
  }
  return `+${normalized}`;
}
