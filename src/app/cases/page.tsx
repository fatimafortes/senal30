import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SeedButton } from "./SeedButton";
import { FictionalDataNotice } from "@/components/FictionalDataNotice";

const SIGNAL_LABELS: Record<string, string> = {
  available: "Señal disponible",
  no_credible_signal: "Sin señal",
  manufactured: "Señal manufacturada",
  unresolved: "Sin resolver",
};

// docs/PACKET.md, pantalla 1: "los casos sin señal de retorno suben al
// principio de la lista" — no es cosmético, es el producto negándose a
// enterrar sus propias fallas. Una señal que falló y sigue sin confirmar
// es la misma clase de urgencia, así que sube junto con ellos. Orden:
// (sin señal | señal falló sin confirmar) → sin resolver → manufacturada →
// disponible.
function sortPriority(signalStatus: string, isEscalation: boolean): number {
  if (signalStatus === "no_credible_signal" || isEscalation) return 0;
  if (signalStatus === "unresolved") return 1;
  if (signalStatus === "manufactured") return 2;
  return 3;
}

// "Requiere decisión" = casos donde el owner todavía tiene que actuar o
// sostener una decisión ya tomada bajo escrutinio: sin señal (nunca se
// decidió), señal manufacturada (excepción manual), y señal que falló y
// sigue sin confirmar. "Sin resolver" ya es un cierre, no una decisión
// pendiente.
function requiresDecision(signalStatus: string, isEscalation: boolean): boolean {
  return (
    signalStatus === "no_credible_signal" ||
    signalStatus === "manufactured" ||
    isEscalation
  );
}

export default async function CasesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: cases, error: casesError } = await supabase
    .from("senal30_cases")
    .select(
      "id, patient_alias, detection_type, detection_value, signal_status, is_seed, created_at"
    );

  if (casesError) {
    console.error("[cases] failed to load senal30_cases", casesError);
  }

  const { data: checkpoints, error: checkpointsError } = await supabase
    .from("senal30_checkpoints")
    .select("case_id, verdict, confirmed_by_owner_id")
    .eq("day", 30);

  if (checkpointsError) {
    console.error(
      "[cases] failed to load senal30_checkpoints",
      checkpointsError
    );
  }

  const escalatedCaseIds = new Set(
    (checkpoints ?? [])
      .filter((cp) => cp.verdict === "failed" && !cp.confirmed_by_owner_id)
      .map((cp) => cp.case_id)
  );

  const sortedCases = cases
    ? [...cases].sort((a, b) => {
        const priorityDiff =
          sortPriority(a.signal_status, escalatedCaseIds.has(a.id)) -
          sortPriority(b.signal_status, escalatedCaseIds.has(b.id));
        if (priorityDiff !== 0) return priorityDiff;
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      })
    : null;

  const pending =
    cases?.filter((c) =>
      requiresDecision(c.signal_status, escalatedCaseIds.has(c.id))
    ).length ?? 0;

  return (
    <main className="min-h-screen bg-stone-100 px-6 py-10 text-neutral-900">
      <div className="mx-auto max-w-3xl">
        <div className="rounded border border-neutral-300 bg-white">
          <div className="flex items-center justify-between border-b border-neutral-300 px-5 py-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
              SEÑAL 30 · casos abiertos
            </p>
            <p className="text-xs text-neutral-500">{user.email}</p>
          </div>

          <div className="px-5 pt-3">
            <FictionalDataNotice />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <p className="text-sm text-neutral-700">
              {cases?.length ?? 0} {(cases?.length ?? 0) === 1 ? "caso" : "casos"}
              {pending > 0 && (
                <span className="ml-2 font-medium text-amber-700">
                  {pending} {pending === 1 ? "requiere" : "requieren"} decisión
                </span>
              )}
            </p>
            <div className="flex items-center gap-3">
              <SeedButton />
              <Link
                href="/cases/new"
                className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800"
              >
                Nuevo caso
              </Link>
              <form action="/auth/signout" method="post">
                <button className="text-sm text-neutral-500 underline hover:text-neutral-800">
                  Cerrar sesión
                </button>
              </form>
            </div>
          </div>

          {casesError ? (
            <p className="px-5 py-6 text-sm text-red-700">
              No se pudieron cargar los casos. Puede que falte correr una
              migración pendiente en la base de datos — revisa los logs del
              servidor.
            </p>
          ) : !sortedCases || sortedCases.length === 0 ? (
            <p className="px-5 py-6 text-sm text-neutral-500">
              Todavía no hay casos.
            </p>
          ) : (
            <ul className="divide-y divide-neutral-200 border-t border-neutral-300">
              {sortedCases.map((c) => {
                const isEscalation = escalatedCaseIds.has(c.id);
                return (
                  <li
                    key={c.id}
                    className={`border-l-4 ${
                      isEscalation
                        ? "border-l-red-600"
                        : c.signal_status === "no_credible_signal" ||
                            c.signal_status === "manufactured"
                          ? "border-l-amber-600"
                          : "border-l-neutral-400"
                    }`}
                  >
                    <Link
                      href={`/cases/${c.id}`}
                      className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50"
                    >
                      <div>
                        <p className="text-sm font-medium text-neutral-900">
                          {c.patient_alias}
                          {c.is_seed && (
                            <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sky-700">
                              Datos inventados
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {c.detection_type} · {c.detection_value}
                        </p>
                      </div>
                      <span
                        className={`text-xs font-semibold uppercase tracking-wide ${
                          isEscalation
                            ? "text-red-700"
                            : c.signal_status === "no_credible_signal" ||
                                c.signal_status === "manufactured"
                              ? "text-amber-700"
                              : "text-neutral-600"
                        }`}
                      >
                        {isEscalation
                          ? "Señal falló — sin confirmar"
                          : (SIGNAL_LABELS[c.signal_status] ?? c.signal_status)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <p className="mt-3 text-xs text-neutral-500">
          &ldquo;Cargar casos de demostración&rdquo; agrega datos inventados,
          ya clasificados, que no consumen la cuota de la API.
        </p>
      </div>
    </main>
  );
}
