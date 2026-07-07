export const SCENARIO_LABELS: Record<string, string> = {
  greeting: "Greeting",
  identity: "Identity / Who Are You", // ← add
  capability: "Capability / What Can You Do",
  presence: "Presence Check",
  booking_opening: "Booking — Opening",
  booking_followup: "Booking — Follow-up", // ← add
  booking_confirmation: "Booking — Confirmation",
  booking_success: "Booking — Success",
  booking_failed: "Booking — Failed",
  reschedule_opening: "Reschedule — Opening",
  reschedule_confirmation: "Reschedule — Confirmation",
  reschedule_success: "Reschedule — Success",
  reschedule_failed: "Reschedule — Failed",
  appointment_details: "Appointment Details",
  faq_timings: "FAQ — Clinic Timings",
  faq_services: "FAQ — Services",
  doctor_discovery: "Doctor Search – Ask Treatment",
  doctor_discovery_result: "Doctor Search – Results",
  off_topic: "Off-Topic Redirect",
};

export const SCENARIO_GROUPS: { label: string; keys: string[] }[] = [
  {
    label: "General",
    keys: ["greeting", "identity", "capability", "presence", "off_topic"],
  },
  {
    label: "Booking",
    keys: [
      "booking_opening",
      "booking_followup",
      "booking_confirmation",
      "booking_success",
      "booking_failed",
    ],
  },
  {
    label: "Reschedule",
    keys: [
      "reschedule_opening",
      "reschedule_confirmation",
      "reschedule_success",
      "reschedule_failed",
      "appointment_details",
    ],
  },
  {
    label: "Clinic Info",
    keys: [
      "faq_timings",
      "faq_services",
      "doctor_discovery",
      "doctor_discovery_result",
    ],
  },
];

export function scenarioLabel(key: string): string {
  return SCENARIO_LABELS[key] || key;
}

export const BEHAVIOR_STYLE_OPTIONS = [
  {
    value: "default",
    label: "Default",
    hint: "Use KAKA's replies exactly as generated, no rewriting",
  },
  {
    value: "professional",
    label: "Professional",
    hint: "Clear, direct, formal",
  },
  { value: "polite", label: "Polite", hint: "Warm, respectful, friendly" },
  {
    value: "luxurious",
    label: "Luxurious",
    hint: "Premium, elegant, hospitality-focused",
  },
];
