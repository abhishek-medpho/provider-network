"use client";

import { useState, useTransition } from "react";

export function RespondActions({
  respond,
  initialStatus,
}: {
  respond: (
    decision: "INTERESTED" | "DECLINED",
  ) => Promise<{ ok: boolean; status: string; message: string }>;
  initialStatus: string;
}) {
  const [pending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<{
    ok: boolean;
    status: string;
    message: string;
  } | null>(
    ["INTERESTED", "DECLINED", "EXPIRED"].includes(initialStatus)
      ? {
          ok: initialStatus === "INTERESTED",
          status: initialStatus,
          message:
            initialStatus === "INTERESTED"
              ? "You've said you're available. We'll confirm if you're selected."
              : initialStatus === "DECLINED"
                ? "You passed on this one."
                : "This request is no longer open.",
        }
      : null,
  );

  function act(decision: "INTERESTED" | "DECLINED") {
    startTransition(async () => {
      const r = await respond(decision);
      setOutcome(r);
    });
  }

  if (outcome) {
    const tone =
      outcome.status === "INTERESTED"
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : outcome.ok
          ? "border-zinc-200 bg-zinc-50 text-zinc-700"
          : "border-amber-200 bg-amber-50 text-amber-800";
    return (
      <div className={`rounded-lg border p-4 text-sm ${tone}`}>
        {outcome.message}
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => act("INTERESTED")}
        className="flex-1 px-5 py-3 rounded-lg bg-emerald-600 text-white text-base font-medium hover:bg-emerald-700 disabled:opacity-60"
      >
        {pending ? "…" : "I'm available"}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => act("DECLINED")}
        className="flex-1 px-5 py-3 rounded-lg border border-zinc-300 text-zinc-700 text-base font-medium hover:bg-zinc-50 disabled:opacity-60"
      >
        {pending ? "…" : "Not this time"}
      </button>
    </div>
  );
}
