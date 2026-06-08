"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Radio, Loader2, UserCheck, AlertCircle } from "lucide-react";

/** Broadcast-next-wave button. */
export function BroadcastButton({
  action,
  wave,
}: {
  action: () => Promise<{ ok: boolean; wave: number; reached: number; error?: string }>;
  wave: number;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="space-y-1.5">
      <Button
        type="button"
        size="sm"
        onClick={() =>
          start(async () => {
            const r = await action();
            setMsg(
              r.ok
                ? r.reached > 0
                  ? `Wave ${r.wave}: reached ${r.reached} provider(s).`
                  : "No new providers matched this wave."
                : (r.error ?? "Failed"),
            );
          })
        }
        disabled={pending}
      >
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Broadcasting…
          </>
        ) : (
          <>
            <Radio className="size-4" />
            {wave === 0 ? "Broadcast (wave 1)" : `Broadcast wave ${wave + 1} (wider)`}
          </>
        )}
      </Button>
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
    </div>
  );
}

/** Per-row assign button shown next to each willing provider. */
export function AssignButton({
  action,
  disabled,
}: {
  action: () => Promise<{ ok: boolean; error?: string }>;
  disabled?: boolean;
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="inline-flex flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending || disabled}
        onClick={() =>
          start(async () => {
            const r = await action();
            if (!r.ok) setErr(r.error ?? "Failed");
          })
        }
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <UserCheck className="size-3.5" />
        )}
        Assign
      </Button>
      {err && (
        <span className="text-[10px] text-destructive flex items-center gap-0.5">
          <AlertCircle className="size-3" />
          {err}
        </span>
      )}
    </div>
  );
}
