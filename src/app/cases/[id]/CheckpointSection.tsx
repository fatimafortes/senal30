"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AiDisclosure } from "@/components/AiDisclosure";

type Checkpoint = {
  verdict: "confirmed" | "failed" | "not_scalable" | null;
  ai_rationale: string | null;
  responses: {
    questions?: string[];
    answers?: string[] | null;
    questions_provider_unavailable?: boolean;
  } | null;
};

const VERDICT_LABELS: Record<string, string> = {
  confirmed: "SEÑAL CONFIRMADA",
  failed: "SEÑAL FALLÓ",
  not_scalable: "NO ESCALABLE",
};

const VERDICT_STYLES: Record<string, string> = {
  confirmed: "border-emerald-700 bg-emerald-50 text-emerald-900",
  failed: "border-red-700 bg-red-50 text-red-900",
  not_scalable: "border-neutral-300 bg-neutral-50 text-neutral-800",
};

export function CheckpointSection({
  caseId,
  signalStatus,
  simulatedDay,
  checkpoint,
  comparisonProviderUnavailable,
}: {
  caseId: string;
  signalStatus: string;
  simulatedDay: number;
  checkpoint: Checkpoint | null;
  comparisonProviderUnavailable: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (signalStatus === "no_credible_signal") {
    return null;
  }

  async function handleAdvance() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/cases/${caseId}/advance-day`, {
      method: "POST",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "No se pudo avanzar el tiempo simulado.");
      setBusy(false);
      return;
    }
    router.refresh();
    setBusy(false);
  }

  async function handleAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const formData = new FormData(event.currentTarget);
    const answers = [
      formData.get("answer_0"),
      formData.get("answer_1"),
      formData.get("answer_2"),
    ];
    const res = await fetch(`/api/cases/${caseId}/checkpoint/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "No se pudieron guardar las respuestas.");
      setBusy(false);
      return;
    }
    router.refresh();
    setBusy(false);
  }

  return (
    <div className="mt-6 border-t border-neutral-200 pt-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
        Checkpoint de día 30
      </p>

      {simulatedDay < 30 && !checkpoint && (
        <div className="mt-3">
          <button
            type="button"
            onClick={handleAdvance}
            disabled={busy}
            className="rounded border border-neutral-400 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
          >
            {busy ? "Avanzando…" : "⏩ Avanzar 30 días (simulado — herramienta de desarrollo)"}
          </button>
          <p className="mt-1 text-xs text-neutral-500">
            Salta el reloj simulado directo al día 30 y agenda este
            checkpoint. No representa el paso real del tiempo.
          </p>
        </div>
      )}

      {checkpoint?.responses?.questions && !checkpoint.responses.answers && (
        <div className="mt-3 rounded border border-neutral-300 bg-neutral-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Vista simulada de la paciente — en producción esto llegaría por
            WhatsApp
          </p>
          <form onSubmit={handleAnswer} className="mt-3 space-y-3">
            {checkpoint.responses.questions.map((q, i) => (
              <div key={i}>
                <label className="block text-sm font-medium text-neutral-700">
                  {q}
                </label>
                <input
                  name={`answer_${i}`}
                  required
                  maxLength={500}
                  className="mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
                />
              </div>
            ))}
            {!checkpoint.responses.questions_provider_unavailable && (
              <AiDisclosure />
            )}
            <button
              type="submit"
              disabled={busy}
              className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
            >
              {busy ? "Enviando…" : "Enviar respuestas (simulado)"}
            </button>
          </form>
        </div>
      )}

      {checkpoint?.verdict && (
        <div
          className={`mt-3 rounded border-2 p-5 ${VERDICT_STYLES[checkpoint.verdict]}`}
        >
          <h3 className="text-xl font-bold">
            {VERDICT_LABELS[checkpoint.verdict]}
          </h3>
          {checkpoint.ai_rationale && (
            <p className="mt-2 text-sm">{checkpoint.ai_rationale}</p>
          )}
          {checkpoint.verdict !== "not_scalable" && (
            <p className="mt-2 text-xs opacity-80">
              Borrador — pendiente de confirmación (commit 5).
            </p>
          )}
          {checkpoint.verdict !== "not_scalable" &&
            !comparisonProviderUnavailable && (
              <div className="mt-3">
                <AiDisclosure />
              </div>
            )}
        </div>
      )}

      {error && (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
