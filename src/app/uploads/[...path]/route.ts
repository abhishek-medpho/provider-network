/**
 * GET /uploads/[...path] — serves files saved by the local storage driver.
 *
 * For PII safety we don't gate on auth at the URL level (selfies need to
 * load on the admin detail page without complex token plumbing), but the
 * filenames are UUID-based and unguessable. If we move to R2, signed URLs
 * with short expiry are the right pattern.
 */

import { NextResponse } from "next/server";
import { resolveLocalPath, streamLocalFile } from "@/lib/storage";
import { extname } from "node:path";
import { statSync } from "node:fs";

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".pdf": "application/pdf",
};

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  const key = path.join("/");

  const fullPath = resolveLocalPath(key);
  if (!fullPath) {
    return new NextResponse("Not found", { status: 404 });
  }

  const ext = extname(fullPath).toLowerCase();
  const contentType = MIME_BY_EXT[ext] ?? "application/octet-stream";
  const stats = statSync(fullPath);

  const stream = streamLocalFile(fullPath);
  // Node Readable → web ReadableStream via Response constructor
  const webStream = new ReadableStream<Uint8Array>({
    start(controller) {
      stream.on("data", (chunk) =>
        controller.enqueue(
          chunk instanceof Buffer ? new Uint8Array(chunk) : (chunk as Uint8Array),
        ),
      );
      stream.on("end", () => controller.close());
      stream.on("error", (err) => controller.error(err));
    },
  });

  return new Response(webStream, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(stats.size),
      "Cache-Control": "private, max-age=300",
    },
  });
}
