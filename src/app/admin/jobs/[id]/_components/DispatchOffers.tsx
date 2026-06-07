"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Send, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export function DispatchOffers({
  action,
  candidateCount,
}: {
  action: () => Promise<{
    ok: boolean;
    created: number;
    sent: number;
    error?: string;
  }>;
  candidateCount: number;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    ok: boolean;
    created: number;
    sent: number;
    error?: string;
  } | null>(null);

  function run() {
    if (
      !confirm(
        `Send job offers to ${candidateCount} matched provider${candidateCount === 1 ? "" : "s"}?`,
      )
    )
      return;
    setResult(null);
    startTransition(async () => {
      const r = await action();
      setResult(r);
    });
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        onClick={run}
        disabled={pending || candidateCount === 0}
      >
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Sending offers…
          </>
        ) : (
          <>
            <Send className="size-4" />
            Send offers to {candidateCount} provider
            {candidateCount === 1 ? "" : "s"}
          </>
        )}
      </Button>
      {result && (
        <div
          className={`text-xs flex items-start gap-1.5 ${
            result.ok ? "text-success" : "text-destructive"
          }`}
        >
          {result.ok ? (
            <CheckCircle2 className="size-3.5 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
          )}
          <span>
            {result.ok
              ? `Created ${result.created} offer(s), ${result.sent} sent.`
              : result.error}
          </span>
        </div>
      )}
    </div>
  );
}
