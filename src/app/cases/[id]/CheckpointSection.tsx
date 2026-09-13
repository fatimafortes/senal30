"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AiDisclosure } from "@/components/AiDisclosure";
import { VERDICTS } from "@/lib/validation";

type Verdict = "confirmed" | "failed" | "not_scalable";

type Checkpoint = {
  verdict: Verdict | null;
  ai_rationale: string | null;
  confirmed_by_owner_id: string | null;
  confirmed_at: string | null;
  responses: {
    questions?: string[];
    answers?: string[] | null;
    questions_provider_unavailable?: boolean;
  } | null;
};

type ConfirmationEvent = {
  event: "checkpoint_confirmed" | "checkpoint_overridden";
  verdict: Verdict;
  original_verdict: Verdict | null;
  reason: string | null;
} | null;

const VERDICT_LABELS: Record<Verdict, string> = {
  confirmed: "SEÑAL CONFIRMADA",
  failed: "SEÑAL FALLÓ",
  not_scalable: "NO ESCALABLE",
};

const VERDICT_OPTION_LABELS: Record<Verdict, string> = {
  confirmed: "Confirmada — la señal mejoró",
  failed: "Falló — no hubo mejora",
  not_scalable: "No escalable — no había señal que revisar",
};

const VERDICT_STYLES: Record<Verdict, string> = {
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
  confirmationEvent,
}: {
  caseId: string;
  signalStatus: string;
  simulatedDay: number;
  checkpoint: Checkpoint | null;
  comparisonProviderUnavailable: boolean;
  confirmationEvent: ConfirmationEvent;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [correcting, setCorrecting] = useState(false);

  if (signalStatus === "no_credible_signal") {
    return null;
  }

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

  async function handleAdvance() {
    await post(`/api/cases/${caseId}/advance-day`, {});
  }

  async function handleAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await post(`/api/cases/${caseId}/checkpoint/answer`, {
      answers: [
        formData.get("answer_0"),
        formData.get("answer_1"),
        formData.get("answer_2"),
      ],
    });
  }

  async function handleConfirmAsIs(verdict: Verdict) {
    await post(`/api/cases/${caseId}/checkpoint/confirm`, { verdict });
  }

  async function handleCorrect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const ok = await post(`/api/cases/${caseId}/checkpoint/confirm`, {
      verdict: formData.get("verdict"),
      override_reason: formData.get("override_reason"),
    });
    if (ok) setCorrecting(false);
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

      {checkpoint && !checkpoint.confirmed_by_owner_id && checkpoint.verdict !== null && (
        <div
          className={`mt-3 rounded border-2 p-5 ${VERDICT_STYLES[checkpoint.verdict]}`}
        >
          <h3 className="text-xl font-bold">
            {VERDICT_LABELS[checkpoint.verdict]}
          </h3>
          {checkpoint.ai_rationale && (
            <p className="mt-2 text-sm">{checkpoint.ai_rationale}</p>
          )}
          <p className="mt-2 text-xs opacity-80">
            Borrador — pendiente de confirmación.
          </p>
          {checkpoint.verdict !== "not_scalable" &&
            !comparisonProviderUnavailable && (
              <div className="mt-3">
                <AiDisclosure />
              </div>
            )}

          {!correcting ? (
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => handleConfirmAsIs(checkpoint.verdict as Verdict)}
                disabled={busy}
                className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
              >
                Confirmar
              </button>
              <button
                type="button"
                onClick={() => setCorrecting(true)}
                className="rounded border border-neutral-400 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-white"
              >
                Corregir
              </button>
            </div>
          ) : (
            <CorrectionForm
              busy={busy}
              onSubmit={handleCorrect}
              onCancel={() => setCorrecting(false)}
            />
          )}
        </div>
      )}

      {checkpoint &&
        !checkpoint.confirmed_by_owner_id &&
        checkpoint.verdict === null &&
        checkpoint.responses?.answers && (
          <div className="mt-3 rounded border-2 border-neutral-300 bg-neutral-50 p-5">
            <h3 className="text-lg font-bold text-neutral-800">
              Sin veredicto automático
            </h3>
            <p className="mt-2 text-sm text-neutral-700">
              El servicio de comparación no estuvo disponible. No hay un
              borrador que confirmar — tienes que registrar el veredicto tú
              mismo, con tu razón.
            </p>
            <div className="mt-4">
              <CorrectionForm
                busy={busy}
                onSubmit={handleCorrect}
                onCancel={null}
              />
            </div>
          </div>
        )}

      {checkpoint?.confirmed_by_owner_id && checkpoint.verdict !== null && (
        <div
          className={`mt-3 rounded border-2 p-5 ${VERDICT_STYLES[checkpoint.verdict]}`}
        >
          <h3 className="text-xl font-bold">
            {VERDICT_LABELS[checkpoint.verdict]}
          </h3>
          {confirmationEvent?.event === "checkpoint_overridden" ? (
            <p className="mt-2 text-sm">
              Corregido por ti
              {confirmationEvent.original_verdict
                ? ` (borrador original: ${VERDICT_LABELS[confirmationEvent.original_verdict]})`
                : ""}
              . Razón: {confirmationEvent.reason}
            </p>
          ) : (
            checkpoint.ai_rationale && (
              <p className="mt-2 text-sm">{checkpoint.ai_rationale}</p>
            )
          )}
          <p className="mt-2 text-xs opacity-80">
            Confirmado
            {checkpoint.confirmed_at
              ? ` el ${new Date(checkpoint.confirmed_at).toLocaleString("es-MX")}`
              : ""}
            .
          </p>
          {/* El texto de arriba sigue siendo el que redactó el modelo si no
              se corrigió — la etiqueta no desaparece solo porque ya se
              confirmó. */}
          {confirmationEvent?.event !== "checkpoint_overridden" &&
            checkpoint.verdict !== "not_scalable" &&
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

function CorrectionForm({
  busy,
  onSubmit,
  onCancel,
}: {
  busy: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: (() => void) | null;
}) {
  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-3">
      <div>
        <label className="block text-sm font-medium text-neutral-700">
          Veredicto
        </label>
        <select
          name="verdict"
          required
          defaultValue=""
          className="mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
        >
          <option value="" disabled>
            Selecciona una opción
          </option>
          {VERDICTS.map((v) => (
            <option key={v} value={v}>
              {VERDICT_OPTION_LABELS[v]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-700">
          Razón (obligatoria)
        </label>
        <textarea
          name="override_reason"
          required
          minLength={10}
          maxLength={1000}
          rows={3}
          placeholder="Explica por qué eliges este veredicto."
          className="mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
        />
      </div>
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
        >
          Guardar
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-neutral-400 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-white"
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
