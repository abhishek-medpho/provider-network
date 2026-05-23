/**
 * Constants shared between server actions (settings.ts) and the page
 * (admin/settings/page.tsx). These can't live in settings.ts because that
 * file is "use server" and Next.js only allows async function exports there.
 */

/**
 * Sentinel placeholder for password fields. When an admin saves the settings
 * form without typing the secret, the input still carries this value (it's
 * what we put in `defaultValue`). The save action detects this and keeps
 * whatever credential was previously stored instead of overwriting.
 */
export const SECRET_UNCHANGED = "__KEEP_EXISTING__";
