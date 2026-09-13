import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkpointConfirmSchema } from "@/lib/validation";

// La única forma de que un veredicto de día 30 sea final. La IA (o el
// sistema, para not_scalable) solo redacta un borrador; esta ruta es la
// confirmación humana de la Condición 2. Un trigger en la base
// (0003_senal30_protect_checkpoint_confirmation.sql) hace lo mismo a nivel
// de datos, por si alguien intenta escribir directo a Supabase sin pasar
// por aquí.
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

  const parsed = checkpointConfirmSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { data: checkpoint, error: checkpointError } = await supabase
    .from("senal30_checkpoints")
    .select("id, verdict, confirmed_by_owner_id")
    .eq("case_id", id)
    .eq("day", 30)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (checkpointError || !checkpoint) {
    return NextResponse.json(
      { error: "Este caso no tiene un checkpoint de día 30." },
      { status: 404 }
    );
  }

  if (checkpoint.confirmed_by_owner_id) {
    return NextResponse.json(
      { error: "Este veredicto ya fue confirmado y no se puede modificar." },
      { status: 409 }
    );
  }

  // Es una corrección si no había veredicto (nada que confirmar tal cual)
  // o si se eligió uno distinto al que ya estaba. En ambos casos la razón
  // es obligatoria.
  const isOverride =
    checkpoint.verdict === null || checkpoint.verdict !== parsed.data.verdict;

  if (isOverride && (!parsed.data.override_reason || parsed.data.override_reason.length < 10)) {
    return NextResponse.json(
      {
        error:
          "Para corregir el veredicto necesitas explicar por qué, con al menos 10 caracteres.",
      },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("senal30_checkpoints")
    .update({
      verdict: parsed.data.verdict,
      confirmed_by_owner_id: user.id,
      confirmed_at: now,
    })
    .eq("id", checkpoint.id);

  if (updateError) {
    console.error("[checkpoint/confirm] update failed", updateError);
    return NextResponse.json(
      { error: "No se pudo guardar la confirmación." },
      { status: 500 }
    );
  }

  await supabase.from("senal30_audit_log").insert({
    case_id: id,
    event: isOverride ? "checkpoint_overridden" : "checkpoint_confirmed",
    actor: user.id,
    payload: {
      verdict: parsed.data.verdict,
      original_verdict: checkpoint.verdict,
      reason: parsed.data.override_reason ?? null,
    },
  });

  return NextResponse.json({ ok: true });
}
