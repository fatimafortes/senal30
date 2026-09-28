import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { demoClassifySchema } from "@/lib/validation";
import { classifyBaselineSymptoms } from "@/lib/llm";

// Pública, sin sesión. No crea ni toca ningún caso — solo regresa el
// resultado de la clasificación para mostrarlo en pantalla. Protegida por
// un tope diario fijo (función senal30_try_consume_demo_quota en la base,
// no un parámetro que el cliente pueda mandar) para no agotar la cuota
// real de Gemini ni abrir la puerta a abuso.
//
// Gemini responde en 8-20s bajo carga y a veces regresa 503 "high demand"
// — confirmado en producción, no es cuota agotada ni falta de API key.
// Este límite le da margen a la función antes de que Vercel la mate por
// timeout.
export const maxDuration = 30;

// Ejemplos precalculados — no salen de Gemini — para cuando el servicio
// en vivo no está disponible (cuota diaria propia agotada, o Gemini
// mismo fallando/con 503). Se le dice así a quien lo ve; nunca se hacen
// pasar por una respuesta en vivo. Emparejados con los dos botones de
// ejemplo de la UI para que, si alguien usa uno de esos dos textos
// exactos, vea el resultado que le corresponde en vez de uno genérico.
const FALLBACK_EXAMPLES: Record<
  string,
  {
    symptoms: string[];
    has_credible_signal: boolean;
    suggested_primary_signal: string | null;
    rationale: string;
  }
> = {
  "Me levanto varias veces en la noche a orinar y tengo mucha sed todo el día.":
    {
      symptoms: ["nicturia", "sed excesiva"],
      has_credible_signal: true,
      suggested_primary_signal: "nicturia",
      rationale:
        "Con el tratamiento adecuado, en unas semanas debería notar que se levanta mucho menos por las noches y que esa sed constante empieza a desaparecer.",
    },
  "Me siento bien, nomás me salió alta el azúcar.": {
    symptoms: [],
    has_credible_signal: false,
    suggested_primary_signal: null,
    rationale:
      "Como se siente bien y no tiene molestias ahora, no hay nada específico que vaya a notar mejorar en 30 días con el tratamiento.",
  },
};

const DEFAULT_FALLBACK_EXAMPLE =
  FALLBACK_EXAMPLES[
    "Me levanto varias veces en la noche a orinar y tengo mucha sed todo el día."
  ];

function fallbackResponse(message: string, rawText: string) {
  const example = FALLBACK_EXAMPLES[rawText.trim()] ?? DEFAULT_FALLBACK_EXAMPLE;
  return NextResponse.json({
    classification: { ...example, provider_unavailable: false },
    live: false,
    message,
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const parsed = demoClassifySchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return NextResponse.json(
      { error: firstIssue?.message ?? "Texto inválido." },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data: withinQuota, error: quotaError } = await supabase.rpc(
    "senal30_try_consume_demo_quota"
  );

  if (quotaError) {
    console.error("[demo/classify] quota RPC failed", quotaError);
  }

  if (quotaError || !withinQuota) {
    return fallbackResponse(
      "Se alcanzó el límite de clasificaciones en vivo por hoy. Este es un resultado de ejemplo precalculado — no se guarda ningún caso en la demostración, en vivo o de ejemplo.",
      parsed.data.raw_text
    );
  }

  const classification = await classifyBaselineSymptoms(parsed.data.raw_text);

  if (classification.provider_unavailable) {
    return fallbackResponse(
      "El servicio de clasificación en vivo no está disponible en este momento (Gemini está saturado). Este es un resultado de ejemplo precalculado, no una respuesta en vivo — no se guarda ningún caso en la demostración de todas formas.",
      parsed.data.raw_text
    );
  }

  return NextResponse.json({ classification, live: true });
}
