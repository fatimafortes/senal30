import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SeedButton } from "./SeedButton";

const SIGNAL_LABELS: Record<string, string> = {
  available: "Señal disponible",
  no_credible_signal: "SIN SEÑAL CREÍBLE",
  manufactured: "Señal manufacturada",
  unresolved: "Sin resolver",
};

export default async function CasesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: cases } = await supabase
    .from("senal30_cases")
    .select(
      "id, patient_alias, detection_type, detection_value, signal_status, is_seed, created_at"
    )
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-10 text-neutral-100">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Casos</h1>
            <p className="text-sm text-neutral-400">{user.email}</p>
          </div>
          <div className="flex items-center gap-4">
            <SeedButton />
            <Link
              href="/cases/new"
              className="rounded-md bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-900 hover:bg-white"
            >
              Nuevo caso
            </Link>
            <form action="/auth/signout" method="post">
              <button className="text-sm text-neutral-400 underline hover:text-neutral-200">
                Cerrar sesión
              </button>
            </form>
          </div>
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          &ldquo;Cargar casos de demostración&rdquo; agrega datos inventados,
          ya clasificados, que no consumen la cuota de la API.
        </p>

        {!cases || cases.length === 0 ? (
          <p className="mt-6 text-sm text-neutral-400">
            Todavía no hay casos.
          </p>
        ) : (
          <ul className="mt-6 divide-y divide-neutral-800 rounded-md border border-neutral-800">
            {cases.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/cases/${c.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-neutral-900"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {c.patient_alias}
                      {c.is_seed && (
                        <span className="ml-2 rounded-full bg-sky-950 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sky-300">
                          Datos inventados
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-neutral-400">
                      {c.detection_type} · {c.detection_value}
                    </p>
                  </div>
                  <span
                    className={
                      "rounded-full px-2.5 py-1 text-xs font-medium " +
                      (c.signal_status === "no_credible_signal"
                        ? "bg-red-950 text-red-300"
                        : "bg-neutral-800 text-neutral-300")
                    }
                  >
                    {SIGNAL_LABELS[c.signal_status] ?? c.signal_status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
