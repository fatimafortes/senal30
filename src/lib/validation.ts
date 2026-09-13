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

export const manufactureSignalSchema = z.object({
  declared_signal: z.string().trim().min(1, "Requerido").max(200),
  justification: z
    .string()
    .trim()
    .min(10, "Explica con más detalle por qué se declara esta señal")
    .max(1000, "Máximo 1000 caracteres"),
});

export type ManufactureSignalInput = z.infer<typeof manufactureSignalSchema>;

export const markUnresolvedSchema = z.object({
  note: z.string().trim().max(1000).optional().default(""),
});

export type MarkUnresolvedInput = z.infer<typeof markUnresolvedSchema>;

export const checkpointAnswersSchema = z.object({
  answers: z
    .array(z.string().trim().min(1, "Respuesta requerida").max(500))
    .length(3, "Se esperan exactamente 3 respuestas"),
});

export type CheckpointAnswersInput = z.infer<typeof checkpointAnswersSchema>;
