/**
 * Storage abstraction. Currently a single local-filesystem implementation;
 * swap to R2 / S3 / Supabase by adding a parallel module + a STORAGE_DRIVER
 * env switch.
 *
 * Files are stored under <root>/<careProviderId>/<uuid>.<ext> and served
 * by the route at /uploads/[...path].
 */

import { mkdir, writeFile } from "node:fs/promises";
import { existsSync, createReadStream } from "node:fs";
import { join, extname, normalize } from "node:path";
import { randomUUID } from "node:crypto";

const UPLOAD_ROOT =
  process.env.STORAGE_LOCAL_ROOT ??
  join(process.cwd(), "uploads");

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB — modern phone photos can hit 5-8 MB easily.

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const ALLOWED_DOC_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export type FileKind = "image" | "document";

export type SavedFile = {
  /** Relative path key, used as the stored value: "{cpId}/{uuid}.jpg" */
  key: string;
  /** URL relative to app origin that serves the file */
  url: string;
  /** Original filename (for display) */
  originalName: string;
  size: number;
  mimeType: string;
};

export async function saveLocalFile(
  file: File,
  opts: { careProviderId: string; kind: FileKind },
): Promise<SavedFile> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(
      `File too large (${Math.round(file.size / 1024)} KB). Max ${MAX_FILE_BYTES / 1024 / 1024} MB.`,
    );
  }
  const mime = file.type || "application/octet-stream";
  const allowedSet =
    opts.kind === "image" ? ALLOWED_IMAGE_TYPES : ALLOWED_DOC_TYPES;
  if (!allowedSet.has(mime)) {
    throw new Error(`Unsupported file type: ${mime}`);
  }

  const dir = normalize(join(UPLOAD_ROOT, sanitize(opts.careProviderId)));
  await mkdir(dir, { recursive: true });

  const ext = pickExtension(file.name, mime);
  const filename = `${randomUUID()}${ext}`;
  const fullPath = join(dir, filename);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(fullPath, buffer);

  const key = `${sanitize(opts.careProviderId)}/${filename}`;
  return {
    key,
    url: `/uploads/${key}`,
    originalName: file.name,
    size: file.size,
    mimeType: mime,
  };
}

/**
 * Resolve a key (e.g. "abc123/def-ghi.jpg") to an absolute path under
 * UPLOAD_ROOT. Refuses any path that tries to escape the root.
 */
export function resolveLocalPath(key: string): string | null {
  const safe = normalize(key).replace(/^\/+/, "");
  if (safe.includes("..")) return null;
  const fullPath = normalize(join(UPLOAD_ROOT, safe));
  if (!fullPath.startsWith(UPLOAD_ROOT)) return null;
  if (!existsSync(fullPath)) return null;
  return fullPath;
}

export function streamLocalFile(absolutePath: string) {
  return createReadStream(absolutePath);
}

function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function pickExtension(name: string, mime: string): string {
  const fromName = extname(name).toLowerCase();
  if (fromName) return fromName;
  switch (mime) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/heic":
      return ".heic";
    case "image/heif":
      return ".heif";
    case "application/pdf":
      return ".pdf";
    default:
      return "";
  }
}
