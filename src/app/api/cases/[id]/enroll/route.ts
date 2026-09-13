import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// La única forma de "inscribir" un caso. No existe ningún flag ni parámetro
// que la salte: si el caso no tiene signal_status = 'available', se rechaza
// sin excepción, sin importar quién o qué llame a esta ruta.
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

  const { data: caseRow, error } = await supabase
    .from("senal30_cases")
    .select("id, signal_status")
    .eq("id", id)
    .single();

  if (error || !caseRow) {
    return NextResponse.json({ error: "Caso no encontrado." }, { status: 404 });
  }

  if (caseRow.signal_status !== "available") {
    return NextResponse.json(
      {
        error:
          "SIN SEÑAL DE RETORNO CREÍBLE — no se puede inscribir este caso.",
      },
      { status: 403 }
    );
  }

  await supabase.from("senal30_audit_log").insert({
    case_id: id,
    event: "case_enrolled",
    actor: user.id,
    payload: {},
  });

  return NextResponse.json({ ok: true });
}
