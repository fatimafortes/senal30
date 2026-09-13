import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { markUnresolvedSchema } from "@/lib/validation";

// El segundo camino cuando no hay señal creíble: registrar el caso como sin
// resolver. Tampoco deja el caso como "available".
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

  let body: unknown = {};
  const rawBody = await request.text();
  if (rawBody) {
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
    }
  }

  const parsed = markUnresolvedSchema.safeParse(body);
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
    .update({ signal_status: "unresolved" })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json(
      { error: "No se pudo actualizar el caso." },
      { status: 500 }
    );
  }

  await supabase.from("senal30_audit_log").insert({
    case_id: id,
    event: "marked_unresolved",
    actor: user.id,
    payload: parsed.data,
  });

  return NextResponse.json({ ok: true });
}
