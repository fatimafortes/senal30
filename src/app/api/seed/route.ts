import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SEED_CASES } from "@/lib/seed-data";

// Carga los casos de demostración (datos inventados, sin llamar a Gemini)
// para el usuario que la ejecuta. Idempotente: si este owner ya tiene casos
// de demo, no vuelve a insertarlos.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { count } = await supabase
    .from("senal30_cases")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id)
    .eq("is_seed", true);

  if (count && count > 0) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  let created = 0;
  for (const seed of SEED_CASES) {
    const signalStatus = seed.classification.has_credible_signal
      ? "available"
      : (seed.resolution?.type ?? "no_credible_signal");

    const { data: createdCase, error: caseError } = await supabase
      .from("senal30_cases")
      .insert({
        owner_id: user.id,
        patient_alias: seed.patient_alias,
        detection_type: seed.detection_type,
        detection_value: seed.detection_value,
        detected_at: seed.detected_at,
        affordability_status: seed.affordability_status,
        signal_status: signalStatus,
        is_seed: true,
      })
      .select("id")
      .single();

    if (caseError || !createdCase) continue;
    const caseId = createdCase.id as string;

    await supabase.from("senal30_baselines").insert({
      case_id: caseId,
      raw_text: seed.raw_text,
      classified_symptoms: seed.classification.symptoms,
      declared_signal: seed.classification.has_credible_signal
        ? seed.classification.suggested_primary_signal
        : null,
      has_credible_signal: seed.classification.has_credible_signal,
      ai_labeled: false,
    });

    const auditRows: {
      case_id: string;
      event: string;
      actor: string;
      payload: Record<string, unknown>;
    }[] = [
      {
        case_id: caseId,
        event: "case_created",
        actor: "seed_data",
        payload: { seed: true },
      },
      {
        case_id: caseId,
        event: "baseline_classified",
        actor: "seed_data",
        payload: seed.classification,
      },
    ];

    if (seed.resolution?.type === "manufactured") {
      auditRows.push({
        case_id: caseId,
        event: "signal_manufactured",
        actor: "seed_data",
        payload: {
          declared_signal: seed.resolution.declared_signal,
          justification: seed.resolution.justification,
        },
      });
    } else if (seed.resolution?.type === "unresolved") {
      auditRows.push({
        case_id: caseId,
        event: "marked_unresolved",
        actor: "seed_data",
        payload: { note: seed.resolution.note },
      });
    }

    await supabase.from("senal30_audit_log").insert(auditRows);
    created += 1;
  }

  return NextResponse.json({ ok: true, created });
}
