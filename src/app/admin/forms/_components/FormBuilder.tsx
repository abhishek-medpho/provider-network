"use client";

import { useState, useTransition } from "react";
import type {
  FormSection,
  FormBlock,
  FormBlockType,
  FormAction,
  FormActionKind,
  FormActionStyle,
} from "@/lib/types/form";

type AttributeOption = {
  id: string;
  key: string;
  label: string;
  type: string;
  category: string | null;
};

type Props = {
  formId: string;
  initialSections: FormSection[];
  initialActions: FormAction[];
  attributes: AttributeOption[];
  purpose: string;
  saveSections: (
    sections: FormSection[],
  ) => Promise<{ ok: boolean; error?: string }>;
  saveActions: (
    actions: FormAction[],
  ) => Promise<{ ok: boolean; error?: string }>;
};

const BLOCK_TYPES: { value: FormBlockType; label: string; help: string }[] = [
  { value: "ATTRIBUTE", label: "Input", help: "Capture data from the user" },
  { value: "DISPLAY", label: "Display", help: "Show context data (e.g. patient name)" },
  { value: "INFO", label: "Info", help: "Free-text guidance to the user" },
  { value: "HEADING", label: "Heading", help: "Sub-section heading" },
];

const ACTION_KINDS: FormActionKind[] = ["SUBMIT", "ACCEPT", "DECLINE", "COMPLETE", "NEXT"];
const ACTION_STYLES: FormActionStyle[] = ["PRIMARY", "SECONDARY", "DANGER"];

export default function FormBuilder({
  initialSections,
  initialActions,
  attributes,
  purpose,
  saveSections,
  saveActions,
}: Props) {
  const [sections, setSections] = useState<FormSection[]>(initialSections);
  const [actions, setActions] = useState<FormAction[]>(initialActions);
  const [dirtySections, setDirtySections] = useState(false);
  const [dirtyActions, setDirtyActions] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const attrById = new Map(attributes.map((a) => [a.id, a]));

  // ---- sections ops ----
  const mutateSections = (next: FormSection[]) => {
    setSections(next);
    setDirtySections(true);
  };

  const addSection = () =>
    mutateSections([
      ...sections,
      {
        key: `section_${sections.length + 1}`,
        title: "New section",
        blocks: [],
      },
    ]);

  const removeSection = (i: number) =>
    mutateSections(sections.filter((_, idx) => idx !== i));

  const moveSection = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= sections.length) return;
    const next = [...sections];
    [next[i], next[j]] = [next[j], next[i]];
    mutateSections(next);
  };

  const updateSection = (i: number, patch: Partial<FormSection>) =>
    mutateSections(
      sections.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    );

  // ---- blocks ops ----
  const addBlock = (sIdx: number, type: FormBlockType) => {
    const block = makeDefaultBlock(type, attributes);
    if (!block) return;
    mutateSections(
      sections.map((s, idx) =>
        idx === sIdx ? { ...s, blocks: [...s.blocks, block] } : s,
      ),
    );
  };

  const removeBlock = (sIdx: number, bIdx: number) =>
    mutateSections(
      sections.map((s, idx) =>
        idx === sIdx
          ? { ...s, blocks: s.blocks.filter((_, bi) => bi !== bIdx) }
          : s,
      ),
    );

  const moveBlock = (sIdx: number, bIdx: number, dir: -1 | 1) => {
    const target = sections[sIdx];
    const j = bIdx + dir;
    if (j < 0 || j >= target.blocks.length) return;
    const blocks = [...target.blocks];
    [blocks[bIdx], blocks[j]] = [blocks[j], blocks[bIdx]];
    mutateSections(
      sections.map((s, idx) => (idx === sIdx ? { ...s, blocks } : s)),
    );
  };

  const updateBlock = (
    sIdx: number,
    bIdx: number,
    patch: Partial<FormBlock>,
  ) =>
    mutateSections(
      sections.map((s, idx) =>
        idx === sIdx
          ? {
              ...s,
              blocks: s.blocks.map((b, bi) =>
                bi === bIdx ? ({ ...b, ...patch } as FormBlock) : b,
              ),
            }
          : s,
      ),
    );

  // ---- actions ops ----
  const mutateActions = (next: FormAction[]) => {
    setActions(next);
    setDirtyActions(true);
  };
  const addAction = () =>
    mutateActions([
      ...actions,
      {
        key: `action_${actions.length + 1}`,
        label: "Button",
        kind: "SUBMIT",
        style: "PRIMARY",
      },
    ]);
  const removeAction = (i: number) =>
    mutateActions(actions.filter((_, idx) => idx !== i));
  const moveAction = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= actions.length) return;
    const next = [...actions];
    [next[i], next[j]] = [next[j], next[i]];
    mutateActions(next);
  };
  const updateAction = (i: number, patch: Partial<FormAction>) =>
    mutateActions(
      actions.map((a, idx) => (idx === i ? { ...a, ...patch } : a)),
    );

  // ---- save ----
  const handleSave = () => {
    startTransition(async () => {
      setMessage(null);
      const errs: string[] = [];
      if (dirtySections) {
        const r = await saveSections(sections);
        if (!r.ok) errs.push(r.error ?? "Sections save failed");
        else setDirtySections(false);
      }
      if (dirtyActions) {
        const r = await saveActions(actions);
        if (!r.ok) errs.push(r.error ?? "Actions save failed");
        else setDirtyActions(false);
      }
      setMessage(errs.length === 0 ? "✓ Saved" : `✗ ${errs.join("; ")}`);
      setTimeout(() => setMessage(null), 3000);
    });
  };

  const isDirty = dirtySections || dirtyActions;

  return (
    <div className="space-y-6">
      {/* Save bar */}
      <div className="sticky top-0 z-10 -mx-8 px-8 py-2 bg-zinc-50/95 dark:bg-zinc-950/95 backdrop-blur border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          {sections.length} section{sections.length === 1 ? "" : "s"} ·{" "}
          {sections.reduce((sum, s) => sum + s.blocks.length, 0)} block
          {sections.reduce((sum, s) => sum + s.blocks.length, 0) === 1 ? "" : "s"} ·{" "}
          {actions.length} action{actions.length === 1 ? "" : "s"}
          {isDirty && (
            <span className="ml-3 text-amber-600 dark:text-amber-400">
              unsaved changes
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {message && (
            <span
              className={`text-xs ${message.startsWith("✓") ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
            >
              {message}
            </span>
          )}
          <button
            type="button"
            disabled={!isDirty || pending}
            onClick={handleSave}
            className="px-4 py-1.5 rounded-md bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pending ? "Saving..." : "Save form"}
          </button>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {sections.map((section, sIdx) => (
          <div
            key={sIdx}
            className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
          >
            <header className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
              <input
                value={section.title}
                onChange={(e) =>
                  updateSection(sIdx, { title: e.target.value })
                }
                className="flex-1 font-medium text-zinc-900 dark:text-zinc-50 bg-transparent border-0 focus:outline-none focus:ring-0 px-0"
                placeholder="Section title"
              />
              <input
                value={section.key}
                onChange={(e) =>
                  updateSection(sIdx, { key: e.target.value })
                }
                className="w-32 text-xs font-mono px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-500"
                placeholder="section_key"
              />
              <IconButton
                title="Move up"
                onClick={() => moveSection(sIdx, -1)}
                disabled={sIdx === 0}
              >
                ↑
              </IconButton>
              <IconButton
                title="Move down"
                onClick={() => moveSection(sIdx, 1)}
                disabled={sIdx === sections.length - 1}
              >
                ↓
              </IconButton>
              <IconButton
                title="Remove section"
                danger
                onClick={() => {
                  if (
                    section.blocks.length === 0 ||
                    confirm(
                      `Remove "${section.title}"? ${section.blocks.length} block(s) will be deleted.`,
                    )
                  ) {
                    removeSection(sIdx);
                  }
                }}
              >
                ✕
              </IconButton>
            </header>

            <div className="px-5 py-4 space-y-3">
              {section.blocks.length === 0 && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400 italic">
                  No blocks yet.
                </p>
              )}
              {section.blocks.map((block, bIdx) => (
                <BlockRow
                  key={bIdx}
                  block={block}
                  attributes={attributes}
                  attrById={attrById}
                  onChange={(patch) => updateBlock(sIdx, bIdx, patch)}
                  onRemove={() => removeBlock(sIdx, bIdx)}
                  onMoveUp={() => moveBlock(sIdx, bIdx, -1)}
                  onMoveDown={() => moveBlock(sIdx, bIdx, 1)}
                  canMoveUp={bIdx > 0}
                  canMoveDown={bIdx < section.blocks.length - 1}
                />
              ))}

              {/* Add block */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-dashed border-zinc-200 dark:border-zinc-800">
                <span className="text-xs text-zinc-500 dark:text-zinc-400 self-center mr-1">
                  Add block:
                </span>
                {BLOCK_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    title={t.help}
                    onClick={() => addBlock(sIdx, t.value)}
                    className="px-2.5 py-1 rounded-md text-xs font-medium border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    + {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addSection}
          className="w-full px-4 py-3 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-900 hover:border-zinc-400 dark:hover:border-zinc-600"
        >
          + Add section
        </button>
      </div>

      {/* Actions */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-medium text-zinc-900 dark:text-zinc-50">
            Action buttons
          </h2>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Bottom of form. {purpose === "APPOINTMENT_CONFIRM" ? "e.g. Accept + Decline" : ""}
          </span>
        </div>
        <div className="space-y-2">
          {actions.length === 0 && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 italic">
              No actions configured.
            </p>
          )}
          {actions.map((a, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_140px_120px_auto_auto_auto] gap-2 items-center"
            >
              <input
                value={a.label}
                onChange={(e) => updateAction(i, { label: e.target.value })}
                placeholder="Button label"
                className="px-2.5 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
              />
              <select
                value={a.kind}
                onChange={(e) =>
                  updateAction(i, { kind: e.target.value as FormActionKind })
                }
                className="px-2.5 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
              >
                {ACTION_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
              <select
                value={a.style ?? "PRIMARY"}
                onChange={(e) =>
                  updateAction(i, { style: e.target.value as FormActionStyle })
                }
                className="px-2.5 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
              >
                {ACTION_STYLES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <IconButton
                title="Move up"
                onClick={() => moveAction(i, -1)}
                disabled={i === 0}
              >
                ↑
              </IconButton>
              <IconButton
                title="Move down"
                onClick={() => moveAction(i, 1)}
                disabled={i === actions.length - 1}
              >
                ↓
              </IconButton>
              <IconButton
                title="Remove action"
                danger
                onClick={() => removeAction(i)}
              >
                ✕
              </IconButton>
            </div>
          ))}
          <button
            type="button"
            onClick={addAction}
            className="px-3 py-1.5 rounded-md text-xs font-medium border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            + Add action
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Block row
// ---------------------------------------------------------------------------

function BlockRow({
  block,
  attributes,
  attrById,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: {
  block: FormBlock;
  attributes: AttributeOption[];
  attrById: Map<string, AttributeOption>;
  onChange: (patch: Partial<FormBlock>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  return (
    <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
          {block.type}
        </span>
        <div className="flex items-center gap-1">
          <IconButton title="Move up" onClick={onMoveUp} disabled={!canMoveUp}>
            ↑
          </IconButton>
          <IconButton
            title="Move down"
            onClick={onMoveDown}
            disabled={!canMoveDown}
          >
            ↓
          </IconButton>
          <IconButton title="Remove block" danger onClick={onRemove}>
            ✕
          </IconButton>
        </div>
      </div>

      {block.type === "ATTRIBUTE" && (
        <AttributeBlockEditor
          block={block}
          attributes={attributes}
          attrById={attrById}
          onChange={onChange}
        />
      )}
      {block.type === "DISPLAY" && (
        <DisplayBlockEditor block={block} onChange={onChange} />
      )}
      {block.type === "INFO" && (
        <InfoBlockEditor block={block} onChange={onChange} />
      )}
      {block.type === "HEADING" && (
        <HeadingBlockEditor block={block} onChange={onChange} />
      )}
    </div>
  );
}

function AttributeBlockEditor({
  block,
  attributes,
  attrById,
  onChange,
}: {
  block: Extract<FormBlock, { type: "ATTRIBUTE" }>;
  attributes: AttributeOption[];
  attrById: Map<string, AttributeOption>;
  onChange: (patch: Partial<FormBlock>) => void;
}) {
  const attr = attrById.get(block.attributeId);
  return (
    <div className="space-y-2">
      <select
        value={block.attributeId}
        onChange={(e) => onChange({ attributeId: e.target.value })}
        className="w-full px-2.5 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
      >
        {attributes.map((a) => (
          <option key={a.id} value={a.id}>
            {a.label} ({a.key}) — {a.type}
          </option>
        ))}
      </select>
      {attr && (
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
          {attr.type}
          {attr.category ? ` · ${attr.category}` : ""}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <input
          value={block.overrideLabel ?? ""}
          onChange={(e) => onChange({ overrideLabel: e.target.value })}
          placeholder={`Label override (default: ${attr?.label ?? "—"})`}
          className="px-2.5 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs"
        />
        <label className="flex items-center gap-2 text-xs px-2 py-1.5">
          <input
            type="checkbox"
            checked={block.isRequired === true}
            onChange={(e) => onChange({ isRequired: e.target.checked })}
          />
          Required on this form
        </label>
      </div>
    </div>
  );
}

function DisplayBlockEditor({
  block,
  onChange,
}: {
  block: Extract<FormBlock, { type: "DISPLAY" }>;
  onChange: (patch: Partial<FormBlock>) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <input
          value={block.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="Label (e.g. Patient name)"
          className="px-2.5 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
        />
        <input
          value={block.contextPath}
          onChange={(e) => onChange({ contextPath: e.target.value })}
          placeholder="contextPath (e.g. patient.name)"
          className="px-2.5 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-mono"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select
          value={block.format ?? "text"}
          onChange={(e) =>
            onChange({
              format: e.target.value as Extract<
                FormBlock,
                { type: "DISPLAY" }
              >["format"],
            })
          }
          className="px-2.5 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs"
        >
          <option value="text">text</option>
          <option value="date">date</option>
          <option value="datetime">datetime</option>
          <option value="phone">phone</option>
          <option value="address">address</option>
          <option value="currency">currency</option>
        </select>
        <input
          value={block.helpText ?? ""}
          onChange={(e) => onChange({ helpText: e.target.value })}
          placeholder="Help text (optional)"
          className="px-2.5 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs"
        />
      </div>
    </div>
  );
}

function InfoBlockEditor({
  block,
  onChange,
}: {
  block: Extract<FormBlock, { type: "INFO" }>;
  onChange: (patch: Partial<FormBlock>) => void;
}) {
  return (
    <textarea
      value={block.text}
      onChange={(e) => onChange({ text: e.target.value })}
      placeholder="Informational text shown inline"
      rows={2}
      className="w-full px-2.5 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
    />
  );
}

function HeadingBlockEditor({
  block,
  onChange,
}: {
  block: Extract<FormBlock, { type: "HEADING" }>;
  onChange: (patch: Partial<FormBlock>) => void;
}) {
  return (
    <input
      value={block.text}
      onChange={(e) => onChange({ text: e.target.value })}
      placeholder="Heading text"
      className="w-full px-2.5 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-medium"
    />
  );
}

function IconButton({
  children,
  onClick,
  disabled,
  danger,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`w-7 h-7 rounded text-xs ${
        disabled
          ? "text-zinc-300 dark:text-zinc-700 cursor-not-allowed"
          : danger
            ? "text-zinc-400 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600"
            : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-50"
      }`}
    >
      {children}
    </button>
  );
}

function makeDefaultBlock(
  type: FormBlockType,
  attributes: AttributeOption[],
): FormBlock | null {
  switch (type) {
    case "ATTRIBUTE":
      if (attributes.length === 0) return null;
      return {
        type: "ATTRIBUTE",
        attributeId: attributes[0].id,
      };
    case "DISPLAY":
      return { type: "DISPLAY", label: "Label", contextPath: "patient.name" };
    case "INFO":
      return { type: "INFO", text: "" };
    case "HEADING":
      return { type: "HEADING", text: "Heading" };
  }
}
