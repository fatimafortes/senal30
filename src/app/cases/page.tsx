import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SeedButton } from "./SeedButton";

const SIGNAL_LABELS: Record<string, string> = {
  available: "Señal disponible",
  no_credible_signal: "Sin señal",
  manufactured: "Señal manufacturada",
  unresolved: "Sin resolver",
};

const SIGNAL_BAR: Record<string, string> = {
  available: "border-l-neutral-400",
  no_credible_signal: "border-l-amber-600",
  manufactured: "border-l-amber-500",
  unresolved: "border-l-neutral-400",
};

const SIGNAL_TEXT: Record<string, string> = {
  available: "text-neutral-600",
  no_credible_signal: "text-amber-700",
  manufactured: "text-amber-700",
  unresolved: "text-neutral-600",
};

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
    )
    .order("created_at", { ascending: false });

  if (casesError) {
    console.error("[cases] failed to load senal30_cases", casesError);
  }

  const pending =
    cases?.filter((c) => c.signal_status === "no_credible_signal").length ?? 0;

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

          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <p className="text-sm text-neutral-700">
              {cases?.length ?? 0} casos
              {pending > 0 && (
                <span className="ml-2 font-medium text-amber-700">
                  {pending} requieren decisión
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
          ) : !cases || cases.length === 0 ? (
            <p className="px-5 py-6 text-sm text-neutral-500">
              Todavía no hay casos.
            </p>
          ) : (
            <ul className="divide-y divide-neutral-200 border-t border-neutral-300">
              {cases.map((c) => (
                <li
                  key={c.id}
                  className={`border-l-4 ${SIGNAL_BAR[c.signal_status] ?? "border-l-neutral-300"}`}
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
                      className={`text-xs font-semibold uppercase tracking-wide ${SIGNAL_TEXT[c.signal_status] ?? "text-neutral-500"}`}
                    >
                      {SIGNAL_LABELS[c.signal_status] ?? c.signal_status}
                    </span>
                  </Link>
                </li>
              ))}
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
