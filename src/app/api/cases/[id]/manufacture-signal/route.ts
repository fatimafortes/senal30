import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { manufactureSignalSchema } from "@/lib/validation";

// Uno de los dos únicos caminos que tiene el owner cuando no hay señal
// creíble. Requiere justificación en texto — nunca deja el caso como
// "available" (eso solo lo puede fijar la clasificación en la intake).
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

  const parsed = manufactureSignalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { data: caseRow, error } = await supabase
    .from("senal30_cases")
    .select("id, signal_status")
    .eq("id", id)
    .single();

  if (error || !caseRow) {
    return NextResponse.json({ error: "Caso no encontrado." }, { status: 404 });
  }

  if (caseRow.signal_status !== "no_credible_signal") {
    return NextResponse.json(
      { error: "Este caso ya fue resuelto o sí tiene señal creíble." },
      { status: 409 }
    );
  }

  const { error: updateError } = await supabase
    .from("senal30_cases")
    .update({ signal_status: "manufactured" })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json(
      { error: "No se pudo actualizar el caso." },
      { status: 500 }
    );
  }

  await supabase.from("senal30_audit_log").insert({
    case_id: id,
    event: "signal_manufactured",
    actor: user.id,
    payload: parsed.data,
  });

  return NextResponse.json({ ok: true });
}
