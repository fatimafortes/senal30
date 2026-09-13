import { z } from "zod";

export const AFFORDABILITY_STATUSES = [
  "covered",
  "lower_cost",
  "funded",
  "unresolved",
] as const;

export const caseIntakeSchema = z.object({
  patient_alias: z.string().trim().min(1, "Requerido").max(80),
  detection_type: z.string().trim().min(1, "Requerido").max(80),
  detection_value: z.string().trim().min(1, "Requerido").max(80),
  detected_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  affordability_status: z.enum(AFFORDABILITY_STATUSES),
  raw_text: z
    .string()
    .trim()
    .min(1, "Describe cómo se siente la paciente")
    .max(2000, "Máximo 2000 caracteres"),
});

export type CaseIntakeInput = z.infer<typeof caseIntakeSchema>;
