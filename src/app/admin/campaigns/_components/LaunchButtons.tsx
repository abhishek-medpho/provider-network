"use client";

import { useState, useTransition } from "react";

export function LaunchButton({
  action,
  pendingMembers,
}: {
  action: () => Promise<{
    ok: boolean;
    sent: number;
    failed: number;
    error?: string;
  }>;
  pendingMembers: number;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    ok?: boolean;
    sent?: number;
    failed?: number;
    error?: string;
  } | null>(null);

  const run = () => {
    if (
      !confirm(
        `Send invites to ${pendingMembers} provider${pendingMembers === 1 ? "" : "s"} via WhatsApp now?`,
      )
    )
      return;
    startTransition(async () => {
      const r = await action();
      setResult(r);
    });
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={run}
        disabled={pending || pendingMembers === 0}
        className="px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending
          ? "Sending..."
          : pendingMembers === 0
            ? "Nothing to send"
            : `Launch — send ${pendingMembers} invite${pendingMembers === 1 ? "" : "s"}`}
      </button>
      {result && result.ok && (
        <div className="text-sm px-3 py-2 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">
          ✓ Sent {result.sent}{" "}
          {result.failed ? `· ${result.failed} failed` : ""}
        </div>
      )}
      {result && !result.ok && (
        <div className="text-sm px-3 py-2 rounded-md bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400">
          ✗ {result.error}
        </div>
      )}
    </div>
  );
}

export function RemindersButton({
  action,
}: {
  action: () => Promise<{
    ok: boolean;
    evaluated: number;
    sent: number;
    failed: number;
    error?: string;
  }>;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    ok?: boolean;
    evaluated?: number;
    sent?: number;
    failed?: number;
    error?: string;
  } | null>(null);

  const run = () => {
    startTransition(async () => {
      const r = await action();
      setResult(r);
    });
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="px-4 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50"
      >
        {pending ? "Running..." : "Run reminders now"}
      </button>
      {result && (
        <div
          className={`text-sm px-3 py-2 rounded-md ${
            result.ok
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
              : "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400"
          }`}
        >
          {result.ok
            ? `✓ Evaluated ${result.evaluated} · sent ${result.sent}${result.failed ? ` · ${result.failed} failed` : ""}`
            : `✗ ${result.error}`}
        </div>
      )}
    </div>
  );
}
