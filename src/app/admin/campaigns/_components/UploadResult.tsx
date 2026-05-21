"use client";

import { useState, useTransition } from "react";

export default function UploadLeads({
  action,
}: {
  action: (
    formData: FormData,
  ) => Promise<{
    ok: boolean;
    error?: string;
    created?: number;
    matched?: number;
    skipped?: number;
  }>;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    ok?: boolean;
    error?: string;
    created?: number;
    matched?: number;
    skipped?: number;
  } | null>(null);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const fd = new FormData(formEl);
    startTransition(async () => {
      setResult(null);
      const r = await action(fd);
      setResult(r);
      if (r.ok) formEl.reset();
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-1">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Source label (optional)
        </label>
        <input
          type="text"
          name="source"
          placeholder="e.g. Apna 2026-04 drive"
          className="w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
        />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Helps you trace where these leads came from.
        </p>
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          CSV file
        </label>
        <input
          type="file"
          name="file"
          accept=".csv,text/csv"
          required
          className="block text-sm file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:bg-zinc-100 dark:file:bg-zinc-800 file:text-sm file:font-medium hover:file:bg-zinc-200 dark:hover:file:bg-zinc-700"
        />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Must have a header row with a phone column (auto-detected: phone,
          mobile, whatsapp, contact). Name + email columns are optional.
        </p>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="px-4 py-2 rounded-md bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50"
      >
        {pending ? "Uploading..." : "Upload leads"}
      </button>
      {result?.ok && (
        <div className="text-sm px-3 py-2 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">
          ✓ Imported {result.created} new + {result.matched} matched
          {result.skipped ? ` · ${result.skipped} skipped (invalid phone)` : ""}
        </div>
      )}
      {result?.ok === false && (
        <div className="text-sm px-3 py-2 rounded-md bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400">
          ✗ {result.error}
        </div>
      )}
    </form>
  );
}
