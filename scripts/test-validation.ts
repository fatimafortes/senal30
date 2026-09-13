// Manual acceptance check for T8 (docs/PACKET.md sección 9): texto de
// 10,000 caracteres y formulario vacío deben rechazarse con mensaje claro,
// antes de tocar la base o el prompt. Prueba el mismo schema y el mismo
// formato de mensaje que usa src/app/api/cases/route.ts, sin necesitar
// sesión ni red.
import { caseIntakeSchema } from "../src/lib/validation.ts";

function describe(label: string, body: unknown) {
  const parsed = caseIntakeSchema.safeParse(body);
  console.log(`\n${label}`);
  if (parsed.success) {
    console.log("  ACEPTADO (esto sería un fallo de T8)");
    return;
  }
  const firstIssue = parsed.error.issues[0];
  const fieldLabel = firstIssue?.path?.[0] ? String(firstIssue.path[0]) : "un campo";
  console.log(`  rechazado ✓ — mensaje: Revisa "${fieldLabel}": ${firstIssue?.message}.`);
  console.log(`  total de errores: ${parsed.error.issues.length}`);
}

const validBase = {
  patient_alias: "Prueba",
  detection_type: "Glucosa capilar",
  detection_value: "200 mg/dL",
  detected_at: "2026-09-13",
  affordability_status: "unresolved",
};

describe("T8a — raw_text de 10,000 caracteres", {
  ...validBase,
  raw_text: "a".repeat(10000),
});

describe("T8b — formulario completamente vacío", {
  patient_alias: "",
  detection_type: "",
  detection_value: "",
  detected_at: "",
  affordability_status: "",
  raw_text: "",
});
