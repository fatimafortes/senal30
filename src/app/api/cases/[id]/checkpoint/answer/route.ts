import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkpointAnswersSchema } from "@/lib/validation";
import { compareCheckpointToBaseline } from "@/lib/llm";

// Captura las respuestas simuladas de la paciente al checkpoint de día 30
// y produce el veredicto. El veredicto queda como borrador — commit 5 es
// quien lo confirma o lo sobreescribe; esta ruta nunca cierra el caso.
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const parsed = checkpointAnswersSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Respuestas inválidas.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { data: caseRow, error: caseError } = await supabase
    .from("senal30_cases")
    .select("id, signal_status")
    .eq("id", id)
    .single();

  if (caseError || !caseRow) {
    return NextResponse.json({ error: "Caso no encontrado." }, { status: 404 });
  }

  const { data: checkpoint, error: checkpointError } = await supabase
    .from("senal30_checkpoints")
    .select("id, responses, verdict")
    .eq("case_id", id)
    .eq("day", 30)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (checkpointError || !checkpoint) {
    return NextResponse.json(
      { error: "Este caso no tiene un checkpoint de día 30 pendiente." },
      { status: 409 }
    );
  }

  const responses = checkpoint.responses as {
    questions?: string[];
    answers?: string[] | null;
  } | null;

  if (checkpoint.verdict !== null || !responses?.questions || responses.answers) {
    return NextResponse.json(
      {
        error:
          "Este checkpoint ya tiene respuestas o no tiene preguntas pendientes.",
      },
      { status: 409 }
    );
  }

  const { data: baseline } = await supabase
    .from("senal30_baselines")
    .select("raw_text, declared_signal")
    .eq("case_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const declaredSignal =
    baseline?.declared_signal ?? (await getManufacturedSignal(supabase, id));

  const answers = parsed.data.answers as [string, string, string];

  const comparison = await compareCheckpointToBaseline(
    baseline?.raw_text ?? "",
    declaredSignal ?? "",
    answers
  );

  const { error: updateError } = await supabase
    .from("senal30_checkpoints")
    .update({
      responses: { ...responses, answers },
      verdict: comparison.verdict,
      ai_rationale: comparison.rationale,
    })
    .eq("id", checkpoint.id);

  if (updateError) {
    console.error("[checkpoint/answer] update failed", updateError);
    return NextResponse.json(
      { error: "No se pudieron guardar las respuestas." },
      { status: 500 }
    );
  }

  await supabase.from("senal30_audit_log").insert({
    case_id: id,
    event: "checkpoint_compared",
    actor: comparison.provider_unavailable ? "system" : "ai_classifier",
    payload: comparison,
  });

  return NextResponse.json({ ok: true, verdict: comparison.verdict });
}

async function getManufacturedSignal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  caseId: string
): Promise<string | null> {
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
