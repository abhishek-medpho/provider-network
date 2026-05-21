/**
 * Helpers for message template body rendering and variable detection.
 * Pure functions — safe to import from server and client components.
 */

const VAR_REGEX = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

/** Extract unique variable names referenced in the body, in first-seen order. */
export function extractVariables(body: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const match of body.matchAll(VAR_REGEX)) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}

/** Replace {{var}} occurrences in body with values from `vars`. */
export function renderBody(
  body: string,
  vars: Record<string, string | undefined>,
): string {
  return body.replace(VAR_REGEX, (full, name: string) => {
    const v = vars[name];
    return v !== undefined && v !== "" ? v : full;
  });
}

/**
 * Sensible sample values used for the admin preview pane.
 * Falls back to the variable name in brackets if no mapping.
 */
export const SAMPLE_VARIABLES: Record<string, string> = {
  name: "Saini",
  first_name: "Saini",
  full_name: "Saini Pal",
  role: "NURSE",
  role_label: "Nurse",
  form_link: "https://app.example.com/onboard/abc123",
  pincode: "560100",
  city: "Bangalore",
  ttl: "15",
  org: "Care Provider Platform",
  expires: "10:30 PM",
};

export function buildPreview(body: string): string {
  return renderBody(body, SAMPLE_VARIABLES);
}
