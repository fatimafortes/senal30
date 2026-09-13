import { z } from "zod";

// Único punto de contacto con el proveedor de LLM. Todo lo que esté fuera de
// este archivo solo conoce `classifyBaselineSymptoms` — cambiar de proveedor
// más adelante no debería tocar nada más en la app.

const MAX_INPUT_LENGTH = 2000;
const GEMINI_MODEL = "gemini-3.6-flash";

const REVERSIBLE_SYMPTOMS = [
  "nicturia",
  "sed excesiva",
  "fatiga",
  "visión borrosa",
  "infección recurrente",
  "herida que sana lento",
] as const;

const classificationSchema = z.object({
  symptoms: z.array(z.string()).default([]),
  has_credible_signal: z.boolean(),
  suggested_primary_signal: z.string().nullable().default(null),
  rationale: z.string().default(""),
});

export type BaselineClassification = z.infer<typeof classificationSchema>;

// Falla siempre hacia el rechazo, nunca hacia la inscripción automática.
const REFUSAL_FALLBACK: BaselineClassification = {
  symptoms: [],
  has_credible_signal: false,
  suggested_primary_signal: null,
  rationale:
    "No se pudo clasificar el texto automáticamente — caso marcado para revisión humana.",
};

const SYSTEM_PROMPT = `Eres un clasificador clínico auxiliar. Recibes una descripción en texto libre, en español y en las palabras de la propia persona, de cómo se siente alguien recién diagnosticado con hiperglucemia.

Tu única tarea es identificar candidatos a "señal de retorno a 30 días": síntomas que (a) la persona describe sentir ahora mismo, y (b) son razonablemente reversibles dentro de 30 días de tratamiento. La lista cerrada de síntomas reversibles válidos es: ${REVERSIBLE_SYMPTOMS.join(", ")}.

No inventes síntomas que no estén sugeridos por el texto. Si el texto no describe ningún síntoma sentido (por ejemplo, solo menciona un resultado de laboratorio, o dice sentirse bien), o describe algo no reversible en 30 días (por ejemplo dolor articular crónico, un problema no relacionado con la glucosa), responde que no hay señal creíble.

Responde ÚNICAMENTE con JSON, sin texto adicional, sin explicación fuera del campo "rationale", y sin fences de markdown, con exactamente esta forma:
{"symptoms": string[], "has_credible_signal": boolean, "suggested_primary_signal": string | null, "rationale": string}`;

function stripCodeFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
}

/**
 * Clasifica texto libre de síntomas en candidatos de señal de retorno a 30
 * días. Nunca recibe el alias del paciente ni ningún identificador — solo el
 * texto de síntomas, ya truncado a MAX_INPUT_LENGTH.
 *
 * Cualquier fallo (red, parseo, forma inesperada) cae en REFUSAL_FALLBACK:
 * has_credible_signal siempre en false, marcado para revisión humana.
 */
export async function classifyBaselineSymptoms(
  rawText: string
): Promise<BaselineClassification> {
  const cappedText = rawText.slice(0, MAX_INPUT_LENGTH);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return REFUSAL_FALLBACK;
  }

  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: cappedText }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
          },
        }),
      }
    );
  } catch (err) {
    console.error("[llm] fetch failed", err);
    return REFUSAL_FALLBACK;
  }

  if (!response.ok) {
    console.error(
      "[llm] non-ok response",
      response.status,
      await response.text().catch(() => "")
    );
    return REFUSAL_FALLBACK;
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch (err) {
    console.error("[llm] failed to parse response body as JSON", err);
    return REFUSAL_FALLBACK;
  }

  const text = extractText(data);
  if (typeof text !== "string") {
    console.error("[llm] unexpected response shape", JSON.stringify(data));
    return REFUSAL_FALLBACK;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFences(text));
  } catch (err) {
    console.error("[llm] model output was not valid JSON", text, err);
    return REFUSAL_FALLBACK;
  }

  const result = classificationSchema.safeParse(parsed);
  if (!result.success) {
    console.error("[llm] model output failed schema validation", parsed, result.error);
    return REFUSAL_FALLBACK;
  }

  return enforceConsistency(result.data);
}

// Red de seguridad además del prompt: si no hay síntomas concretos o no hay
// señal primaria declarada, la señal no puede ser creíble, sin importar lo
// que haya dicho el modelo. El caso más duro (T2) depende de esto.
function enforceConsistency(
  classification: BaselineClassification
): BaselineClassification {
  const hasConcreteSignal =
    classification.symptoms.length > 0 &&
    classification.suggested_primary_signal !== null &&
    classification.suggested_primary_signal.trim().length > 0;

  if (!hasConcreteSignal) {
    return {
      ...classification,
      has_credible_signal: false,
      suggested_primary_signal: null,
    };
  }

  return classification;
}

function extractText(data: unknown): unknown {
  if (typeof data !== "object" || data === null) return undefined;
  const candidates = (data as Record<string, unknown>).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return undefined;
  const content = (candidates[0] as Record<string, unknown>)?.content;
  if (typeof content !== "object" || content === null) return undefined;
  const parts = (content as Record<string, unknown>).parts;
  if (!Array.isArray(parts) || parts.length === 0) return undefined;
  return (parts[0] as Record<string, unknown>)?.text;
}
