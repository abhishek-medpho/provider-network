"use client";

import { useState, useTransition } from "react";

export function ConfirmAction({
  confirm,
  initialStatus,
}: {
  confirm: () => Promise<{ ok: boolean; status: string; message: string }>;
  initialStatus: string;
}) {
  const [pending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<{
    ok: boolean;
    status: string;
    message: string;
  } | null>(
    initialStatus === "CONFIRMED"
      ? {
          ok: true,
          status: "CONFIRMED",
          message: "You're confirmed. Details have been sent to you.",
        }
      : ["EXPIRED", "LAPSED"].includes(initialStatus)
        ? {
            ok: false,
            status: initialStatus,
            message:
              "This assignment is no longer active. We'll send you the next one.",
          }
        : null,
  );

  function go() {
    startTransition(async () => {
      setOutcome(await confirm());
    });
  }

  if (outcome) {
    const tone = outcome.ok
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-amber-200 bg-amber-50 text-amber-800";
    return (
      <div className={`rounded-lg border p-4 text-sm ${tone}`}>
        {outcome.message}
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={go}
      className="w-full px-5 py-3 rounded-lg bg-emerald-600 text-white text-base font-medium hover:bg-emerald-700 disabled:opacity-60"
    >
      {pending ? "Confirming…" : "Yes, I'll be there — confirm"}
    </button>
  );
}
