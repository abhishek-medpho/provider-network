/**
 * One-shot: builds the Labstack Nurse Invite onboarding form.
 *
 * Composes a FormTemplate with sections + ATTRIBUTE blocks referencing the
 * seeded nurse-relevant attributes. Idempotent — upserts the form by
 * a stable name so re-running just overwrites the structure.
 *
 * Run: npx tsx prisma/scripts/build-labstack-nurse-form.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Section structure: which attributes go in each section, in order.
const STRUCTURE: { key: string; title: string; description?: string; attributeKeys: string[] }[] = [
  {
    key: "about_you",
    title: "About you",
    description: "Basic identity. Takes ~1 minute.",
    attributeKeys: [
      "full_name",
      "phone",
      "gender",
      "date_of_birth",
      "selfie",
      "alternate_phone",
      "email",
    ],
  },
  {
    key: "qualifications",
    title: "Qualifications & experience",
    attributeKeys: [
      "nurse_qualification",
      "nurse_council_reg_state",
      "nurse_council_reg_number",
      "years_experience",
      "current_employment",
      "current_employer",
    ],
  },
  {
    key: "skills",
    title: "Skills & specializations",
    description: "Tell us what you're comfortable doing. We'll only send jobs that match.",
    attributeKeys: ["nurse_procedures", "nurse_specializations"],
  },
  {
    key: "languages",
    title: "Languages",
    attributeKeys: ["languages_spoken"],
  },
  {
    key: "where",
    title: "Where you can work",
    attributeKeys: [
      "pincode_home",
      "pincodes_serviceable",
      "travel_distance",
      "transport_mode",
    ],
  },
  {
    key: "when",
    title: "When you can work",
    attributeKeys: [
      "days_available",
      "time_slots",
      "same_day_jobs",
      "nurse_service_types",
    ],
  },
  {
    key: "pay",
    title: "Pay expectations",
    description: "Optional. Helps us match you to the right opportunities.",
    attributeKeys: [
      "rate_per_visit",
      "rate_per_shift_12hr",
      "rate_per_livein_24hr",
      "rate_per_month",
    ],
  },
  {
    key: "emergency",
    title: "Emergency contact",
    attributeKeys: [
      "emergency_contact_name",
      "emergency_contact_phone",
      "emergency_contact_relation",
    ],
  },
];

async function main() {
  // Look up each attribute by key
  const allKeys = STRUCTURE.flatMap((s) => s.attributeKeys);
  const attrs = await prisma.attribute.findMany({
    where: { key: { in: allKeys } },
    select: { id: true, key: true },
  });
  const idByKey = new Map(attrs.map((a) => [a.key, a.id]));

  const missing = allKeys.filter((k) => !idByKey.has(k));
  if (missing.length) {
    throw new Error(`Missing attributes: ${missing.join(", ")}`);
  }

  // Build sections JSON
  const sections = STRUCTURE.map((s) => ({
    key: s.key,
    title: s.title,
    ...(s.description ? { description: s.description } : {}),
    blocks: s.attributeKeys.map((k) => ({
      type: "ATTRIBUTE" as const,
      attributeId: idByKey.get(k)!,
    })),
  }));

  const actions = [
    { key: "submit", label: "Submit", kind: "SUBMIT", style: "PRIMARY" },
  ];

  // Resolve target profile type
  const nurseProfile = await prisma.profileType.findUnique({
    where: { code: "NURSE" },
    select: { id: true },
  });
  if (!nurseProfile) throw new Error("NURSE profile type not found");

  const FORM_NAME = "Labstack — Nurse Onboarding";

  const existing = await prisma.formTemplate.findFirst({
    where: { name: FORM_NAME },
    select: { id: true },
  });

  const data = {
    name: FORM_NAME,
    purpose: "ONBOARDING" as const,
    profileTypeId: nurseProfile.id,
    layout: "ONE_PER_SCREEN",
    sections: sections as unknown as object,
    actions: actions as unknown as object,
    status: "DRAFT" as const,
  };

  if (existing) {
    await prisma.formTemplate.update({
      where: { id: existing.id },
      data,
    });
    console.log(`✓ Updated form "${FORM_NAME}" (id: ${existing.id})`);
  } else {
    const created = await prisma.formTemplate.create({ data });
    console.log(`✓ Created form "${FORM_NAME}" (id: ${created.id})`);
  }

  const totalBlocks = sections.reduce((sum, s) => sum + s.blocks.length, 0);
  console.log(
    `  Sections: ${sections.length} · Attribute blocks: ${totalBlocks} · Actions: ${actions.length}`,
  );
}

main()
  .catch((e) => {
    console.error("✗", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
