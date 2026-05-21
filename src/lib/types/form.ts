/**
 * Shared types for the configurable form system.
 *
 * Forms support multiple purposes (onboarding, appointment confirm, etc.)
 * with the same shape: ordered Sections, each containing ordered Blocks
 * of different types. Submitting a form fires one of the configured Actions.
 */

export type FormBlockType = "ATTRIBUTE" | "DISPLAY" | "INFO" | "HEADING";

/** A block that captures an attribute value from the user. */
export type AttributeBlock = {
  type: "ATTRIBUTE";
  /** Attribute.id this block writes to. */
  attributeId: string;
  /** Override label shown above the input. Falls back to Attribute.label. */
  overrideLabel?: string;
  /** Override the attribute's required-ness for this form. */
  isRequired?: boolean;
  /** Override the attribute's help text for this form. */
  overrideHelpText?: string;
};

/**
 * A read-only display block that surfaces context data passed in at render
 * time (e.g. patient name, appointment time). `contextPath` is a dotted
 * path resolved against the render-time context object.
 */
export type DisplayBlock = {
  type: "DISPLAY";
  label: string;
  contextPath: string; // e.g. "patient.name", "appointment.scheduled_at"
  /** Optional formatter hint for the renderer: date|datetime|phone|address|currency */
  format?: "text" | "date" | "datetime" | "phone" | "address" | "currency";
  helpText?: string;
};

/** Free-text informational block — guidance shown to the user. */
export type InfoBlock = {
  type: "INFO";
  text: string;
};

/** A subheading shown inside a section. */
export type HeadingBlock = {
  type: "HEADING";
  text: string;
};

export type FormBlock = AttributeBlock | DisplayBlock | InfoBlock | HeadingBlock;

export type FormSection = {
  key: string; // stable identifier ("identity", "patient")
  title: string;
  description?: string;
  blocks: FormBlock[];
};

export type FormActionKind =
  | "SUBMIT"
  | "ACCEPT"
  | "DECLINE"
  | "COMPLETE"
  | "NEXT";

export type FormActionStyle = "PRIMARY" | "SECONDARY" | "DANGER";

export type FormAction = {
  key: string;
  label: string;
  kind: FormActionKind;
  style?: FormActionStyle;
};

/** Helpers to produce sane defaults when creating a new form. */
export function defaultActionsForPurpose(
  purpose:
    | "ONBOARDING"
    | "APPOINTMENT_CONFIRM"
    | "APPOINTMENT_EXECUTION"
    | "POST_APPOINTMENT"
    | "CUSTOM",
): FormAction[] {
  switch (purpose) {
    case "ONBOARDING":
      return [
        { key: "submit", label: "Submit", kind: "SUBMIT", style: "PRIMARY" },
      ];
    case "APPOINTMENT_CONFIRM":
      return [
        { key: "accept", label: "Accept order", kind: "ACCEPT", style: "PRIMARY" },
        { key: "decline", label: "Can't make it", kind: "DECLINE", style: "DANGER" },
      ];
    case "APPOINTMENT_EXECUTION":
      return [
        { key: "complete", label: "Mark complete", kind: "COMPLETE", style: "PRIMARY" },
      ];
    case "POST_APPOINTMENT":
      return [
        { key: "submit", label: "Submit", kind: "SUBMIT", style: "PRIMARY" },
      ];
    default:
      return [
        { key: "submit", label: "Submit", kind: "SUBMIT", style: "PRIMARY" },
      ];
  }
}

export function defaultStarterSections(
  purpose:
    | "ONBOARDING"
    | "APPOINTMENT_CONFIRM"
    | "APPOINTMENT_EXECUTION"
    | "POST_APPOINTMENT"
    | "CUSTOM",
): FormSection[] {
  switch (purpose) {
    case "APPOINTMENT_CONFIRM":
      return [
        {
          key: "patient",
          title: "Patient details",
          blocks: [
            { type: "DISPLAY", label: "Patient name", contextPath: "patient.name" },
            { type: "DISPLAY", label: "Address", contextPath: "patient.address", format: "address" },
            { type: "DISPLAY", label: "Contact", contextPath: "patient.phone", format: "phone" },
          ],
        },
        {
          key: "appointment",
          title: "Appointment",
          blocks: [
            { type: "DISPLAY", label: "Date & time", contextPath: "appointment.scheduled_at", format: "datetime" },
            { type: "DISPLAY", label: "Service type", contextPath: "order.service_type" },
            { type: "INFO", text: "Tap Accept to confirm, or Can't make it to release the order." },
          ],
        },
      ];
    case "APPOINTMENT_EXECUTION":
      return [
        {
          key: "patient_context",
          title: "Patient",
          blocks: [
            { type: "DISPLAY", label: "Name", contextPath: "patient.name" },
            { type: "DISPLAY", label: "Age / Gender", contextPath: "patient.age_gender" },
          ],
        },
        {
          key: "vitals",
          title: "Vitals",
          blocks: [
            { type: "INFO", text: "Capture observed vitals. Required fields are starred." },
          ],
        },
        {
          key: "notes",
          title: "Notes",
          blocks: [],
        },
      ];
    case "ONBOARDING":
    default:
      return [
        {
          key: "basics",
          title: "About you",
          blocks: [],
        },
      ];
  }
}
