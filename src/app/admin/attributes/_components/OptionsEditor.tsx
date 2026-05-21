"use client";

import { useState } from "react";

type Option = { value: string; label: string };

export default function OptionsEditor({
  initial,
}: {
  initial: Option[];
}) {
  const [options, setOptions] = useState<Option[]>(
    initial.length ? initial : [{ value: "", label: "" }],
  );

  const update = (i: number, key: keyof Option, val: string) => {
    setOptions((opts) =>
      opts.map((o, idx) => (idx === i ? { ...o, [key]: val } : o)),
    );
  };

  const add = () => setOptions((opts) => [...opts, { value: "", label: "" }]);

  const remove = (i: number) =>
    setOptions((opts) => opts.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 px-1">
        <div>Value (stored)</div>
        <div>Label (shown to user)</div>
        <div className="w-7"></div>
      </div>

      {options.map((opt, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
          <input
            name={`option_value_${i}`}
            value={opt.value}
            onChange={(e) => update(i, "value", e.target.value)}
            placeholder="e.g. female"
            className="px-2.5 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-mono"
          />
          <input
            name={`option_label_${i}`}
            value={opt.label}
            onChange={(e) => update(i, "label", e.target.value)}
            placeholder="e.g. Female"
            className="px-2.5 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="w-7 h-7 rounded text-zinc-400 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600"
            aria-label="Remove option"
          >
            ✕
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={add}
        className="mt-1 px-3 py-1.5 rounded-md text-xs font-medium border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
      >
        + Add option
      </button>
    </div>
  );
}
