import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { demoClassifySchema } from "@/lib/validation";
import { classifyBaselineSymptoms } from "@/lib/llm";

// Pública, sin sesión. No crea ni toca ningún caso — solo regresa el
// resultado de la clasificación para mostrarlo en pantalla. Protegida por
// un tope diario fijo (función senal30_try_consume_demo_quota en la base,
// no un parámetro que el cliente pueda mandar) para no agotar la cuota
// real de Gemini ni abrir la puerta a abuso.

// Ejemplo precalculado — no sale de Gemini — para cuando ya se alcanzó el
// tope del día. Se le dice así a quien lo ve, nunca se hace pasar por en
// vivo.
const QUOTA_EXCEEDED_EXAMPLE = {
  symptoms: ["nicturia", "sed excesiva"],
  has_credible_signal: true,
  suggested_primary_signal: "nicturia",
  rationale:
    "Con el tratamiento adecuado, en unas semanas debería notar que se levanta mucho menos por las noches y que esa sed constante empieza a desaparecer.",
  provider_unavailable: false,
};

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
    return NextResponse.json({
      classification: QUOTA_EXCEEDED_EXAMPLE,
      quota_exceeded: true,
      message:
        "Se alcanzó el límite de clasificaciones en vivo por hoy. Este es un resultado de ejemplo precalculado, no una respuesta en vivo del modelo.",
    });
  }

  const classification = await classifyBaselineSymptoms(parsed.data.raw_text);

  return NextResponse.json({ classification, quota_exceeded: false });
}
