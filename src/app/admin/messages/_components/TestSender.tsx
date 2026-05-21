"use client";

import { useState, useTransition } from "react";

type Result =
  | { ok: true; messageId?: string }
  | { ok: false; error?: string }
  | null;

export default function TestSender({
  action,
}: {
  action: (
    formData: FormData,
  ) => Promise<{ ok: boolean; error?: string; messageId?: string }>;
}) {
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState<Result>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    const fd = new FormData();
    fd.set("test_phone", phone);
    startTransition(async () => {
      const r = await action(fd);
      setResult(r);
    });
  };

  return (
    <div className="space-y-2">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Send this template to a phone via Ultramsg using sample values.
        Stored in the WhatsAppMessage log.
      </p>
      <div className="flex gap-2">
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="9876543210"
          className="flex-1 px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
        />
        <button
          type="button"
          onClick={submit}
          disabled={pending || !phone.trim()}
          className="px-4 py-2 rounded-md bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? "Sending..." : "Send test"}
        </button>
      </div>
      {result?.ok && (
        <div className="text-sm px-3 py-2 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">
          ✓ Sent
          {result.messageId ? (
            <code className="font-mono text-xs ml-2 opacity-70">
              {result.messageId}
            </code>
          ) : null}
        </div>
      )}
      {result?.ok === false && (
        <div className="text-sm px-3 py-2 rounded-md bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400">
          ✗ {result.error}
        </div>
      )}
    </div>
  );
}
