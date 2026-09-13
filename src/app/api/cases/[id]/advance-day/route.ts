import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateCheckpointQuestions } from "@/lib/llm";

// Herramienta de desarrollo, etiquetada en pantalla: salta simulated_day
// directo a 30 y agenda el checkpoint correspondiente. Solo aplica a casos
// ya resueltos (no a los que siguen sin señal creíble sin decisión) y solo
// una vez por caso.
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { data: caseRow, error: caseError } = await supabase
    .from("senal30_cases")
    .select("id, signal_status, simulated_day")
    .eq("id", id)
    .single();

  if (caseError || !caseRow) {
    return NextResponse.json({ error: "Caso no encontrado." }, { status: 404 });
  }

  if (caseRow.signal_status === "no_credible_signal") {
    return NextResponse.json(
      {
        error:
          "Este caso todavía no tiene una decisión — declara una señal o regístralo como no resuelto antes de avanzar el tiempo.",
      },
      { status: 409 }
    );
  }

  if (caseRow.simulated_day >= 30) {
    return NextResponse.json(
      { error: "Este caso ya llegó al día 30." },
      { status: 409 }
    );
  }

  const declaredSignal = await getDeclaredSignal(supabase, id, caseRow.signal_status);

  const { error: updateError } = await supabase
    .from("senal30_cases")
    .update({ simulated_day: 30 })
    .eq("id", id);

  if (updateError) {
    console.error("[advance-day] failed to update simulated_day", updateError);
    return NextResponse.json(
      { error: "No se pudo avanzar el tiempo simulado." },
      { status: 500 }
    );
  }

  if (declaredSignal) {
    const { questions, provider_unavailable } =
      await generateCheckpointQuestions(declaredSignal);

    await supabase.from("senal30_checkpoints").insert({
      case_id: id,
      day: 30,
      responses: {
        questions,
        answers: null,
        questions_provider_unavailable: provider_unavailable,
      },
      verdict: null,
      ai_rationale: null,
    });
  } else {
    // Nunca se declaró una señal (caso "no resuelto") — no hay nada que
    // preguntar ni comparar. Esto no lo dice un modelo, es el sistema
    // reconociendo que no tiene con qué evaluar el caso.
    await supabase.from("senal30_checkpoints").insert({
      case_id: id,
      day: 30,
      responses: null,
      verdict: "not_scalable",
      ai_rationale:
        "Nunca se declaró una señal de retorno para este caso, así que no hay nada que comparar a los 30 días.",
    });
  }

  await supabase.from("senal30_audit_log").insert({
    case_id: id,
    event: "day_30_reached",
    actor: user.id,
    payload: { declared_signal: declaredSignal },
  });

  return NextResponse.json({ ok: true });
}

async function getDeclaredSignal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  caseId: string,
  signalStatus: string
): Promise<string | null> {
  if (signalStatus === "available") {
    const { data } = await supabase
      .from("senal30_baselines")
      .select("declared_signal")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data?.declared_signal ?? null;
  }

  if (signalStatus === "manufactured") {
    const { data } = await supabase
      .from("senal30_audit_log")
      .select("payload")
      .eq("case_id", caseId)
      .eq("event", "signal_manufactured")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const payload = data?.payload as { declared_signal?: string } | null;
    return payload?.declared_signal ?? null;
  }

  return null;
}
