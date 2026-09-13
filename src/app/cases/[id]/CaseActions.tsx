"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type SignalStatus =
  | "available"
  | "no_credible_signal"
  | "manufactured"
  | "unresolved";

export function CaseActions({
  caseId,
  signalStatus,
  alreadyEnrolled,
}: {
  caseId: string;
  signalStatus: SignalStatus;
  alreadyEnrolled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openForm, setOpenForm] = useState<"manufacture" | "unresolved" | null>(
    null
  );

  async function post(path: string, body: unknown) {
    setBusy(true);
    setError(null);
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Ocurrió un error.");
      setBusy(false);
      return false;
    }
    router.refresh();
    setBusy(false);
    return true;
  }

  async function handleEnroll() {
    // El botón solo llega a esta función cuando signalStatus === "available";
    // el servidor vuelve a verificarlo de todas formas.
    await post(`/api/cases/${caseId}/enroll`, {});
  }

  async function handleManufacture(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const ok = await post(`/api/cases/${caseId}/manufacture-signal`, {
      declared_signal: formData.get("declared_signal"),
      justification: formData.get("justification"),
    });
    if (ok) setOpenForm(null);
  }

  async function handleUnresolved(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const ok = await post(`/api/cases/${caseId}/mark-unresolved`, {
      note: formData.get("note"),
    });
    if (ok) setOpenForm(null);
  }

  const canEnroll = signalStatus === "available";

  return (
    <div className="mt-4 space-y-4">
      <div>
        <button
          type="button"
          onClick={handleEnroll}
          disabled={!canEnroll || busy || alreadyEnrolled}
          title={
            canEnroll
              ? undefined
              : "No se puede inscribir sin una señal de retorno creíble."
          }
          className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400"
        >
          {alreadyEnrolled ? "Caso inscrito" : "Inscribir caso"}
        </button>
        {!canEnroll && (
          <p className="mt-1 text-xs text-neutral-500">
            Inscribir está deshabilitado — este caso no tiene una señal de
            retorno creíble.
          </p>
        )}
      </div>

      {signalStatus === "no_credible_signal" && (
        <div className="rounded border border-neutral-300 bg-neutral-50 p-4">
          <p className="text-sm font-medium text-neutral-700">
            Este caso necesita una decisión tuya. Los dos caminos cuentan
            igual como <strong>caso resuelto</strong> — ninguno es un
            pendiente ni te descuenta del número del mes.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded border border-neutral-300 bg-white p-3">
              <p className="text-sm font-semibold text-neutral-900">
                Declarar una señal manufacturada
              </p>
              <p className="mt-1 text-xs text-neutral-600">
                Es una herramienta legítima cuando de verdad no hay otra
                forma de dar seguimiento — pero queda visible: marcada como
                &ldquo;manufacturada&rdquo; y con tu nombre en la bitácora
                del caso, no oculta ni anónima.
              </p>
              <button
                type="button"
                onClick={() =>
                  setOpenForm(openForm === "manufacture" ? null : "manufacture")
                }
                className="mt-3 w-full rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800"
              >
                Declarar señal manufacturada
              </button>
            </div>

            <div className="rounded border border-neutral-300 bg-white p-3">
              <p className="text-sm font-semibold text-neutral-900">
                Cerrar sin señal de retorno
              </p>
              <p className="mt-1 text-xs text-neutral-600">
                Documenta que este caso no tiene con qué comprobar que el
                tratamiento le está funcionando. Queda cerrado y contado
                como resuelto — es evidencia, no un caso abandonado.
              </p>
              <button
                type="button"
                onClick={() =>
                  setOpenForm(openForm === "unresolved" ? null : "unresolved")
                }
                className="mt-3 w-full rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800"
              >
                Cerrar como sin señal
              </button>
            </div>
          </div>

          {openForm === "manufacture" && (
            <form onSubmit={handleManufacture} className="mt-4 space-y-3">
              <p className="text-xs text-neutral-600">
                Se registrará como señal manufacturada, atribuida a ti.
              </p>
              <div>
                <label className="block text-sm font-medium text-neutral-700">
                  Señal declarada
                </label>
                <input
                  name="declared_signal"
                  required
                  maxLength={200}
                  placeholder="Ej. seguimiento telefónico semanal"
                  className="mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700">
                  Justificación (obligatoria)
                </label>
                <textarea
                  name="justification"
                  required
                  minLength={10}
                  maxLength={1000}
                  rows={3}
                  placeholder="Explica por qué se declara esta señal manualmente."
                  className="mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
              >
                Confirmar señal manufacturada
              </button>
            </form>
          )}

          {openForm === "unresolved" && (
            <form onSubmit={handleUnresolved} className="mt-4 space-y-3">
              <p className="text-xs text-neutral-600">
                Se registrará como caso resuelto, sin señal de retorno.
              </p>
              <div>
                <label className="block text-sm font-medium text-neutral-700">
                  Nota (opcional)
                </label>
                <textarea
                  name="note"
                  maxLength={1000}
                  rows={3}
                  placeholder="Contexto adicional, si aplica."
                  className="mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
              >
                Confirmar cierre sin señal
              </button>
            </form>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
