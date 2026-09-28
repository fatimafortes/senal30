import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  RefusalCard,
  AvailableCard,
  ManufacturedCard,
  UnresolvedCard,
  ConfirmedVerdictCard,
} from "@/components/CaseStatusCards";

// Pública, sin sesión, de solo lectura. A propósito NO importa
// CaseActions ni CheckpointSection (los componentes que sí saben hacer
// POST) — los botones de aquí abajo son <button disabled> sin onClick ni
// <form>, así que no hay ningún camino de escritura compilado en esta
// pantalla, ni oculto ni deshabilitado-pero-alcanzable.

const AFFORDABILITY_LABELS: Record<string, string> = {
  covered: "Cubierto",
  lower_cost: "Costo reducido",
  funded: "Financiado",
  unresolved: "Financieramente no resuelto",
};

export default async function DemoCaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: caseRow } = await supabase
    .from("senal30_cases")
    .select(
      "id, patient_alias, detection_type, detection_value, detected_at, affordability_status, signal_status"
    )
    .eq("id", id)
    .eq("is_seed", true) // defensa adicional a la política RLS, no solo confianza en ella
    .maybeSingle();

  if (!caseRow) {
    notFound();
  }

  const { data: baseline } = await supabase
    .from("senal30_baselines")
    .select(
      "raw_text, classified_symptoms, declared_signal, has_credible_signal, ai_labeled"
    )
    .eq("case_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: auditLog } = await supabase
    .from("senal30_audit_log")
    .select("event, actor, payload, created_at")
    .eq("case_id", id)
    .order("created_at", { ascending: true });

  const classificationPayload = auditLog?.find(
    (e) => e.event === "baseline_classified"
  )?.payload as { rationale?: string } | null;
  const manufactureEvent = auditLog?.find(
    (e) => e.event === "signal_manufactured"
  );
  const unresolvedEvent = auditLog?.find(
    (e) => e.event === "marked_unresolved"
  );

  const { data: checkpoint } = await supabase
    .from("senal30_checkpoints")
    .select("verdict, ai_rationale, confirmed_by_owner_id, confirmed_at")
    .eq("case_id", id)
    .eq("day", 30)
    .maybeSingle();

  const symptomCount = Array.isArray(baseline?.classified_symptoms)
    ? baseline.classified_symptoms.length
    : 0;

  return (
    <main className="min-h-screen bg-stone-100 px-6 py-10 text-neutral-900">
      <div className="mx-auto max-w-2xl">
        <div className="rounded border-2 border-amber-700 bg-amber-50 px-5 py-3 text-sm font-medium text-amber-900">
          Demostración pública de solo lectura. Todos los datos son
          ficticios. El producto completo requiere cuenta.
        </div>

        <div className="mt-4 rounded border border-neutral-300 bg-white">
          <div className="flex items-center justify-between border-b border-neutral-300 px-5 py-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
              SEÑAL 30 · demostración
            </p>
            <Link
              href="/demo"
              className="text-xs text-neutral-500 underline hover:text-neutral-800"
            >
              ← Casos de demostración
            </Link>
          </div>

          <div className="px-5 py-4">
            <div className="flex items-baseline justify-between">
              <h1 className="text-lg font-semibold tracking-tight">
                {caseRow.patient_alias}
              </h1>
              <span className="text-xs text-neutral-500">
                {caseRow.detected_at}
              </span>
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {caseRow.detection_value}{" "}
              <span className="text-sm font-normal text-neutral-500">
                {caseRow.detection_type}
              </span>
            </p>
            <p className="mt-1 text-sm text-neutral-500">
              Costo del siguiente paso:{" "}
              {AFFORDABILITY_LABELS[caseRow.affordability_status]}
            </p>

            {caseRow.signal_status === "no_credible_signal" && (
              <RefusalCard
                rationale={classificationPayload?.rationale ?? ""}
                rawText={baseline?.raw_text ?? ""}
                symptomCount={symptomCount}
                aiGenerated={false}
                providerUnavailable={false}
              />
            )}

            {caseRow.signal_status === "available" && (
              <AvailableCard
                declaredSignal={baseline?.declared_signal}
                showAiDisclosure={false}
              />
            )}

            {caseRow.signal_status === "manufactured" && (
              <ManufacturedCard
                heading="Señal manufacturada por la responsable de caso"
                declaredSignal={String(
                  (manufactureEvent?.payload as { declared_signal?: string })
                    ?.declared_signal ?? ""
                )}
                justification={String(
                  (manufactureEvent?.payload as { justification?: string })
                    ?.justification ?? ""
                )}
              />
            )}

            {caseRow.signal_status === "unresolved" && (
              <UnresolvedCard
                note={
                  (unresolvedEvent?.payload as { note?: string })?.note ?? null
                }
              />
            )}

            {checkpoint?.verdict && (
              <>
                <p className="mt-6 text-xs font-semibold uppercase tracking-widest text-neutral-500">
                  Checkpoint de día 30
                </p>
                <ConfirmedVerdictCard
                  verdict={checkpoint.verdict}
                  rationale={checkpoint.ai_rationale}
                  confirmedAt={checkpoint.confirmed_at}
                  wasOverridden={false}
                  overrideOriginalVerdict={null}
                  overrideReason={null}
                  showAiDisclosure={false}
                  correctedByLabel="la responsable de caso"
                />
              </>
            )}

            <IllustrativeActions signalStatus={caseRow.signal_status} />
          </div>

          {auditLog && auditLog.length > 0 && (
            <div className="border-t border-neutral-200 px-5 py-4">
              <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                Bitácora
              </h2>
              <ul className="mt-2 space-y-1 text-xs text-neutral-500">
                {auditLog.map((e, i) => (
                  <li key={i}>
                    {new Date(e.created_at).toLocaleString("es-MX")} —{" "}
                    {e.event}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

// Botones deshabilitados, sin onClick ni <form> — puramente ilustrativos.
// No es un componente cliente: no hay JS que los pueda conectar a nada.
function IllustrativeActions({ signalStatus }: { signalStatus: string }) {
  return (
    <div className="mt-6 border-t border-neutral-200 pt-4">
      <p className="mb-3 text-xs text-neutral-500">
        Los botones de abajo son solo ilustrativos en esta demostración — no
        hacen nada. El producto completo requiere cuenta.
      </p>
      {signalStatus === "no_credible_signal" ? (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded bg-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-500"
          >
            Declarar señal manufacturada
          </button>
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded bg-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-500"
          >
            Cerrar como sin señal
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded bg-neutral-300 px-4 py-2 text-sm font-medium text-neutral-500"
        >
          Inscribir caso
        </button>
      )}
    </div>
  );
}
