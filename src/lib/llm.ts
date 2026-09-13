import { z } from "zod";

// Único punto de contacto con el proveedor de LLM. Todo lo que esté fuera de
// este archivo solo conoce las funciones exportadas de aquí — cambiar de
// proveedor más adelante no debería tocar nada más en la app.

const MAX_INPUT_LENGTH = 2000;
const GEMINI_MODEL = "gemini-3.5-flash-lite";

function stripCodeFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
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

// Llamada genérica a Gemini pidiendo JSON estricto. Regresa `null` ante
// cualquier fallo (sin API key, red, HTTP no-ok, JSON inválido, forma
// inesperada) — nunca lanza. Cada función pública decide qué hacer con ese
// `null`, pero todas fallan hacia el lado seguro (revisión humana), nunca
// hacia asumir éxito.
async function callGemini<T>(
  systemPrompt: string,
  userText: string,
  schema: z.ZodType<T>
): Promise<T | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
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
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userText }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
          },
        }),
      }
    );
  } catch (err) {
    console.error("[llm] fetch failed", err);
    return null;
  }

  if (!response.ok) {
    console.error(
      "[llm] non-ok response",
      response.status,
      await response.text().catch(() => "")
    );
    return null;
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch (err) {
    console.error("[llm] failed to parse response body as JSON", err);
    return null;
  }

  const text = extractText(data);
  if (typeof text !== "string") {
    console.error("[llm] unexpected response shape", JSON.stringify(data));
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFences(text));
  } catch (err) {
    console.error("[llm] model output was not valid JSON", text, err);
    return null;
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    console.error(
      "[llm] model output failed schema validation",
      parsed,
      result.error
    );
    return null;
  }

  return result.data;
}

// ---------------------------------------------------------------------------
// Clasificación de línea base (commit 2 / commit 3)
// ---------------------------------------------------------------------------

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

// `provider_unavailable: true` distingue "el modelo revisó el texto y
// concluyó que no hay señal" de "el modelo no pudo responder (cuota, red,
// forma inesperada) y por eso caemos al rechazo por defecto". Ambos casos
// fallan hacia has_credible_signal: false — nunca hacia inscribir — pero la
// pantalla le debe decir a la usuaria cuál de los dos pasó.
export type ClassificationResult = BaselineClassification & {
  provider_unavailable: boolean;
};

function classificationRefusalFallback(reason: string): ClassificationResult {
  return {
    symptoms: [],
    has_credible_signal: false,
    suggested_primary_signal: null,
    rationale: reason,
    provider_unavailable: true,
  };
}

const REFUSAL_FALLBACK = classificationRefusalFallback(
  "El servicio de clasificación no está disponible en este momento. El caso se guardó marcado para revisión humana."
);

const CLASSIFICATION_SYSTEM_PROMPT = `Eres un clasificador clínico auxiliar. Recibes una descripción en texto libre, en español y en las palabras de la propia persona, de cómo se siente alguien recién diagnosticado con hiperglucemia.

Tu única tarea es identificar candidatos a "señal de retorno a 30 días": síntomas que (a) la persona describe sentir ahora mismo, y (b) son razonablemente reversibles dentro de 30 días de tratamiento. La lista cerrada de síntomas reversibles válidos es: ${REVERSIBLE_SYMPTOMS.join(", ")}.

No inventes síntomas que no estén sugeridos por el texto. Si el texto no describe ningún síntoma sentido (por ejemplo, solo menciona un resultado de laboratorio, o dice sentirse bien), o describe algo no reversible en 30 días (por ejemplo dolor articular crónico, un problema no relacionado con la glucosa), responde que no hay señal creíble.

El campo "rationale" se le va a mostrar tal cual a la persona responsable del caso como la explicación de por qué existe o no una señal — escríbelo en español sencillo y cálido, hablando de lo que la persona sentiría o no sentiría con el tratamiento en 30 días, nunca en jerga clínica ni de sistema (evita palabras como "candidato", "clasificación", "síntoma reversible", "señal creíble"). Ejemplo de tono para un caso sin síntomas: "No hay nada que ella vaya a sentir mejorar si toma el medicamento, y sí puede sentir molestias estomacales." Ejemplo de tono para un caso con síntomas: explica en una frase qué es lo que ella debería notar que mejora en 30 días si el tratamiento funciona.

Responde ÚNICAMENTE con JSON, sin texto adicional, sin explicación fuera del campo "rationale", y sin fences de markdown, con exactamente esta forma:
{"symptoms": string[], "has_credible_signal": boolean, "suggested_primary_signal": string | null, "rationale": string}`;

/**
 * Clasifica texto libre de síntomas en candidatos de señal de retorno a 30
 * días. Nunca recibe el alias del paciente ni ningún identificador — solo el
 * texto de síntomas, ya truncado a MAX_INPUT_LENGTH.
 *
 * Cualquier fallo cae en REFUSAL_FALLBACK: has_credible_signal siempre en
 * false, marcado para revisión humana, y provider_unavailable en true para
 * que la pantalla lo distinga de un "no" real del modelo.
 */
export async function classifyBaselineSymptoms(
  rawText: string
): Promise<ClassificationResult> {
  const cappedText = rawText.slice(0, MAX_INPUT_LENGTH);
  const result = await callGemini(
    CLASSIFICATION_SYSTEM_PROMPT,
    cappedText,
    classificationSchema
  );

  if (!result) {
    return REFUSAL_FALLBACK;
  }

  return enforceClassificationConsistency(result);
}

// Red de seguridad además del prompt: si no hay síntomas concretos o no hay
// señal primaria declarada, la señal no puede ser creíble, sin importar lo
// que haya dicho el modelo. El caso más duro (T2) depende de esto.
function enforceClassificationConsistency(
  classification: BaselineClassification
): ClassificationResult {
  const hasConcreteSignal =
    classification.symptoms.length > 0 &&
    classification.suggested_primary_signal !== null &&
    classification.suggested_primary_signal.trim().length > 0;

  if (!hasConcreteSignal) {
    return {
      ...classification,
      has_credible_signal: false,
      suggested_primary_signal: null,
      provider_unavailable: false,
    };
  }

  return { ...classification, provider_unavailable: false };
}

// ---------------------------------------------------------------------------
// Checkpoint de día 30 (commit 4)
// ---------------------------------------------------------------------------

const questionsSchema = z.object({
  questions: z.array(z.string()).length(3),
});

export type CheckpointQuestions = {
  questions: [string, string, string];
  provider_unavailable: boolean;
};

function fallbackQuestions(declaredSignal: string): [string, string, string] {
  return [
    `¿Cómo te has sentido en las últimas semanas respecto a esto: "${declaredSignal}"?`,
    "¿Dirías que está igual, mejor o peor que hace 30 días?",
    "¿Hay algo relacionado que hayas notado cambiar desde que empezaste el tratamiento?",
  ];
}

const QUESTIONS_SYSTEM_PROMPT = `Vas a redactar 3 preguntas breves en español sencillo, dirigidas directamente a una paciente, para revisar a los 30 días si la señal de mejora que se te da como mensaje realmente ocurrió.

Las preguntas deben poder responderse en una o dos frases, en el lenguaje cotidiano de la paciente — nunca en jerga clínica ni de sistema. No uses las palabras "señal", "tratamiento" ni "reversible".

Responde ÚNICAMENTE con JSON, sin texto adicional y sin fences de markdown, con exactamente esta forma:
{"questions": [string, string, string]}`;

/**
 * Redacta 3 preguntas de día 30 para la señal declarada de un caso. Nunca
 * recibe el alias del paciente ni ningún identificador — solo el texto de
 * la señal declarada.
 *
 * Si el proveedor falla, cae en una plantilla fija genérica en vez de
 * bloquear el checkpoint — generar preguntas no es la verificación que debe
 * fallar hacia el rechazo (esa ya pasó en la clasificación); lo que importa
 * aquí es que el checkpoint pueda seguir su curso, marcado como no generado
 * por IA.
 */
export async function generateCheckpointQuestions(
  declaredSignal: string
): Promise<CheckpointQuestions> {
  const capped = declaredSignal.slice(0, 200);
  const result = await callGemini(
    QUESTIONS_SYSTEM_PROMPT,
    capped,
    questionsSchema
  );

  if (!result) {
    return { questions: fallbackQuestions(capped), provider_unavailable: true };
  }

  const [q1, q2, q3] = result.questions;
  return { questions: [q1, q2, q3], provider_unavailable: false };
}

const verdictSchema = z.object({
  verdict: z.enum(["confirmed", "failed"]),
  rationale: z.string().default(""),
});

export type CheckpointComparison = {
  verdict: "confirmed" | "failed" | null;
  rationale: string;
  provider_unavailable: boolean;
};

const COMPARISON_SYSTEM_PROMPT = `Vas a comparar cómo describía sentirse una paciente al inicio (línea base) contra sus respuestas 30 días después, para decidir si la señal de mejora esperada realmente ocurrió.

Te llega un mensaje de texto plano con esta forma:
LINEA BASE: <texto>
SEÑAL ESPERADA: <texto>
RESPUESTA 1: <texto>
RESPUESTA 2: <texto>
RESPUESTA 3: <texto>

Si las respuestas muestran una mejora clara relacionada con la señal esperada, "verdict" es "confirmed". Si muestran que sigue igual, que empeoró, o si la mejora que describen no tiene relación clara con la señal esperada, "verdict" es "failed". Ante la duda, usa "failed" — nunca asumas una mejora que no está claramente descrita en las respuestas.

El campo "rationale" se le muestra a la persona responsable del caso: explica en español sencillo, en una o dos frases, por qué llegaste a ese veredicto, comparando lo que decía antes contra lo que dice ahora. Nunca en jerga clínica ni de sistema.

Responde ÚNICAMENTE con JSON, sin texto adicional y sin fences de markdown, con exactamente esta forma:
{"verdict": "confirmed" | "failed", "rationale": string}`;

/**
 * Compara la línea base contra las 3 respuestas de día 30 y decide
 * confirmed | failed. Nunca recibe el alias del paciente ni ningún
 * identificador — solo el texto de línea base, la señal declarada, y las
 * respuestas.
 *
 * Si el proveedor falla, `verdict` queda en null (no confirmed, no
 * failed) — fallar hacia "sin veredicto, pendiente de revisión humana",
 * nunca hacia inventar uno. Commit 5 decide qué hacer con un checkpoint
 * sin verdict.
 */
export async function compareCheckpointToBaseline(
  baselineText: string,
  declaredSignal: string,
  answers: [string, string, string]
): Promise<CheckpointComparison> {
  const userText = [
    `LINEA BASE: ${baselineText.slice(0, MAX_INPUT_LENGTH)}`,
    `SEÑAL ESPERADA: ${declaredSignal.slice(0, 200)}`,
    `RESPUESTA 1: ${answers[0].slice(0, 500)}`,
    `RESPUESTA 2: ${answers[1].slice(0, 500)}`,
    `RESPUESTA 3: ${answers[2].slice(0, 500)}`,
  ].join("\n");

  const result = await callGemini(
    COMPARISON_SYSTEM_PROMPT,
    userText,
    verdictSchema
  );

  if (!result) {
    return {
      verdict: null,
      rationale:
        "El servicio de comparación no está disponible en este momento. Este checkpoint quedó pendiente de revisión humana.",
      provider_unavailable: true,
    };
  }

  return {
    verdict: result.verdict,
    rationale: result.rationale,
    provider_unavailable: false,
  };
}
