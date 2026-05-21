"use client";

import { useMemo, useState } from "react";
import { extractVariables, buildPreview } from "@/lib/messageTemplate";

export default function BodyEditor({
  initial,
  helpText,
}: {
  initial: string;
  helpText?: string;
}) {
  const [body, setBody] = useState(initial);
  const variables = useMemo(() => extractVariables(body), [body]);
  const preview = useMemo(() => buildPreview(body), [body]);

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label
            htmlFor="body"
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Body
          </label>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {body.length} chars
          </span>
        </div>
        <textarea
          id="body"
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={12}
          className="w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-mono leading-relaxed resize-y"
          placeholder="Hi {{name}}, complete your profile: {{form_link}}"
        />
        {helpText && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{helpText}</p>
        )}

        <div>
          <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wide">
            Detected variables
          </div>
          {variables.length === 0 ? (
            <p className="text-xs text-zinc-400 italic">None</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {variables.map((v) => (
                <code
                  key={v}
                  className="font-mono text-xs px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                >
                  {`{{${v}}}`}
                </code>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Preview
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            sample values
          </span>
        </div>
        <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-emerald-50/40 dark:bg-emerald-950/10 p-4 min-h-[14rem]">
          <pre className="font-sans text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap break-words leading-relaxed">
            {preview || (
              <span className="text-zinc-400 italic">
                Type a message to preview...
              </span>
            )}
          </pre>
        </div>
      </div>
    </div>
  );
}
