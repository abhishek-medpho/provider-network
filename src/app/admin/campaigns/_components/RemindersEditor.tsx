"use client";

import { useState } from "react";

type Rule = {
  triggerAfterHours: number;
  messageTemplateId: string;
  maxSends: number;
};

type TemplateOption = { id: string; name: string; code: string; kind: string };

export default function RemindersEditor({
  initial,
  templates,
}: {
  initial: Rule[];
  templates: TemplateOption[];
}) {
  const [rules, setRules] = useState<Rule[]>(initial);

  const update = (i: number, patch: Partial<Rule>) =>
    setRules((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const add = () =>
    setRules((rs) => [
      ...rs,
      {
        triggerAfterHours: 24,
        messageTemplateId: templates[0]?.id ?? "",
        maxSends: 1,
      },
    ]);

  const remove = (i: number) =>
    setRules((rs) => rs.filter((_, idx) => idx !== i));

  const reminderTemplates = templates.filter(
    (t) => t.kind === "REMINDER" || t.kind === "INVITE",
  );

  return (
    <div className="space-y-2">
      {rules.length === 0 && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400 italic">
          No reminders configured. Add one to nudge providers who haven&apos;t
          submitted yet.
        </p>
      )}
      {rules.map((r, i) => (
        <div
          key={i}
          className="grid grid-cols-[100px_1fr_80px_auto] gap-2 items-center"
        >
          <div className="flex items-center gap-1">
            <input
              type="number"
              name={`reminder_hours_${i}`}
              value={r.triggerAfterHours}
              onChange={(e) =>
                update(i, { triggerAfterHours: Number(e.target.value) })
              }
              min={1}
              className="w-20 px-2.5 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
            />
            <span className="text-xs text-zinc-500">hr</span>
          </div>
          <select
            name={`reminder_template_${i}`}
            value={r.messageTemplateId}
            onChange={(e) => update(i, { messageTemplateId: e.target.value })}
            className="px-2.5 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
          >
            {reminderTemplates.length === 0 && (
              <option value="">No reminder templates available</option>
            )}
            {reminderTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.code})
              </option>
            ))}
          </select>
          <input
            type="number"
            name={`reminder_maxsends_${i}`}
            value={r.maxSends}
            onChange={(e) => update(i, { maxSends: Number(e.target.value) })}
            min={1}
            max={5}
            className="w-16 px-2.5 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
            title="Max sends per provider for this rule"
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="w-7 h-7 rounded text-zinc-400 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600"
            title="Remove rule"
          >
            ✕
          </button>
        </div>
      ))}
      <div className="text-xs text-zinc-500 dark:text-zinc-400 grid grid-cols-[100px_1fr_80px_auto] gap-2 mt-1 px-1">
        <span>Hours after</span>
        <span>Template</span>
        <span>Max sends</span>
        <span></span>
      </div>
      <button
        type="button"
        onClick={add}
        className="mt-2 px-3 py-1.5 rounded-md text-xs font-medium border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
      >
        + Add reminder rule
      </button>
    </div>
  );
}
