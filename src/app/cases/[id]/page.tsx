import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AiDisclosure } from "@/components/AiDisclosure";
import { CaseActions } from "./CaseActions";

const AFFORDABILITY_LABELS: Record<string, string> = {
  covered: "Cubierto",
  lower_cost: "Costo reducido",
  funded: "Financiado",
  unresolved: "Financieramente no resuelto",
};

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: caseRow } = await supabase
    .from("senal30_cases")
    .select(
      "id, patient_alias, detection_type, detection_value, detected_at, affordability_status, signal_status, created_at"
    )
    .eq("id", id)
    .single();

  if (!caseRow) {
    notFound();
  }

  const { data: baseline } = await supabase
    .from("senal30_baselines")
    .select("raw_text, classified_symptoms, declared_signal, has_credible_signal")
    .eq("case_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: auditLog } = await supabase
    .from("senal30_audit_log")
    .select("event, actor, payload, created_at")
    .eq("case_id", id)
    .order("created_at", { ascending: true });

  const classificationEvent = auditLog?.find(
    (e) => e.event === "baseline_classified"
  );
  const rationale =
    (classificationEvent?.payload as { rationale?: string } | null)
      ?.rationale ?? "";
  const alreadyEnrolled =
    auditLog?.some((e) => e.event === "case_enrolled") ?? false;
  const manufactureEvent = auditLog?.find(
    (e) => e.event === "signal_manufactured"
  );
  const unresolvedEvent = auditLog?.find(
    (e) => e.event === "marked_unresolved"
  );

  const symptomCount = Array.isArray(baseline?.classified_symptoms)
    ? baseline.classified_symptoms.length
    : 0;

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-10 text-neutral-100">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/cases"
          className="text-sm text-neutral-400 underline hover:text-neutral-200"
        >
          ← Casos
        </Link>

        <div className="mt-4 flex items-baseline justify-between">
          <h1 className="text-xl font-semibold tracking-tight">
            {caseRow.patient_alias}
          </h1>
          <span className="text-xs text-neutral-500">
            {caseRow.detected_at}
          </span>
        </div>
        <p className="text-sm text-neutral-400">
          {caseRow.detection_type} · {caseRow.detection_value} · costo del
          siguiente paso: {AFFORDABILITY_LABELS[caseRow.affordability_status]}
        </p>

        {caseRow.signal_status === "no_credible_signal" && (
          <RefusalCard
            rationale={rationale}
            rawText={baseline?.raw_text ?? ""}
            symptomCount={symptomCount}
          />
        )}

        {caseRow.signal_status === "available" && (
          <div className="mt-6 rounded-lg border border-emerald-900 bg-emerald-950/40 p-5">
            <h2 className="text-lg font-semibold text-emerald-300">
              Señal de retorno disponible
            </h2>
            <p className="mt-2 text-sm text-emerald-100">
              Señal declarada: <strong>{baseline?.declared_signal}</strong>
            </p>
            <div className="mt-3">
              <AiDisclosure />
            </div>
          </div>
        )}

        {caseRow.signal_status === "manufactured" && (
          <div className="mt-6 rounded-lg border border-amber-900 bg-amber-950/30 p-5">
            <h2 className="text-lg font-semibold text-amber-300">
              Señal manufacturada por el owner
            </h2>
            <p className="mt-2 text-sm text-amber-100">
              Señal declarada:{" "}
              <strong>
                {String(
                  (manufactureEvent?.payload as { declared_signal?: string })
                    ?.declared_signal ?? ""
                )}
              </strong>
            </p>
            <p className="mt-2 text-sm text-neutral-300">
              Justificación:{" "}
              {String(
                (manufactureEvent?.payload as { justification?: string })
                  ?.justification ?? ""
              )}
            </p>
          </div>
        )}

        {caseRow.signal_status === "unresolved" && (
          <div className="mt-6 rounded-lg border border-neutral-700 bg-neutral-900 p-5">
            <h2 className="text-lg font-semibold text-neutral-200">
              Caso registrado como no resuelto
            </h2>
            {Boolean(
              (unresolvedEvent?.payload as { note?: string })?.note
            ) && (
              <p className="mt-2 text-sm text-neutral-300">
                Nota:{" "}
                {String(
                  (unresolvedEvent?.payload as { note?: string })?.note
                )}
              </p>
            )}
          </div>
        )}

        <CaseActions
          caseId={caseRow.id}
          signalStatus={caseRow.signal_status}
          alreadyEnrolled={alreadyEnrolled}
        />

        {auditLog && auditLog.length > 0 && (
          <div className="mt-10 border-t border-neutral-800 pt-4">
            <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              Bitácora
            </h2>
            <ul className="mt-2 space-y-1 text-xs text-neutral-500">
              {auditLog.map((e, i) => (
                <li key={i}>
                  {new Date(e.created_at).toLocaleString("es-MX")} — {e.event}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}

function RefusalCard({
  rationale,
  rawText,
  symptomCount,
}: {
  rationale: string;
  rawText: string;
  symptomCount: number;
}) {
  return (
    <div className="mt-6 rounded-lg border-2 border-amber-600 bg-amber-950/40 p-6">
      <h2 className="text-2xl font-bold text-amber-400">
        SIN SEÑAL DE RETORNO CREÍBLE
      </h2>
      <p className="mt-1 text-base font-medium text-amber-200">
        Este caso no se puede inscribir.
      </p>

      {rationale && (
        <>
          <hr className="my-4 border-amber-800" />
          <p className="text-sm text-amber-100">{rationale}</p>
        </>
      )}

      {rawText && (
        <div className="mt-4 rounded-md bg-black/20 p-3">
          <p className="text-xs uppercase tracking-wide text-amber-300">
            Lo que dijo la paciente cuando le preguntaron cómo se siente
          </p>
          <p className="mt-1 text-sm italic text-amber-50">
            &ldquo;{rawText}&rdquo;
          </p>
        </div>
      )}

      <div className="mt-4 flex gap-6 text-sm text-amber-200">
        <span>Síntomas reversibles en 30 días: {symptomCount}</span>
      </div>

      <div className="mt-4">
        <AiDisclosure />
      </div>
    </div>
  );
}
