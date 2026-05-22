"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Play, Loader2, CheckCircle2, AlertCircle, Bell } from "lucide-react";

type LaunchKickoff = {
  ok: boolean;
  total?: number;
  started?: boolean;
  error?: string;
};

type LaunchStatus = {
  inProgress: boolean;
  total: number;
  sent: number;
  failed: number;
  pct: number;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
};

/**
 * Launch button + live progress bar. The server action kicks off a
 * background loop and returns immediately; we then poll /launch-status
 * every 2s until inProgress goes false, rendering a progress bar so the
 * admin sees the batch advance in real time.
 */
export function LaunchButton({
  action,
  pendingMembers,
  campaignId,
}: {
  action: () => Promise<LaunchKickoff>;
  pendingMembers: number;
  campaignId: string;
}) {
  const router = useRouter();
  const [kickoffPending, startTransition] = useTransition();
  const [status, setStatus] = useState<LaunchStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initial fetch — if there's already a launch in progress from a prior
  // session, pick up its state and start polling.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/campaigns/${campaignId}/launch-status`)
      .then((r) => r.json())
      .then((s) => {
        if (!cancelled) setStatus(s);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  // Poll while inProgress.
  useEffect(() => {
    if (!status?.inProgress) return;
    let cancelled = false;
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/campaigns/${campaignId}/launch-status`);
        const s: LaunchStatus = await res.json();
        if (cancelled) return;
        setStatus(s);
        if (!s.inProgress) {
          // Refresh the page to pull in updated member statuses
          router.refresh();
        }
      } catch {
        /* ignore single-shot errors; keep polling */
      }
    }, 2000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [status?.inProgress, campaignId, router]);

  const run = () => {
    if (
      !confirm(
        `Send invites to ${pendingMembers} provider${pendingMembers === 1 ? "" : "s"} via WhatsApp?\n\nThis runs in the background — you can close this tab and it'll keep going.`,
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const r = await action();
      if (!r.ok) {
        setError(r.error ?? "Failed to start launch");
        return;
      }
      if (r.started === false) {
        setError("Nothing to send (no eligible PENDING members).");
        return;
      }
      // Start polling immediately
      const res = await fetch(`/api/campaigns/${campaignId}/launch-status`);
      setStatus(await res.json());
    });
  };

  const showProgress =
    status &&
    (status.inProgress || (status.completedAt && status.total > 0));
  const completed =
    status && !status.inProgress && status.completedAt && status.total > 0;

  return (
    <div className="space-y-2">
      <Button
        type="button"
        onClick={run}
        disabled={
          kickoffPending ||
          pendingMembers === 0 ||
          status?.inProgress === true
        }
        className="bg-success text-success-foreground hover:bg-success/90"
      >
        {kickoffPending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Starting…
          </>
        ) : status?.inProgress ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Sending…
          </>
        ) : pendingMembers === 0 ? (
          "Nothing to send"
        ) : (
          <>
            <Play className="size-4" />
            Launch — send {pendingMembers} invite
            {pendingMembers === 1 ? "" : "s"}
          </>
        )}
      </Button>

      {error && (
        <div className="text-xs flex items-start gap-1.5 text-destructive">
          <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {showProgress && status && (
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {status.inProgress ? (
                <>
                  Sending {status.sent + status.failed}{" / "}
                  <span className="font-medium text-foreground">
                    {status.total}
                  </span>
                </>
              ) : (
                <span className="inline-flex items-center gap-1 text-success font-medium">
                  <CheckCircle2 className="size-3" />
                  Sent {status.sent}/{status.total}
                  {status.failed > 0 && (
                    <span className="text-destructive ml-1">
                      · {status.failed} failed
                    </span>
                  )}
                </span>
              )}
            </span>
            <span className="text-muted-foreground tabular-nums">
              {status.pct}%
            </span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                status.inProgress
                  ? "bg-foreground"
                  : completed
                    ? "bg-success"
                    : "bg-foreground"
              }`}
              style={{ width: `${status.pct}%` }}
            />
          </div>
          {status.error && (
            <div className="text-[11px] text-destructive flex items-start gap-1">
              <AlertCircle className="size-3 shrink-0 mt-0.5" />
              <span>{status.error}</span>
            </div>
          )}
          {status.inProgress && (
            <p className="text-[11px] text-muted-foreground">
              Running in background. You can close this tab — sends will continue.
            </p>
          )}
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
      <Button
        type="button"
        onClick={run}
        disabled={pending}
        variant="outline"
      >
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Running…
          </>
        ) : (
          <>
            <Bell className="size-4" />
            Run reminders now
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
              ? `Evaluated ${result.evaluated} · sent ${result.sent}${result.failed ? ` · ${result.failed} failed` : ""}`
              : result.error}
          </span>
        </div>
      )}
    </div>
  );
}
