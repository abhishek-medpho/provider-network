"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

type AttrOption = { value: string; label: string };
export type SkillAttribute = {
  key: string;
  label: string;
  options: AttrOption[];
};
export type RequiredSkill = { attributeKey: string; values: string[] };

/**
 * Required-skills editor for jobs. The admin picks one or more skill
 * attributes (e.g. "Procedures you're comfortable performing") and checks
 * the specific option values a provider must have. The result is
 * serialized into a hidden input as JSON [{attributeKey, values[]}],
 * which createJob/updateJob parse.
 *
 * A provider matches the job only if, for every required attribute, their
 * stored value set is a superset of the checked values.
 */
export function SkillsPicker({
  attributes,
  initial,
}: {
  attributes: SkillAttribute[];
  initial?: RequiredSkill[];
}) {
  // Rows the admin has added. Each is one attribute + its required values.
  const [rows, setRows] = useState<RequiredSkill[]>(initial ?? []);

  const usedKeys = new Set(rows.map((r) => r.attributeKey));
  const available = attributes.filter((a) => !usedKeys.has(a.key));

  function addRow(attributeKey: string) {
    if (!attributeKey) return;
    setRows((r) => [...r, { attributeKey, values: [] }]);
  }
  function removeRow(attributeKey: string) {
    setRows((r) => r.filter((x) => x.attributeKey !== attributeKey));
  }
  function toggleValue(attributeKey: string, value: string) {
    setRows((r) =>
      r.map((x) => {
        if (x.attributeKey !== attributeKey) return x;
        const has = x.values.includes(value);
        return {
          ...x,
          values: has
            ? x.values.filter((v) => v !== value)
            : [...x.values, value],
        };
      }),
    );
  }

  // Only serialize rows that have at least one value checked.
  const serialized = JSON.stringify(rows.filter((r) => r.values.length > 0));

  return (
    <div className="space-y-3">
      <input type="hidden" name="requiredSkills" value={serialized} />

      {rows.map((row) => {
        const attr = attributes.find((a) => a.key === row.attributeKey);
        if (!attr) return null;
        return (
          <div
            key={row.attributeKey}
            className="rounded-md border bg-background p-3 space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{attr.label}</span>
              <button
                type="button"
                onClick={() => removeRow(row.attributeKey)}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {attr.options.map((opt) => {
                const checked = row.values.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleValue(row.attributeKey, opt.value)}
                    className={`px-2.5 py-1 rounded-md border text-xs transition-colors ${
                      checked
                        ? "bg-foreground text-background border-foreground"
                        : "bg-background hover:bg-accent"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {row.values.length === 0 && (
              <p className="text-[11px] text-muted-foreground">
                Pick at least one — otherwise this requirement is ignored.
              </p>
            )}
          </div>
        );
      })}

      {available.length > 0 && (
        <div className="flex items-center gap-2">
          <Plus className="size-3.5 text-muted-foreground" />
          <select
            defaultValue=""
            onChange={(e) => {
              addRow(e.target.value);
              e.target.value = "";
            }}
            className="h-8 px-2 rounded-md border bg-background text-sm"
          >
            <option value="" disabled>
              Add a skill requirement…
            </option>
            {available.map((a) => (
              <option key={a.key} value={a.key}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {rows.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No skill requirements — any provider of this role in range will
          match.
        </p>
      )}
    </div>
  );
}
