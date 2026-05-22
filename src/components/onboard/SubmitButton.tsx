"use client";

/**
 * Submit button that shows a spinner + "Submitting..." while the parent
 * form's server action is in flight. Reads state via useFormStatus so it
 * works automatically without lifting state to the page.
 *
 * Also enforces a client-side total-payload guard: if the FormData is
 * larger than `maxBytesTotal`, the submit is cancelled and an inline
 * error is shown — this prevents the user from ever seeing the raw
 * nginx 413 page.
 */

import { useFormStatus } from "react-dom";
import { useState } from "react";

type Props = {
  label?: string;
  className?: string;
  name?: string;
  value?: string;
  /** Max combined size of all form fields. Defaults to ~22 MB (safe below nginx's 25 MB). */
  maxBytesTotal?: number;
};

const DEFAULT_MAX_TOTAL = 22 * 1024 * 1024;

export function SubmitButton({
  label = "Submit",
  className,
  name,
  value,
  maxBytesTotal = DEFAULT_MAX_TOTAL,
}: Props) {
  const status = useFormStatus();
  const [oversize, setOversize] = useState<number | null>(null);

  const baseClass =
    className ??
    "w-full sm:w-auto px-6 py-3 rounded-lg bg-zinc-900 text-white text-base font-medium hover:bg-zinc-800 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2";

  function onClick(e: React.MouseEvent<HTMLButtonElement>) {
    // Inspect the form payload before letting it submit. If the total
    // payload is bigger than the proxy will accept, block + warn here
    // instead of letting nginx return its 413 HTML page.
    const form = (e.currentTarget as HTMLButtonElement).form;
    if (!form) return;
    let total = 0;
    const fd = new FormData(form);
    for (const [, v] of fd.entries()) {
      if (v instanceof File) total += v.size;
      else total += new Blob([v]).size;
    }
    if (total > maxBytesTotal) {
      e.preventDefault();
      setOversize(total);
    } else {
      setOversize(null);
    }
  }

  return (
    <div className="w-full sm:w-auto flex flex-col items-end gap-2">
      <button
        type="submit"
        name={name}
        value={value}
        disabled={status.pending}
        onClick={onClick}
        className={baseClass}
      >
        {status.pending && (
          <svg
            className="animate-spin h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
              className="opacity-25"
            />
            <path
              fill="currentColor"
              d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"
              className="opacity-75"
            />
          </svg>
        )}
        {status.pending ? "Submitting…" : label}
      </button>
      {oversize !== null && (
        <p className="text-xs text-red-700 font-medium text-right">
          Your uploads total {(oversize / 1024 / 1024).toFixed(1)} MB which is too
          large. Try retaking the photos in lower resolution and resubmit.
        </p>
      )}
    </div>
  );
}
