/**
 * Seed data for Care Provider Platform.
 *
 * Idempotent: re-running upserts by stable keys (attribute.key, profileType.code,
 * messageTemplate.code+language). Safe to run on every fresh migrate.
 *
 * Run: npm run db:seed
 */
import { PrismaClient, AttributeType, PiiLevel, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ============================================================================
// SHARED ATTRIBUTES (used across all profile types)
// ============================================================================

type AttributeSeed = {
  key: string;
  label: string;
  type: AttributeType;
  category?: string;
  helpText?: string;
  options?: { value: string; label: string }[];
  validation?: Record<string, unknown>;
  piiLevel?: PiiLevel;
  isSearchable?: boolean;
  isSystem?: boolean;
};

const sharedAttributes: AttributeSeed[] = [
  // --- Identity ---
  {
    key: "full_name",
    label: "Full name",
    type: AttributeType.TEXT,
    category: "identity",
    validation: { required: true, min: 2, max: 100 },
    piiLevel: PiiLevel.LOW,
    isSystem: true,
    isSearchable: true,
  },
  {
    key: "phone",
    label: "WhatsApp number",
    type: AttributeType.OTP_VERIFIED_PHONE,
    category: "identity",
    validation: { required: true },
    piiLevel: PiiLevel.MEDIUM,
    isSystem: true,
    isSearchable: true,
  },
  {
    key: "alternate_phone",
    label: "Alternate contact number",
    type: AttributeType.PHONE,
    category: "identity",
    piiLevel: PiiLevel.MEDIUM,
  },
  {
    key: "email",
    label: "Email address",
    type: AttributeType.EMAIL,
    category: "identity",
    piiLevel: PiiLevel.MEDIUM,
  },
  {
    key: "gender",
    label: "Gender",
    type: AttributeType.SINGLE_SELECT,
    category: "identity",
    options: [
      { value: "female", label: "Female" },
      { value: "male", label: "Male" },
      { value: "other", label: "Other" },
      { value: "prefer_not_to_say", label: "Prefer not to say" },
    ],
    validation: { required: true },
    isSearchable: true,
  },
  {
    key: "date_of_birth",
    label: "Date of birth",
    type: AttributeType.DATE,
    category: "identity",
    validation: { required: true, ageMin: 18 },
    piiLevel: PiiLevel.MEDIUM,
  },
  {
    key: "selfie",
    label: "Take a selfie",
    type: AttributeType.SELFIE,
    category: "identity",
    helpText: "Helps patients recognize you and builds trust.",
    validation: { required: true, fileMaxKb: 800 },
    piiLevel: PiiLevel.MEDIUM,
  },
  // --- Geography ---
  {
    key: "pincode_home",
    label: "Home pincode",
    type: AttributeType.PINCODE,
    category: "geography",
    validation: { required: true, regex: "^\\d{6}$" },
    isSearchable: true,
  },
  {
    key: "pincodes_serviceable",
    label: "Pincodes you can serve",
    type: AttributeType.MULTI_SELECT,
    category: "geography",
    helpText: "Up to 8 pincodes you're willing to travel to.",
    validation: { required: true, minItems: 1, maxItems: 8 },
    isSearchable: true,
  },
  {
    key: "travel_distance",
    label: "How far are you willing to travel?",
    type: AttributeType.SINGLE_SELECT,
    category: "geography",
    options: [
      { value: "same_pincode", label: "Same pincode only" },
      { value: "5km", label: "Up to 5 km" },
      { value: "15km", label: "5 – 15 km" },
      { value: "15km_plus", label: "More than 15 km" },
    ],
    validation: { required: true },
  },
  {
    key: "transport_mode",
    label: "How do you travel for work?",
    type: AttributeType.SINGLE_SELECT,
    category: "geography",
    options: [
      { value: "own_2w", label: "Own 2-wheeler" },
      { value: "own_4w", label: "Own 4-wheeler" },
      { value: "public", label: "Public transport" },
      { value: "cab", label: "Cab / ride-share" },
    ],
    validation: { required: true },
  },
  // --- Languages ---
  {
    key: "languages_spoken",
    label: "Languages you speak",
    type: AttributeType.MULTI_SELECT,
    category: "languages",
    options: [
      { value: "en", label: "English" },
      { value: "hi", label: "Hindi" },
      { value: "kn", label: "Kannada" },
      { value: "ta", label: "Tamil" },
      { value: "te", label: "Telugu" },
      { value: "ml", label: "Malayalam" },
      { value: "bn", label: "Bengali" },
      { value: "mr", label: "Marathi" },
      { value: "gu", label: "Gujarati" },
      { value: "pa", label: "Punjabi" },
      { value: "ur", label: "Urdu" },
      { value: "or", label: "Odia" },
    ],
    validation: { required: true, minItems: 1 },
    isSearchable: true,
  },
  // --- Availability ---
  {
    key: "days_available",
    label: "Days you can work",
    type: AttributeType.MULTI_SELECT,
    category: "availability",
    options: [
      { value: "mon", label: "Mon" },
      { value: "tue", label: "Tue" },
      { value: "wed", label: "Wed" },
      { value: "thu", label: "Thu" },
      { value: "fri", label: "Fri" },
      { value: "sat", label: "Sat" },
      { value: "sun", label: "Sun" },
    ],
    validation: { required: true, minItems: 1 },
    isSearchable: true,
  },
  {
    key: "time_slots",
    label: "Time slots you can work",
    type: AttributeType.MULTI_SELECT,
    category: "availability",
    options: [
      { value: "morning", label: "Morning (6 AM – 12 PM)" },
      { value: "afternoon", label: "Afternoon (12 PM – 6 PM)" },
      { value: "evening", label: "Evening (6 PM – 10 PM)" },
      { value: "night", label: "Night (10 PM – 6 AM)" },
    ],
    validation: { required: true, minItems: 1 },
    isSearchable: true,
  },
  {
    key: "same_day_jobs",
    label: "Open to same-day job requests?",
    type: AttributeType.SINGLE_SELECT,
    category: "availability",
    options: [
      { value: "yes", label: "Yes" },
      { value: "sometimes", label: "Sometimes" },
      { value: "no", label: "No" },
    ],
    validation: { required: true },
  },
  // --- Experience ---
  {
    key: "years_experience",
    label: "Total years of experience",
    type: AttributeType.SINGLE_SELECT,
    category: "experience",
    options: [
      { value: "lt_1", label: "Less than 1 year" },
      { value: "1_3", label: "1 – 3 years" },
      { value: "3_5", label: "3 – 5 years" },
      { value: "5_10", label: "5 – 10 years" },
      { value: "10_plus", label: "10+ years" },
    ],
    validation: { required: true },
    isSearchable: true,
  },
  {
    key: "current_employment",
    label: "Are you currently employed?",
    type: AttributeType.SINGLE_SELECT,
    category: "experience",
    options: [
      { value: "fulltime", label: "Yes, full-time" },
      { value: "parttime", label: "Yes, part-time" },
      { value: "freelance", label: "Freelance / on-call" },
      { value: "unemployed", label: "Not currently working" },
    ],
    validation: { required: true },
  },
  {
    key: "current_employer",
    label: "Current employer",
    type: AttributeType.TEXT,
    category: "experience",
    helpText: "Name of hospital, clinic, or agency",
  },
  // --- Commercials ---
  {
    key: "rate_per_visit",
    label: "Expected pay per visit (₹)",
    type: AttributeType.NUMBER,
    category: "commercials",
    helpText: "What you'd charge for a 1-2 hour visit",
    validation: { min: 0, max: 50000 },
  },
  {
    key: "rate_per_shift_12hr",
    label: "Expected pay per 12-hour shift (₹)",
    type: AttributeType.NUMBER,
    category: "commercials",
    validation: { min: 0, max: 100000 },
  },
  {
    key: "rate_per_livein_24hr",
    label: "Expected pay per 24-hour live-in (₹)",
    type: AttributeType.NUMBER,
    category: "commercials",
    validation: { min: 0, max: 100000 },
  },
  {
    key: "rate_per_month",
    label: "Expected monthly pay if hired long-term (₹)",
    type: AttributeType.NUMBER,
    category: "commercials",
    validation: { min: 0, max: 500000 },
  },
  // --- Emergency contact ---
  {
    key: "emergency_contact_name",
    label: "Emergency contact name",
    type: AttributeType.TEXT,
    category: "emergency",
    piiLevel: PiiLevel.MEDIUM,
  },
  {
    key: "emergency_contact_phone",
    label: "Emergency contact phone",
    type: AttributeType.PHONE,
    category: "emergency",
    piiLevel: PiiLevel.MEDIUM,
  },
  {
    key: "emergency_contact_relation",
    label: "Relationship",
    type: AttributeType.SINGLE_SELECT,
    category: "emergency",
    options: [
      { value: "spouse", label: "Spouse" },
      { value: "parent", label: "Parent" },
      { value: "sibling", label: "Sibling" },
      { value: "child", label: "Child" },
      { value: "friend", label: "Friend" },
      { value: "other", label: "Other" },
    ],
  },
];

// ============================================================================
// ROLE-SPECIFIC ATTRIBUTES
// ============================================================================

const nurseAttributes: AttributeSeed[] = [
  {
    key: "nurse_qualification",
    label: "Highest nursing qualification",
    type: AttributeType.SINGLE_SELECT,
    category: "qualification",
    options: [
      { value: "anm", label: "ANM (Auxiliary Nurse Midwife)" },
      { value: "gnm", label: "GNM (General Nursing & Midwifery)" },
      { value: "bsc_nursing", label: "B.Sc Nursing" },
      { value: "pb_bsc_nursing", label: "P.B. B.Sc Nursing" },
      { value: "msc_nursing", label: "M.Sc Nursing" },
      { value: "other", label: "Other" },
    ],
    validation: { required: true },
    isSearchable: true,
  },
  {
    key: "nurse_council_reg_state",
    label: "Nursing Council registration state",
    type: AttributeType.SINGLE_SELECT,
    category: "qualification",
    options: [
      { value: "knc", label: "Karnataka Nursing Council" },
      { value: "tnnmc", label: "Tamil Nadu Nurses & Midwives Council" },
      { value: "apnc", label: "Andhra Pradesh Nursing Council" },
      { value: "knc_kerala", label: "Kerala Nursing Council" },
      { value: "mhnc", label: "Maharashtra Nursing Council" },
      { value: "dnc", label: "Delhi Nursing Council" },
      { value: "inc", label: "Indian Nursing Council" },
      { value: "other", label: "Other" },
    ],
  },
  {
    key: "nurse_council_reg_number",
    label: "Council registration number",
    type: AttributeType.TEXT,
    category: "qualification",
    piiLevel: PiiLevel.MEDIUM,
  },
  {
    key: "nurse_procedures",
    label: "Procedures you're comfortable performing",
    type: AttributeType.MULTI_SELECT,
    category: "skills",
    options: [
      { value: "im_injection", label: "IM injection" },
      { value: "iv_cannulation", label: "IV cannulation" },
      { value: "iv_injection", label: "IV injection" },
      { value: "vitals", label: "Vitals check (BP, pulse, temp)" },
      { value: "wound_dressing", label: "Wound dressing" },
      { value: "suture_removal", label: "Suture removal" },
      { value: "catheter_male", label: "Male catheterization" },
      { value: "catheter_female", label: "Female catheterization" },
      { value: "ryles_tube", label: "Ryle's tube insertion & feeding" },
      { value: "tracheostomy_care", label: "Tracheostomy care" },
      { value: "nebulization", label: "Nebulization" },
      { value: "ecg", label: "ECG" },
      { value: "glucose_monitoring", label: "Glucose monitoring" },
      { value: "insulin_admin", label: "Insulin administration" },
      { value: "postop_care", label: "Post-operative care" },
      { value: "bedridden_care", label: "Bed-ridden patient care" },
      { value: "diaper_change", label: "Diaper change" },
      { value: "physio_assist", label: "Physiotherapy assistance" },
      { value: "ventilator_care", label: "Ventilator care" },
      { value: "bp_monitoring", label: "Continuous BP monitoring" },
    ],
    validation: { required: true, minItems: 3 },
    isSearchable: true,
  },
  {
    key: "nurse_specializations",
    label: "Specializations",
    type: AttributeType.MULTI_SELECT,
    category: "skills",
    options: [
      { value: "icu", label: "ICU" },
      { value: "nicu", label: "NICU" },
      { value: "picu", label: "PICU" },
      { value: "pediatric", label: "Pediatric" },
      { value: "geriatric", label: "Geriatric" },
      { value: "palliative", label: "Palliative care" },
      { value: "oncology", label: "Oncology" },
      { value: "cardiac", label: "Cardiac" },
      { value: "stroke", label: "Stroke / neuro" },
      { value: "diabetic", label: "Diabetic care" },
      { value: "maternity", label: "Maternity" },
      { value: "general", label: "General ward" },
    ],
    isSearchable: true,
  },
  {
    key: "nurse_service_types",
    label: "Types of jobs you want",
    type: AttributeType.MULTI_SELECT,
    category: "service",
    options: [
      { value: "visit_1_2hr", label: "One-time visit (1-2 hr)" },
      { value: "shift_6hr", label: "Short shift (6 hr)" },
      { value: "shift_12hr", label: "Day or night shift (12 hr)" },
      { value: "livein_24hr", label: "Live-in (24 hr)" },
    ],
    validation: { required: true, minItems: 1 },
    isSearchable: true,
  },
];

const phleboAttributes: AttributeSeed[] = [
  {
    key: "phlebo_qualification",
    label: "Highest qualification",
    type: AttributeType.SINGLE_SELECT,
    category: "qualification",
    options: [
      { value: "dmlt", label: "DMLT (Diploma in Medical Lab Technology)" },
      { value: "bmlt", label: "BMLT (Bachelor in Medical Lab Technology)" },
      { value: "cmlt", label: "CMLT (Certificate in MLT)" },
      { value: "on_job", label: "On-the-job trained" },
      { value: "other", label: "Other" },
    ],
    validation: { required: true },
    isSearchable: true,
  },
  {
    key: "phlebo_procedures",
    label: "Procedures you're comfortable performing",
    type: AttributeType.MULTI_SELECT,
    category: "skills",
    options: [
      { value: "venous_sample", label: "Venous blood sample" },
      { value: "capillary_sample", label: "Capillary / fingerprick sample" },
      { value: "pediatric_sample", label: "Pediatric sample collection" },
      { value: "senior_sample", label: "Senior citizen sample collection" },
      { value: "urine_sample", label: "Urine sample collection" },
      { value: "ecg", label: "ECG" },
      { value: "vitals", label: "Vitals (BP, pulse, temp)" },
      { value: "glucose_test", label: "Glucose test (on-spot)" },
      { value: "cold_chain", label: "Cold-chain handling" },
    ],
    validation: { required: true, minItems: 2 },
    isSearchable: true,
  },
  {
    key: "phlebo_service_types",
    label: "Types of jobs you want",
    type: AttributeType.MULTI_SELECT,
    category: "service",
    options: [
      { value: "sample_visit", label: "Sample collection visit" },
      { value: "ecg_visit", label: "ECG visit" },
      { value: "vitals_visit", label: "Vitals check visit" },
    ],
    validation: { required: true, minItems: 1 },
    isSearchable: true,
  },
];

const gdaAttributes: AttributeSeed[] = [
  {
    key: "gda_qualification",
    label: "Highest qualification",
    type: AttributeType.SINGLE_SELECT,
    category: "qualification",
    options: [
      { value: "10th", label: "10th pass" },
      { value: "12th", label: "12th pass" },
      { value: "gda_cert", label: "GDA certification course" },
      { value: "other", label: "Other" },
    ],
    validation: { required: true },
  },
  {
    key: "gda_procedures",
    label: "Tasks you're comfortable doing",
    type: AttributeType.MULTI_SELECT,
    category: "skills",
    options: [
      { value: "bed_making", label: "Bed making" },
      { value: "diaper_change", label: "Diaper change" },
      { value: "feeding", label: "Feeding (oral / spoon)" },
      { value: "mobility_assist", label: "Mobility assistance" },
      { value: "bathing", label: "Bathing assistance" },
      { value: "companion", label: "Companion care" },
      { value: "med_reminders", label: "Medication reminders" },
      { value: "vitals_basic", label: "Basic vitals check" },
    ],
    validation: { required: true, minItems: 2 },
    isSearchable: true,
  },
  {
    key: "gda_service_types",
    label: "Types of jobs you want",
    type: AttributeType.MULTI_SELECT,
    category: "service",
    options: [
      { value: "shift_12hr_day", label: "Day shift (12 hr)" },
      { value: "shift_12hr_night", label: "Night shift (12 hr)" },
      { value: "livein_24hr", label: "Live-in (24 hr)" },
    ],
    validation: { required: true, minItems: 1 },
    isSearchable: true,
  },
];

const caretakerAttributes: AttributeSeed[] = [
  {
    key: "caretaker_qualification",
    label: "Highest qualification",
    type: AttributeType.SINGLE_SELECT,
    category: "qualification",
    options: [
      { value: "below_10th", label: "Below 10th" },
      { value: "10th", label: "10th pass" },
      { value: "12th", label: "12th pass" },
      { value: "graduate", label: "Graduate" },
    ],
    validation: { required: true },
  },
  {
    key: "caretaker_procedures",
    label: "Tasks you're comfortable doing",
    type: AttributeType.MULTI_SELECT,
    category: "skills",
    options: [
      { value: "companion", label: "Companion care" },
      { value: "mobility_assist", label: "Mobility assistance" },
      { value: "med_reminders", label: "Medication reminders" },
      { value: "feeding", label: "Feeding" },
      { value: "household", label: "Light household help" },
      { value: "errands", label: "Errands / grocery" },
    ],
    validation: { required: true, minItems: 2 },
    isSearchable: true,
  },
  {
    key: "caretaker_service_types",
    label: "Types of jobs you want",
    type: AttributeType.MULTI_SELECT,
    category: "service",
    options: [
      { value: "shift_12hr_day", label: "Day shift (12 hr)" },
      { value: "shift_12hr_night", label: "Night shift (12 hr)" },
      { value: "livein_24hr", label: "Live-in (24 hr)" },
    ],
    validation: { required: true, minItems: 1 },
    isSearchable: true,
  },
];

const physioAttributes: AttributeSeed[] = [
  {
    key: "physio_qualification",
    label: "Highest physiotherapy qualification",
    type: AttributeType.SINGLE_SELECT,
    category: "qualification",
    options: [
      { value: "bpt", label: "BPT (Bachelor of Physiotherapy)" },
      { value: "mpt", label: "MPT (Master of Physiotherapy)" },
      { value: "diploma", label: "Diploma in Physiotherapy" },
      { value: "other", label: "Other" },
    ],
    validation: { required: true },
    isSearchable: true,
  },
  {
    key: "physio_council_reg",
    label: "Physiotherapy council registration number",
    type: AttributeType.TEXT,
    category: "qualification",
  },
  {
    key: "physio_specializations",
    label: "Areas of focus",
    type: AttributeType.MULTI_SELECT,
    category: "skills",
    options: [
      { value: "post_op_rehab", label: "Post-operative rehab" },
      { value: "stroke_rehab", label: "Stroke / neuro rehab" },
      { value: "geriatric", label: "Geriatric" },
      { value: "sports_injury", label: "Sports injury" },
      { value: "pediatric", label: "Pediatric" },
      { value: "ortho", label: "Orthopedic" },
      { value: "cardio_resp", label: "Cardio-respiratory" },
      { value: "chronic_pain", label: "Chronic pain management" },
    ],
    validation: { required: true, minItems: 1 },
    isSearchable: true,
  },
  {
    key: "physio_service_types",
    label: "Types of jobs you want",
    type: AttributeType.MULTI_SELECT,
    category: "service",
    options: [
      { value: "session_visit", label: "Home visit session (45-60 min)" },
      { value: "package_10", label: "Package of 10 sessions" },
      { value: "package_20", label: "Package of 20 sessions" },
    ],
    validation: { required: true, minItems: 1 },
    isSearchable: true,
  },
];

// ============================================================================
// PROFILE TYPES
// ============================================================================

type ProfileTypeSeed = {
  code: string;
  label: string;
  description: string;
  icon: string;
  color: string;
  requiresCouncilReg: boolean;
  requiresQualCert: boolean;
  sortOrder: number;
  /** Section assignment: order of sections, with attribute keys per section. */
  sections: { key: string; title: string; attributeKeys: string[] }[];
};

const profileTypes: ProfileTypeSeed[] = [
  {
    code: "NURSE",
    label: "Nurse",
    description: "Registered nurse — ANM, GNM, B.Sc, M.Sc",
    icon: "🩺",
    color: "#3b82f6",
    requiresCouncilReg: true,
    requiresQualCert: true,
    sortOrder: 10,
    sections: [
      {
        key: "identity",
        title: "About you",
        attributeKeys: [
          "full_name",
          "phone",
          "gender",
          "date_of_birth",
          "selfie",
        ],
      },
      {
        key: "qualification",
        title: "Qualification",
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
        attributeKeys: ["nurse_procedures", "nurse_specializations"],
      },
      {
        key: "service",
        title: "Where & when you work",
        attributeKeys: [
          "pincode_home",
          "pincodes_serviceable",
          "travel_distance",
          "transport_mode",
          "languages_spoken",
          "days_available",
          "time_slots",
          "same_day_jobs",
          "nurse_service_types",
        ],
      },
      {
        key: "commercials",
        title: "Pay expectations",
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
    ],
  },
  {
    code: "PHLEBO",
    label: "Phlebotomist",
    description: "Sample collection professional",
    icon: "💉",
    color: "#ef4444",
    requiresCouncilReg: false,
    requiresQualCert: true,
    sortOrder: 20,
    sections: [
      {
        key: "identity",
        title: "About you",
        attributeKeys: [
          "full_name",
          "phone",
          "gender",
          "date_of_birth",
          "selfie",
        ],
      },
      {
        key: "qualification",
        title: "Qualification",
        attributeKeys: [
          "phlebo_qualification",
          "years_experience",
          "current_employment",
          "current_employer",
        ],
      },
      {
        key: "skills",
        title: "Skills",
        attributeKeys: ["phlebo_procedures"],
      },
      {
        key: "service",
        title: "Where & when you work",
        attributeKeys: [
          "pincode_home",
          "pincodes_serviceable",
          "travel_distance",
          "transport_mode",
          "languages_spoken",
          "days_available",
          "time_slots",
          "same_day_jobs",
          "phlebo_service_types",
        ],
      },
      {
        key: "commercials",
        title: "Pay expectations",
        attributeKeys: ["rate_per_visit"],
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
    ],
  },
  {
    code: "GDA",
    label: "GDA / Patient Care Attendant",
    description: "General Duty Assistant",
    icon: "🤝",
    color: "#10b981",
    requiresCouncilReg: false,
    requiresQualCert: false,
    sortOrder: 30,
    sections: [
      {
        key: "identity",
        title: "About you",
        attributeKeys: [
          "full_name",
          "phone",
          "gender",
          "date_of_birth",
          "selfie",
        ],
      },
      {
        key: "qualification",
        title: "Background",
        attributeKeys: [
          "gda_qualification",
          "years_experience",
          "current_employment",
          "current_employer",
        ],
      },
      {
        key: "skills",
        title: "What you can do",
        attributeKeys: ["gda_procedures"],
      },
      {
        key: "service",
        title: "Where & when you work",
        attributeKeys: [
          "pincode_home",
          "pincodes_serviceable",
          "travel_distance",
          "transport_mode",
          "languages_spoken",
          "days_available",
          "time_slots",
          "same_day_jobs",
          "gda_service_types",
        ],
      },
      {
        key: "commercials",
        title: "Pay expectations",
        attributeKeys: [
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
    ],
  },
  {
    code: "CARETAKER",
    label: "Caretaker / Companion",
    description: "Non-medical caretaker for elderly companion care",
    icon: "👴",
    color: "#a855f7",
    requiresCouncilReg: false,
    requiresQualCert: false,
    sortOrder: 40,
    sections: [
      {
        key: "identity",
        title: "About you",
        attributeKeys: [
          "full_name",
          "phone",
          "gender",
          "date_of_birth",
          "selfie",
        ],
      },
      {
        key: "qualification",
        title: "Background",
        attributeKeys: [
          "caretaker_qualification",
          "years_experience",
          "current_employment",
        ],
      },
      {
        key: "skills",
        title: "What you can do",
        attributeKeys: ["caretaker_procedures"],
      },
      {
        key: "service",
        title: "Where & when you work",
        attributeKeys: [
          "pincode_home",
          "pincodes_serviceable",
          "travel_distance",
          "transport_mode",
          "languages_spoken",
          "days_available",
          "time_slots",
          "caretaker_service_types",
        ],
      },
      {
        key: "commercials",
        title: "Pay expectations",
        attributeKeys: [
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
    ],
  },
  {
    code: "PHYSIO",
    label: "Physiotherapist",
    description: "BPT / MPT physiotherapist",
    icon: "🦵",
    color: "#f59e0b",
    requiresCouncilReg: false,
    requiresQualCert: true,
    sortOrder: 50,
    sections: [
      {
        key: "identity",
        title: "About you",
        attributeKeys: [
          "full_name",
          "phone",
          "gender",
          "date_of_birth",
          "selfie",
        ],
      },
      {
        key: "qualification",
        title: "Qualification",
        attributeKeys: [
          "physio_qualification",
          "physio_council_reg",
          "years_experience",
          "current_employment",
          "current_employer",
        ],
      },
      {
        key: "skills",
        title: "Specializations",
        attributeKeys: ["physio_specializations"],
      },
      {
        key: "service",
        title: "Where & when you work",
        attributeKeys: [
          "pincode_home",
          "pincodes_serviceable",
          "travel_distance",
          "transport_mode",
          "languages_spoken",
          "days_available",
          "time_slots",
          "same_day_jobs",
          "physio_service_types",
        ],
      },
      {
        key: "commercials",
        title: "Pay expectations",
        attributeKeys: ["rate_per_visit", "rate_per_month"],
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
    ],
  },
];

// ============================================================================
// MESSAGE TEMPLATES
// ============================================================================

const messageTemplates = [
  {
    code: "invite_generic",
    name: "Generic invite (any role)",
    kind: "INVITE" as const,
    body:
      "Hi {{name}}! 👋\n\nWe're hiring {{role_label}}s in your area through our home-care platform.\n\nTell us about yourself in a 3-min form, and we'll start sending you nearby job opportunities:\n\n{{form_link}}\n\nReply STOP to opt out.",
    variables: ["name", "role_label", "form_link"],
  },
  {
    code: "reminder_24h",
    name: "24-hour incomplete reminder",
    kind: "REMINDER" as const,
    body:
      "Hi {{name}}, just a quick reminder — your profile is half-done.\n\nFinish it in 2 min so we can send you jobs near {{pincode}}:\n\n{{form_link}}",
    variables: ["name", "pincode", "form_link"],
  },
  {
    code: "reminder_72h",
    name: "72-hour final reminder",
    kind: "REMINDER" as const,
    body:
      "Hi {{name}}, last reminder. We've got home-care jobs ready in your area.\n\nComplete your profile and we'll start sending you offers:\n\n{{form_link}}",
    variables: ["name", "form_link"],
  },
  {
    code: "form_submitted_thanks",
    name: "Form-submitted confirmation",
    kind: "CONFIRMATION" as const,
    body:
      "Thanks {{name}}! ✅\n\nWe've saved your profile. Our team will verify it in 24-48 hours, and then you'll start receiving job offers in your area.",
    variables: ["name"],
  },
  {
    code: "verified_active",
    name: "Profile verified — activation",
    kind: "ACTIVATION" as const,
    body:
      "🎉 Welcome aboard, {{name}}!\n\nYour profile is verified. From now on, you'll get job offers via WhatsApp. Just reply YES to the ones you want.",
    variables: ["name"],
  },
];

// ============================================================================
// SEED RUNNER
// ============================================================================

async function upsertAttribute(seed: AttributeSeed) {
  return prisma.attribute.upsert({
    where: { key: seed.key },
    update: {
      label: seed.label,
      type: seed.type,
      category: seed.category,
      helpText: seed.helpText,
      options: seed.options ? (seed.options as Prisma.InputJsonValue) : Prisma.JsonNull,
      validation: seed.validation ? (seed.validation as Prisma.InputJsonValue) : Prisma.JsonNull,
      piiLevel: seed.piiLevel ?? "NONE",
      isSearchable: seed.isSearchable ?? false,
      isSystem: seed.isSystem ?? false,
    },
    create: {
      key: seed.key,
      label: seed.label,
      type: seed.type,
      category: seed.category,
      helpText: seed.helpText,
      options: seed.options ? (seed.options as Prisma.InputJsonValue) : Prisma.JsonNull,
      validation: seed.validation ? (seed.validation as Prisma.InputJsonValue) : Prisma.JsonNull,
      piiLevel: seed.piiLevel ?? "NONE",
      isSearchable: seed.isSearchable ?? false,
      isSystem: seed.isSystem ?? false,
    },
  });
}

async function main() {
  console.log("🌱 Seeding Care Provider Platform...");

  // 1) Attributes (shared + role-specific)
  const allAttrSeeds = [
    ...sharedAttributes,
    ...nurseAttributes,
    ...phleboAttributes,
    ...gdaAttributes,
    ...caretakerAttributes,
    ...physioAttributes,
  ];
  console.log(`  • Upserting ${allAttrSeeds.length} attributes`);
  for (const seed of allAttrSeeds) {
    await upsertAttribute(seed);
  }

  // Build a lookup: attribute key → id
  const attrs = await prisma.attribute.findMany({
    select: { id: true, key: true },
  });
  const attrIdByKey = new Map(attrs.map((a) => [a.key, a.id]));

  // 2) Profile types
  console.log(`  • Upserting ${profileTypes.length} profile types`);
  for (const pt of profileTypes) {
    const created = await prisma.profileType.upsert({
      where: { code: pt.code },
      update: {
        label: pt.label,
        description: pt.description,
        icon: pt.icon,
        color: pt.color,
        requiresCouncilReg: pt.requiresCouncilReg,
        requiresQualCert: pt.requiresQualCert,
        sortOrder: pt.sortOrder,
      },
      create: {
        code: pt.code,
        label: pt.label,
        description: pt.description,
        icon: pt.icon,
        color: pt.color,
        requiresCouncilReg: pt.requiresCouncilReg,
        requiresQualCert: pt.requiresQualCert,
        sortOrder: pt.sortOrder,
      },
    });

    // Wipe and re-create the ProfileTypeAttribute bindings.
    // (Idempotent and cheap; profile types are small.)
    await prisma.profileTypeAttribute.deleteMany({
      where: { profileTypeId: created.id },
    });

    let order = 0;
    for (const section of pt.sections) {
      for (const attrKey of section.attributeKeys) {
        const attrId = attrIdByKey.get(attrKey);
        if (!attrId) {
          console.warn(
            `    ⚠ profile type ${pt.code} references unknown attribute ${attrKey}`,
          );
          continue;
        }
        const seed =
          allAttrSeeds.find((a) => a.key === attrKey) ?? null;
        const isRequired = Boolean(
          (seed?.validation as { required?: boolean } | undefined)?.required,
        );
        await prisma.profileTypeAttribute.create({
          data: {
            profileTypeId: created.id,
            attributeId: attrId,
            sectionKey: section.key,
            isRequired,
            sortOrder: order++,
          },
        });
      }
    }
  }

  // 3) Message templates
  console.log(`  • Upserting ${messageTemplates.length} message templates`);
  for (const tpl of messageTemplates) {
    await prisma.messageTemplate.upsert({
      where: { code_language: { code: tpl.code, language: "en" } },
      update: {
        name: tpl.name,
        kind: tpl.kind,
        body: tpl.body,
        variables: tpl.variables,
      },
      create: {
        code: tpl.code,
        language: "en",
        name: tpl.name,
        kind: tpl.kind,
        channel: "WHATSAPP",
        body: tpl.body,
        variables: tpl.variables,
      },
    });
  }

  // 4) Bootstrap super admin from ADMIN_EMAIL + ADMIN_PASSWORD
  const adminEmail = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  const adminName = process.env.ADMIN_NAME ?? null;
  if (adminEmail && adminPassword) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const existing = await prisma.user.findUnique({
      where: { email: adminEmail },
    });
    if (existing) {
      // Only refresh password if env was changed; otherwise leave it alone
      // so re-running seed doesn't reset a password the admin already changed.
      const passwordChanged = !(await bcrypt.compare(
        adminPassword,
        existing.passwordHash,
      ));
      await prisma.user.update({
        where: { email: adminEmail },
        data: {
          role: "SUPER_ADMIN",
          active: true,
          name: adminName ?? existing.name,
          ...(passwordChanged ? { passwordHash } : {}),
        },
      });
      console.log(
        `  • Bootstrap admin: ${adminEmail} (existing user updated${passwordChanged ? ", password reset from env" : ""})`,
      );
    } else {
      await prisma.user.create({
        data: {
          email: adminEmail,
          passwordHash,
          name: adminName,
          role: "SUPER_ADMIN",
          active: true,
        },
      });
      console.log(`  • Bootstrap admin: ${adminEmail} (created)`);
    }
  } else {
    console.log(
      "  • No ADMIN_EMAIL / ADMIN_PASSWORD in env — skipping admin bootstrap",
    );
  }

  console.log("✅ Seed complete.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
