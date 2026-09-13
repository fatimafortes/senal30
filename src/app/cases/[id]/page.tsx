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

  const { data: caseRow, error: caseError } = await supabase
    .from("senal30_cases")
    .select(
      "id, patient_alias, detection_type, detection_value, detected_at, affordability_status, signal_status, is_seed, created_at"
    )
    .eq("id", id)
    .single();

  // PGRST116 = "no rows" (single() strictness) — un 404 real. Cualquier
  // otro error (tabla inexistente, RLS, etc.) es un problema de la base,
  // no un caso que no existe, y no se debe disfrazar de 404.
  if (caseError && caseError.code !== "PGRST116") {
    console.error("[cases/id] failed to load senal30_cases", caseError);
    return (
      <main className="min-h-screen bg-stone-100 px-6 py-10 text-neutral-900">
        <div className="mx-auto max-w-2xl rounded border border-red-300 bg-red-50 p-6 text-sm text-red-800">
          No se pudo cargar este caso. Puede que falte correr una migración
          pendiente en la base de datos — revisa los logs del servidor.
        </div>
      </main>
    );
  }

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

  const classificationEvent = auditLog?.find(
    (e) => e.event === "baseline_classified"
  );
  const classificationPayload = classificationEvent?.payload as {
    rationale?: string;
    provider_unavailable?: boolean;
  } | null;
  const rationale = classificationPayload?.rationale ?? "";
  const providerWasUnavailable =
    classificationPayload?.provider_unavailable === true;
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
    <main className="min-h-screen bg-stone-100 px-6 py-10 text-neutral-900">
      <div className="mx-auto max-w-2xl">
        <div className="rounded border border-neutral-300 bg-white">
          <div className="flex items-center justify-between border-b border-neutral-300 px-5 py-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
              SEÑAL 30 · caso
            </p>
            <Link
              href="/cases"
              className="text-xs text-neutral-500 underline hover:text-neutral-800"
            >
              ← Casos
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
            {caseRow.is_seed && (
              <span className="mt-1 inline-block rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sky-700">
                Datos inventados — caso de demostración
              </span>
            )}
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
                rationale={rationale}
                rawText={baseline?.raw_text ?? ""}
                symptomCount={symptomCount}
                aiGenerated={
                  (baseline?.ai_labeled ?? true) && !providerWasUnavailable
                }
                providerUnavailable={providerWasUnavailable}
              />
            )}

            {caseRow.signal_status === "available" && (
              <div className="mt-6 rounded border border-emerald-700 bg-emerald-50 p-5">
                <h2 className="text-lg font-bold text-emerald-800">
                  Señal de retorno disponible
                </h2>
                <p className="mt-2 text-sm text-emerald-900">
                  Señal declarada: <strong>{baseline?.declared_signal}</strong>
                </p>
                {baseline?.ai_labeled && (
                  <div className="mt-3">
                    <AiDisclosure />
                  </div>
                )}
              </div>
            )}

            {caseRow.signal_status === "manufactured" && (
              <div className="mt-6 rounded border border-amber-600 bg-amber-50 p-5">
                <h2 className="text-lg font-bold text-amber-800">
                  Señal manufacturada por ti
                </h2>
                <p className="mt-2 text-sm text-amber-900">
                  Señal declarada:{" "}
                  <strong>
                    {String(
                      (
                        manufactureEvent?.payload as {
                          declared_signal?: string;
                        }
                      )?.declared_signal ?? ""
                    )}
                  </strong>
                </p>
                <p className="mt-2 text-sm text-neutral-700">
                  Justificación:{" "}
                  {String(
                    (manufactureEvent?.payload as { justification?: string })
                      ?.justification ?? ""
                  )}
                </p>
              </div>
            )}

            {caseRow.signal_status === "unresolved" && (
              <div className="mt-6 rounded border border-neutral-300 bg-neutral-50 p-5">
                <h2 className="text-lg font-bold text-neutral-800">
                  Caso registrado como no resuelto
                </h2>
                {Boolean(
                  (unresolvedEvent?.payload as { note?: string })?.note
                ) && (
                  <p className="mt-2 text-sm text-neutral-700">
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

function RefusalCard({
  rationale,
  rawText,
  symptomCount,
  aiGenerated,
  providerUnavailable,
}: {
  rationale: string;
  rawText: string;
  symptomCount: number;
  aiGenerated: boolean;
  providerUnavailable: boolean;
}) {
  return (
    <div className="mt-6 rounded border-2 border-amber-700 bg-amber-50 p-6">
      <h2 className="text-2xl font-bold text-amber-900">
        Sin señal de retorno creíble
      </h2>
      <p className="mt-1 text-base font-medium text-amber-800">
        Este caso no se puede inscribir.
      </p>

      <hr className="my-4 border-amber-200" />

      {providerUnavailable ? (
        <p className="text-sm text-amber-900">
          El servicio de clasificación no está disponible en este momento.
          Este caso quedó marcado para revisión humana mientras tanto — no se
          perdió, y no se puede inscribir hasta que alguien lo revise.
        </p>
      ) : (
        rationale && <p className="text-sm text-amber-900">{rationale}</p>
      )}

      {rawText && (
        <div className="mt-4 rounded border border-amber-200 bg-white p-3">
          <p className="text-xs uppercase tracking-wide text-amber-700">
            Lo que dijo la paciente cuando le preguntaron cómo se siente
          </p>
          <p className="mt-1 text-sm italic text-neutral-800">
            &ldquo;{rawText}&rdquo;
          </p>
        </div>
      )}

      <div className="mt-4 flex gap-6 text-sm text-amber-800">
        <span>Síntomas reversibles en 30 días: {symptomCount}</span>
      </div>

      {aiGenerated && (
        <div className="mt-4">
          <AiDisclosure />
        </div>
      )}
    </div>
  );
}
