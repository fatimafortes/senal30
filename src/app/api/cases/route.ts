import { NextResponse } from "next/server";
import type { PostgrestError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { caseIntakeSchema } from "@/lib/validation";
import { classifyBaselineSymptoms } from "@/lib/llm";

// Traduce errores de Postgres a algo que la usuaria pueda actuar, sin
// filtrar detalles internos de la base. El error completo siempre queda en
// los logs del servidor para diagnóstico.
function friendlyDbError(error: PostgrestError): string {
  switch (error.code) {
    case "23514": // check constraint (incluye enums mal formados)
    case "22P02": // invalid input syntax (enum/uuid/fecha)
      return "Uno de los campos tiene un valor que la base de datos no acepta. Revisa el tipo de detección y el estatus de asequibilidad.";
    case "23502": // not null violation
      return "Falta un campo obligatorio.";
    case "42501": // insufficient privilege (RLS)
      return "No tienes permiso para guardar este caso con tu sesión actual. Vuelve a iniciar sesión e intenta de nuevo.";
    case "42703": // undefined column — normalmente una migración pendiente
      return "La base de datos no tiene una columna que la app espera. Puede faltar correr una migración pendiente.";
    default:
      return "No se pudo guardar en la base de datos. Tu información no se perdió — intenta de nuevo en un momento.";
  }
}

export async function POST(request: Request) {
  try {
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
      const firstIssue = parsed.error.issues[0];
      const fieldLabel = firstIssue?.path?.[0]
        ? String(firstIssue.path[0])
        : "un campo";
      return NextResponse.json(
        {
          error: `Revisa "${fieldLabel}": ${firstIssue?.message ?? "valor inválido"}.`,
          issues: parsed.error.flatten(),
        },
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
    // otro identificador del caso. Si el proveedor falla (cuota, red, forma
    // inesperada) esto NUNCA lanza: cae a un rechazo marcado como tal, y el
    // caso se guarda de todas formas — fallar hacia el rechazo, nunca hacia
    // perder el caso.
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
      console.error("[api/cases] insert into senal30_cases failed", caseError);
      return NextResponse.json(
        {
          error: caseError
            ? friendlyDbError(caseError)
            : "No se pudo crear el caso.",
        },
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
        ai_labeled: !classification.provider_unavailable,
      });

    if (baselineError) {
      console.error(
        "[api/cases] insert into senal30_baselines failed",
        baselineError
      );
      return NextResponse.json(
        { error: friendlyDbError(baselineError) },
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
        actor: classification.provider_unavailable
          ? "system"
          : "ai_classifier",
        payload: classification,
      },
    ]);

    return NextResponse.json(
      {
        id: caseId,
        classification_unavailable: classification.provider_unavailable,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[api/cases] unhandled error", err);
    return NextResponse.json(
      {
        error:
          "Ocurrió un error inesperado. Tu información no se perdió — intenta de nuevo.",
      },
      { status: 500 }
    );
  }
}
