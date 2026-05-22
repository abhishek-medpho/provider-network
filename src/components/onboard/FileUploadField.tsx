"use client";

/**
 * Client-side file picker with:
 *   • Inline preview + size info
 *   • Auto-compression of large images (canvas → JPEG ~0.8 quality, max 1600px)
 *   • Type validation before submit
 *   • Friendly inline errors instead of cryptic upload failures
 *
 * Falls back to the original file if compression fails (e.g. browser can't
 * decode HEIC). The server still enforces its own per-file size + MIME cap.
 */

import { useRef, useState } from "react";

type Props = {
  name: string;
  /** Comma-separated MIME types or `image/*` */
  accept: string;
  /** "user" = front camera, "environment" = back, undefined = let user pick */
  capture?: "user" | "environment";
  required?: boolean;
  /** Renderer help text — already wrapped in a <p> by the parent */
  helpText?: string;
  /** If a file was already uploaded previously (returning user) */
  existing?: { url: string; originalName?: string; isDoc?: boolean } | null;
  /** Soft cap; over this, we attempt to compress images. */
  compressThresholdBytes?: number;
  /** Hard cap; over this, we reject the file with an inline error. */
  maxBytes?: number;
};

const DEFAULT_COMPRESS = 1 * 1024 * 1024;       // 1 MB → start compressing
const DEFAULT_MAX = 10 * 1024 * 1024;            // 10 MB → reject
const MAX_DIMENSION_PX = 1600;
const JPEG_QUALITY = 0.8;

type State =
  | { kind: "idle" }
  | { kind: "compressing"; name: string; originalSize: number }
  | {
      kind: "ready";
      name: string;
      originalSize: number;
      finalSize: number;
      compressed: boolean;
    }
  | { kind: "error"; message: string };

export function FileUploadField({
  name,
  accept,
  capture,
  required,
  helpText,
  existing,
  compressThresholdBytes = DEFAULT_COMPRESS,
  maxBytes = DEFAULT_MAX,
}: Props) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setState({ kind: "idle" });
      return;
    }

    if (!isAcceptable(file, accept)) {
      setState({
        kind: "error",
        message: `Unsupported file type${file.type ? ` (${file.type})` : ""}. Pick a different file.`,
      });
      e.target.value = "";
      return;
    }

    const isImage = file.type.startsWith("image/");
    let outFile = file;

    if (isImage && file.size > compressThresholdBytes) {
      setState({ kind: "compressing", name: file.name, originalSize: file.size });
      try {
        outFile = await compressImage(file);
        replaceInputFile(e.target, outFile);
      } catch {
        // Compression failed (HEIC on Chrome, decode error). Keep original.
        outFile = file;
      }
    }

    if (outFile.size > maxBytes) {
      setState({
        kind: "error",
        message: `File is ${fmt(outFile.size)} — too large. Try a smaller image (max ${fmt(maxBytes)}).`,
      });
      e.target.value = "";
      return;
    }

    setState({
      kind: "ready",
      name: outFile.name,
      originalSize: file.size,
      finalSize: outFile.size,
      compressed: outFile.size < file.size,
    });
  }

  return (
    <div>
      {existing && (
        <div className="mb-2 rounded-lg border border-zinc-200 bg-white p-2 flex items-center gap-3">
          {!existing.isDoc ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={existing.url}
              alt={existing.originalName ?? "Uploaded"}
              className="w-16 h-16 rounded-md object-cover bg-zinc-100"
            />
          ) : (
            <div className="w-16 h-16 rounded-md bg-zinc-100 flex items-center justify-center text-2xl">
              📄
            </div>
          )}
          <div className="text-xs text-zinc-700">
            <div className="font-medium">Already uploaded</div>
            <div className="text-zinc-500">{existing.originalName ?? "—"}</div>
            <div className="text-zinc-500 mt-0.5">
              Pick a new file below to replace.
            </div>
          </div>
        </div>
      )}

      <label className="block">
        <input
          ref={inputRef}
          name={name}
          type="file"
          accept={accept}
          capture={capture}
          required={required && !existing}
          onChange={onChange}
          className="block w-full text-sm file:mr-3 file:px-4 file:py-2.5 file:rounded-lg file:border-0 file:bg-zinc-900 file:text-white file:text-sm file:font-medium hover:file:bg-zinc-800"
        />
      </label>

      {helpText && <p className="mt-1 text-xs text-zinc-500">{helpText}</p>}

      {state.kind === "compressing" && (
        <p className="mt-1 text-xs text-zinc-500">
          Compressing {state.name} ({fmt(state.originalSize)})…
        </p>
      )}
      {state.kind === "ready" && (
        <p className="mt-1 text-xs text-emerald-700">
          ✓ {state.name} · {fmt(state.finalSize)}
          {state.compressed && ` (compressed from ${fmt(state.originalSize)})`}
        </p>
      )}
      {state.kind === "error" && (
        <p className="mt-1 text-xs text-red-700 font-medium">{state.message}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function isAcceptable(file: File, accept: string): boolean {
  if (!accept || accept === "*" || accept === "*/*") return true;
  const list = accept.split(",").map((s) => s.trim().toLowerCase());
  const type = (file.type || "").toLowerCase();
  const name = file.name.toLowerCase();
  return list.some((entry) => {
    if (entry.startsWith(".")) return name.endsWith(entry);
    if (entry.endsWith("/*")) return type.startsWith(entry.slice(0, -1));
    return type === entry;
  });
}

async function compressImage(file: File): Promise<File> {
  const img = await loadImage(file);
  const { width, height } = scaleDown(img.width, img.height, MAX_DIMENSION_PX);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d ctx");
  ctx.drawImage(img, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((res) =>
    canvas.toBlob(res, "image/jpeg", JPEG_QUALITY),
  );
  if (!blob) throw new Error("toBlob returned null");
  const renamed = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], renamed, { type: "image/jpeg" });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image decode failed"));
    };
    img.src = url;
  });
}

function scaleDown(w: number, h: number, max: number) {
  if (w <= max && h <= max) return { width: w, height: h };
  const ratio = w > h ? max / w : max / h;
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) };
}

function replaceInputFile(input: HTMLInputElement, file: File) {
  // DataTransfer is the only cross-browser way to programmatically set
  // a FileList. Safari supports it since 14+.
  try {
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
  } catch {
    // Older browser — bail. Form will submit original file.
  }
}

function fmt(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
