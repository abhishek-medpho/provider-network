"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Send,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

/**
 * Sends a test message via the configured channel. The action returns a
 * structured result so we render success / error inline without a page
 * reload — admins iterating on credentials should see the outcome
 * immediately.
 */
export function TestChannel({
  channel,
  action,
  placeholder,
  help,
}: {
  channel: "WHATSAPP" | "EMAIL";
  action: (formData: FormData) => Promise<{ ok: boolean; message: string }>;
  placeholder: string;
  help?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(
    null,
  );

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setResult(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await action(fd);
      setResult(r);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Send className="size-4 text-muted-foreground" />
        Send test{" "}
        {channel === "WHATSAPP" ? "WhatsApp message" : "email"}
      </div>

      <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor={`test-${channel}-to`} className="sr-only">
            Recipient
          </Label>
          <Input
            id={`test-${channel}-to`}
            name="to"
            type={channel === "EMAIL" ? "email" : "tel"}
            placeholder={placeholder}
            required
          />
        </div>
        <Button type="submit" disabled={pending} variant="outline">
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Sending…
            </>
          ) : (
            <>
              <Send className="size-4" />
              Send test
            </>
          )}
        </Button>
      </form>

      {help && !result && (
        <p className="text-xs text-muted-foreground">{help}</p>
      )}

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
          <span>{result.message}</span>
        </div>
      )}
    </div>
  );
}
