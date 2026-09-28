import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
// Único componente cliente de esta pantalla — la caja de clasificación en
// vivo. Llama a una API que no crea ni toca ningún caso (ver
// src/app/api/demo/classify/route.ts). Nada más en este árbol escribe.
import { DemoClassifier } from "./DemoClassifier";

// Pública, sin sesión. Solo lectura: nada en este árbol de archivos hace
// fetch de escritura ni importa un componente que pueda hacerlo — no hay
// forma de que un visitante anónimo mute nada, ni por accidente ni a
// propósito, porque el código para hacerlo no existe en este camino.

const SIGNAL_LABELS: Record<string, string> = {
  available: "Señal disponible",
  no_credible_signal: "Sin señal",
  manufactured: "Señal manufacturada",
  unresolved: "Resuelto — sin señal",
};

// Mismo criterio que /cases (docs/PACKET.md pantalla 1): sin señal sube
// al principio.
const SORT_PRIORITY: Record<string, number> = {
  no_credible_signal: 0,
  unresolved: 1,
  manufactured: 2,
  available: 3,
};

export default async function DemoListPage() {
  const supabase = await createClient();

  const { data: cases } = await supabase
    .from("senal30_cases")
    .select(
      "id, patient_alias, detection_type, detection_value, signal_status, created_at"
    )
    .eq("is_seed", true);

  const sorted = cases
    ? [...cases].sort((a, b) => {
        const diff =
          (SORT_PRIORITY[a.signal_status] ?? 99) -
          (SORT_PRIORITY[b.signal_status] ?? 99);
        if (diff !== 0) return diff;
        return (
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      })
    : [];

  return (
    <main className="min-h-screen bg-stone-100 px-6 py-10 text-neutral-900">
      <div className="mx-auto max-w-3xl">
        <div className="rounded border-2 border-amber-700 bg-amber-50 px-5 py-3 text-sm font-medium text-amber-900">
          Demostración pública de solo lectura. Todos los datos son
          ficticios. El producto completo requiere cuenta.
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
            SEÑAL 30 · demostración
          </p>
          <Link
            href="/login"
            className="text-xs text-neutral-500 underline hover:text-neutral-800"
          >
            Iniciar sesión →
          </Link>
        </div>

        <div className="mt-3 rounded border border-neutral-300 bg-white">
          {sorted.length === 0 ? (
            <p className="px-5 py-6 text-sm text-neutral-500">
              No hay casos de demostración cargados todavía.
            </p>
          ) : (
            <ul className="divide-y divide-neutral-200">
              {sorted.map((c) => (
                <li
                  key={c.id}
                  className={`border-l-4 ${
                    c.signal_status === "no_credible_signal" ||
                    c.signal_status === "manufactured"
                      ? "border-l-amber-600"
                      : "border-l-neutral-400"
                  }`}
                >
                  <Link
                    href={`/demo/${c.id}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50"
                  >
                    <div>
                      <p className="text-sm font-medium text-neutral-900">
                        {c.patient_alias}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {c.detection_type} · {c.detection_value}
                      </p>
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
                      {SIGNAL_LABELS[c.signal_status] ?? c.signal_status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DemoClassifier />
      </div>
    </main>
  );
}
