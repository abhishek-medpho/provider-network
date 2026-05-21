/**
 * Maps a FormBlock + Attribute → rendered input (or display element).
 *
 * Server-rendered. Each input's `name` is the attribute.key so the submission
 * formData has stable, attribute-keyed fields the action can store directly
 * onto CareProvider.attributes.
 */
import type { Attribute } from "@prisma/client";
import type { FormBlock, FormSection } from "@/lib/types/form";

type AttributeOption = { value: string; label: string };

function getOptions(attr: Attribute): AttributeOption[] {
  if (!attr.options) return [];
  if (Array.isArray(attr.options)) return attr.options as unknown as AttributeOption[];
  return [];
}

function getValidation(attr: Attribute): Record<string, unknown> {
  return (attr.validation as Record<string, unknown> | null) ?? {};
}

function getValueFromAttributes(
  values: Record<string, unknown>,
  key: string,
): string | string[] | null {
  const v = values[key];
  if (v === undefined || v === null) return null;
  if (Array.isArray(v)) return v.map(String);
  return String(v);
}

export function renderSection({
  section,
  attrById,
  values,
  context,
}: {
  section: FormSection;
  attrById: Map<string, Attribute>;
  values: Record<string, unknown>;
  context: Record<string, unknown>;
}) {
  return (
    <section
      key={section.key}
      className="rounded-xl border border-zinc-200 bg-white p-5 space-y-5"
    >
      <header>
        <h2 className="text-lg font-semibold text-zinc-900">{section.title}</h2>
        {section.description && (
          <p className="text-sm text-zinc-600 mt-1">{section.description}</p>
        )}
      </header>
      <div className="space-y-4">
        {section.blocks.map((block, i) => (
          <div key={i}>{renderBlock({ block, attrById, values, context })}</div>
        ))}
      </div>
    </section>
  );
}

function renderBlock({
  block,
  attrById,
  values,
  context,
}: {
  block: FormBlock;
  attrById: Map<string, Attribute>;
  values: Record<string, unknown>;
  context: Record<string, unknown>;
}) {
  switch (block.type) {
    case "INFO":
      return (
        <div className="rounded-md bg-blue-50 border border-blue-100 px-3 py-2 text-sm text-blue-900">
          {block.text}
        </div>
      );
    case "HEADING":
      return (
        <h3 className="text-base font-semibold text-zinc-900 pt-2">
          {block.text}
        </h3>
      );
    case "DISPLAY": {
      const value = resolveContextPath(context, block.contextPath);
      return (
        <div>
          <div className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
            {block.label}
          </div>
          <div className="text-sm text-zinc-900 mt-0.5">
            {value !== null && value !== "" ? String(value) : "—"}
          </div>
          {block.helpText && (
            <p className="text-xs text-zinc-500 mt-0.5">{block.helpText}</p>
          )}
        </div>
      );
    }
    case "ATTRIBUTE": {
      const attr = attrById.get(block.attributeId);
      if (!attr) {
        return (
          <div className="rounded-md bg-amber-50 border border-amber-100 px-3 py-2 text-sm text-amber-900">
            Missing attribute (id: {block.attributeId})
          </div>
        );
      }
      return renderAttributeInput({ attr, block, values });
    }
  }
}

function renderAttributeInput({
  attr,
  block,
  values,
}: {
  attr: Attribute;
  block: Extract<FormBlock, { type: "ATTRIBUTE" }>;
  values: Record<string, unknown>;
}) {
  const label = block.overrideLabel || attr.label;
  const helpText = block.overrideHelpText ?? attr.helpText;
  const validation = getValidation(attr);
  const required =
    block.isRequired === true || validation.required === true;
  const currentValue = getValueFromAttributes(values, attr.key);
  const valueStr = typeof currentValue === "string" ? currentValue : "";
  const valueArr = Array.isArray(currentValue) ? currentValue : [];

  const labelEl = (
    <label
      htmlFor={attr.key}
      className="block text-sm font-medium text-zinc-700 mb-1.5"
    >
      {label}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );

  const helpEl = helpText ? (
    <p className="mt-1 text-xs text-zinc-500">{helpText}</p>
  ) : null;

  const baseInputClass =
    "w-full px-3 py-2.5 rounded-lg border border-zinc-300 bg-white text-base focus:outline-none focus:ring-2 focus:ring-zinc-900";

  switch (attr.type) {
    case "TEXT":
    case "RICH_TEXT":
      return (
        <div>
          {labelEl}
          <input
            id={attr.key}
            name={attr.key}
            type="text"
            required={required}
            defaultValue={valueStr}
            minLength={validation.min as number | undefined}
            maxLength={validation.max as number | undefined}
            className={baseInputClass}
          />
          {helpEl}
        </div>
      );
    case "LONG_TEXT":
      return (
        <div>
          {labelEl}
          <textarea
            id={attr.key}
            name={attr.key}
            required={required}
            defaultValue={valueStr}
            minLength={validation.min as number | undefined}
            maxLength={validation.max as number | undefined}
            rows={3}
            className={baseInputClass}
          />
          {helpEl}
        </div>
      );
    case "NUMBER":
      return (
        <div>
          {labelEl}
          <input
            id={attr.key}
            name={attr.key}
            type="number"
            inputMode="numeric"
            required={required}
            defaultValue={valueStr}
            min={validation.min as number | undefined}
            max={validation.max as number | undefined}
            className={baseInputClass}
          />
          {helpEl}
        </div>
      );
    case "EMAIL":
      return (
        <div>
          {labelEl}
          <input
            id={attr.key}
            name={attr.key}
            type="email"
            autoComplete="email"
            required={required}
            defaultValue={valueStr}
            className={baseInputClass}
          />
          {helpEl}
        </div>
      );
    case "PHONE":
    case "OTP_VERIFIED_PHONE":
      return (
        <div>
          {labelEl}
          <input
            id={attr.key}
            name={attr.key}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required={required}
            defaultValue={valueStr}
            pattern="[0-9 +\-()]{7,15}"
            className={baseInputClass}
          />
          {helpEl}
        </div>
      );
    case "PINCODE":
      return (
        <div>
          {labelEl}
          <input
            id={attr.key}
            name={attr.key}
            type="text"
            inputMode="numeric"
            required={required}
            defaultValue={valueStr}
            pattern="\d{6}"
            maxLength={6}
            className={baseInputClass}
            placeholder="6 digits"
          />
          {helpEl}
        </div>
      );
    case "DATE":
      return (
        <div>
          {labelEl}
          <input
            id={attr.key}
            name={attr.key}
            type="date"
            required={required}
            defaultValue={valueStr}
            className={baseInputClass}
          />
          {helpEl}
        </div>
      );
    case "YEAR":
      return (
        <div>
          {labelEl}
          <input
            id={attr.key}
            name={attr.key}
            type="number"
            inputMode="numeric"
            required={required}
            defaultValue={valueStr}
            min={1900}
            max={2100}
            className={baseInputClass}
          />
          {helpEl}
        </div>
      );
    case "SINGLE_SELECT": {
      const options = getOptions(attr);
      // Render as chips for ≤6 options, dropdown otherwise
      if (options.length <= 6) {
        return (
          <fieldset>
            <legend className="block text-sm font-medium text-zinc-700 mb-1.5">
              {label}
              {required && <span className="text-red-500 ml-0.5">*</span>}
            </legend>
            <div className="flex flex-wrap gap-2">
              {options.map((o) => (
                <label
                  key={o.value}
                  className="px-3 py-1.5 rounded-full border border-zinc-300 bg-white text-sm cursor-pointer has-[:checked]:bg-zinc-900 has-[:checked]:text-white has-[:checked]:border-zinc-900"
                >
                  <input
                    type="radio"
                    name={attr.key}
                    value={o.value}
                    required={required}
                    defaultChecked={valueStr === o.value}
                    className="sr-only"
                  />
                  {o.label}
                </label>
              ))}
            </div>
            {helpEl}
          </fieldset>
        );
      }
      return (
        <div>
          {labelEl}
          <select
            id={attr.key}
            name={attr.key}
            required={required}
            defaultValue={valueStr}
            className={baseInputClass}
          >
            <option value="">— Select —</option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {helpEl}
        </div>
      );
    }
    case "MULTI_SELECT": {
      const options = getOptions(attr);
      // Open-set multi-select (no predefined options): comma-separated text input.
      // Used for pincodes, custom tags, etc.
      if (options.length === 0) {
        return (
          <div>
            {labelEl}
            <input
              id={attr.key}
              name={attr.key}
              type="text"
              required={required}
              defaultValue={valueArr.join(", ")}
              placeholder="Separate with commas"
              className={baseInputClass}
            />
            {helpEl}
          </div>
        );
      }
      return (
        <fieldset>
          <legend className="block text-sm font-medium text-zinc-700 mb-1.5">
            {label}
            {required && <span className="text-red-500 ml-0.5">*</span>}
          </legend>
          <div className="flex flex-wrap gap-2">
            {options.map((o) => (
              <label
                key={o.value}
                className="px-3 py-1.5 rounded-full border border-zinc-300 bg-white text-sm cursor-pointer has-[:checked]:bg-zinc-900 has-[:checked]:text-white has-[:checked]:border-zinc-900"
              >
                <input
                  type="checkbox"
                  name={attr.key}
                  value={o.value}
                  defaultChecked={valueArr.includes(o.value)}
                  className="sr-only"
                />
                {o.label}
              </label>
            ))}
          </div>
          {helpEl}
        </fieldset>
      );
    }
    case "BOOLEAN":
      return (
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            name={attr.key}
            value="true"
            defaultChecked={valueStr === "true" || valueStr === "on"}
            className="w-5 h-5 rounded border-zinc-300"
          />
          <span className="text-sm text-zinc-900">{label}</span>
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      );
    case "SELFIE":
    case "FILE_IMAGE":
    case "FILE_DOC":
      return (
        <div>
          {labelEl}
          <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-4 text-center">
            <p className="text-xs text-zinc-500">
              File uploads will be enabled soon.
            </p>
          </div>
          {helpEl}
        </div>
      );
    case "SECTION_HEADING":
      return (
        <h3 className="text-base font-semibold text-zinc-900 pt-2">{label}</h3>
      );
    case "INFO_BLOCK":
      return (
        <div className="rounded-md bg-blue-50 border border-blue-100 px-3 py-2 text-sm text-blue-900">
          {label}
        </div>
      );
  }
}

function resolveContextPath(
  context: Record<string, unknown>,
  path: string,
): unknown {
  const parts = path.split(".");
  let cur: unknown = context;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return null;
    }
  }
  return cur;
}
