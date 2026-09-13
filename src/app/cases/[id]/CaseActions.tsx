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
            El owner tiene dos caminos con este caso:
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() =>
                setOpenForm(openForm === "manufacture" ? null : "manufacture")
              }
              className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800"
            >
              Declarar una señal
            </button>
            <button
              type="button"
              onClick={() =>
                setOpenForm(openForm === "unresolved" ? null : "unresolved")
              }
              className="rounded border border-neutral-400 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-white"
            >
              Registrar como no resuelto
            </button>
          </div>

          {openForm === "manufacture" && (
            <form onSubmit={handleManufacture} className="mt-4 space-y-3">
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
                className="rounded border border-neutral-400 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-white disabled:opacity-60"
              >
                Confirmar registro sin resolver
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
