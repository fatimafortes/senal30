import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { caseIntakeSchema } from "@/lib/validation";
import { classifyBaselineSymptoms } from "@/lib/llm";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const parsed = caseIntakeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const {
    patient_alias,
    detection_type,
    detection_value,
    detected_at,
    affordability_status,
    raw_text,
  } = parsed.data;

  // Solo el texto de síntomas sale hacia el LLM — nunca el alias ni ningún
  // otro identificador del caso.
  const classification = await classifyBaselineSymptoms(raw_text);

  const { data: createdCase, error: caseError } = await supabase
    .from("senal30_cases")
    .insert({
      owner_id: user.id,
      patient_alias,
      detection_type,
      detection_value,
      detected_at,
      affordability_status,
      signal_status: classification.has_credible_signal
        ? "available"
        : "no_credible_signal",
    })
    .select("id")
    .single();

  if (caseError || !createdCase) {
    return NextResponse.json(
      { error: "No se pudo crear el caso." },
      { status: 500 }
    );
  }

  const caseId = createdCase.id as string;

  const { error: baselineError } = await supabase
    .from("senal30_baselines")
    .insert({
      case_id: caseId,
      raw_text,
      classified_symptoms: classification.symptoms,
      declared_signal: classification.has_credible_signal
        ? classification.suggested_primary_signal
        : null,
      has_credible_signal: classification.has_credible_signal,
      ai_labeled: true,
    });

  if (baselineError) {
    return NextResponse.json(
      { error: "No se pudo guardar la línea base." },
      { status: 500 }
    );
  }

  await supabase.from("senal30_audit_log").insert([
    {
      case_id: caseId,
      event: "case_created",
      actor: user.id,
      payload: { detection_type, affordability_status },
    },
    {
      case_id: caseId,
      event: "baseline_classified",
      actor: "ai_classifier",
      payload: classification,
    },
  ]);

  return NextResponse.json({ id: caseId }, { status: 201 });
}
