// Casos de demostración — 100% inventados, para poder enseñar el producto
// sin depender de la cuota gratuita de Gemini. Su clasificación viene
// escrita a mano aquí, no de una llamada real al modelo: por eso
// `baseline.ai_labeled` se guarda en `false` para estos casos y el audit
// log usa el actor "seed_data", nunca "ai_classifier" — no reclaman haber
// sido generados por IA porque no lo fueron.

type SeedResolution =
  | { type: "manufactured"; declared_signal: string; justification: string }
  | { type: "unresolved"; note: string }
  | null;

export type SeedCase = {
  patient_alias: string;
  detection_type: string;
  detection_value: string;
  detected_at: string;
  affordability_status: "covered" | "lower_cost" | "funded" | "unresolved";
  raw_text: string;
  classification: {
    symptoms: string[];
    has_credible_signal: boolean;
    suggested_primary_signal: string | null;
    rationale: string;
  };
  resolution: SeedResolution;
};

export const SEED_CASES: SeedCase[] = [
  {
    // La pantalla más importante del producto: sin señal, sin resolver
    // todavía — el owner ve la negativa tal cual la vería en un caso real.
    patient_alias: "M.R., 54 (demo)",
    detection_type: "Glucosa capilar",
    detection_value: "214 mg/dL",
    detected_at: "2026-09-08",
    affordability_status: "unresolved",
    raw_text: "Me siento bien, nomás me salió alta el azúcar. No me duele nada.",
    classification: {
      symptoms: [],
      has_credible_signal: false,
      suggested_primary_signal: null,
      rationale:
        "No hay nada que ella vaya a sentir mejorar si toma el medicamento, y sí puede sentir molestias estomacales. Sin una señal, el caso se va a caer sin que nadie se entere.",
    },
    resolution: null,
  },
  {
    patient_alias: "T.G., 58 (demo)",
    detection_type: "Glucosa capilar",
    detection_value: "198 mg/dL",
    detected_at: "2026-08-20",
    affordability_status: "covered",
    raw_text:
      "Tengo mucha sed todo el día y me levanto varias veces en la noche a orinar.",
    classification: {
      symptoms: ["nicturia", "sed excesiva"],
      has_credible_signal: true,
      suggested_primary_signal: "nicturia",
      rationale:
        "En unas semanas de tratamiento debería notar que se levanta mucho menos por las noches y que esa sed constante empieza a desaparecer.",
    },
    resolution: null,
  },
  {
    patient_alias: "A.L., 47 (demo)",
    detection_type: "Glucosa capilar",
    detection_value: "186 mg/dL",
    detected_at: "2026-08-05",
    affordability_status: "lower_cost",
    raw_text: "Me duele mucho la cabeza a veces, pero creo que es del trabajo.",
    classification: {
      symptoms: [],
      has_credible_signal: false,
      suggested_primary_signal: null,
      rationale:
        "El dolor de cabeza que describe no es algo que el tratamiento para el azúcar vaya a cambiar en 30 días, así que no sirve como señal de que le está funcionando.",
    },
    resolution: {
      type: "manufactured",
      declared_signal: "Seguimiento telefónico semanal",
      justification:
        "Se acuerda con la paciente una llamada semanal de seguimiento como señal sustituta mientras se evalúa adherencia real.",
    },
  },
  {
    patient_alias: "E.V., 49 (demo)",
    detection_type: "Glucosa capilar",
    detection_value: "176 mg/dL",
    detected_at: "2026-07-22",
    affordability_status: "funded",
    raw_text: "No siento nada raro, solo vine porque me insistieron.",
    classification: {
      symptoms: [],
      has_credible_signal: false,
      suggested_primary_signal: null,
      rationale:
        "Ella no reporta nada que le moleste hoy, así que no hay ninguna molestia que vaya a notar que desaparece con el tratamiento.",
    },
    resolution: {
      type: "unresolved",
      note: "No reporta ningún síntoma ni acepta declarar una señal manufacturada; se revisará en el próximo corte.",
    },
  },
];
