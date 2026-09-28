"use client";

import { useState } from "react";
import { AiDisclosure } from "@/components/AiDisclosure";

type ClassificationResult = {
  symptoms: string[];
  has_credible_signal: boolean;
  suggested_primary_signal: string | null;
  rationale: string;
};

const EXAMPLES = {
  with_symptoms:
    "Me levanto varias veces en la noche a orinar y tengo mucha sed todo el día.",
  without_symptoms: "Me siento bien, nomás me salió alta el azúcar.",
};

// No crea ningún caso ni escribe en la base — solo llama a
// /api/demo/classify y muestra el resultado. Esa ruta nunca toca
// senal30_cases/baselines/audit_log, solo un contador de uso diario.
export function DemoClassifier() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ClassificationResult | null>(null);
  const [isLive, setIsLive] = useState(true);
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);

  async function handleClassify() {
    setBusy(true);
    setError(null);
    setResult(null);
    setFallbackMessage(null);

    const res = await fetch("/api/demo/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw_text: text }),
    });
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      setError(data?.error ?? "Ocurrió un error.");
      setBusy(false);
      return;
    }

    setResult(data.classification);
    setIsLive(Boolean(data.live));
    setFallbackMessage(data.message ?? null);
    setBusy(false);
  }

  return (
    <div className="mt-6 rounded border border-neutral-300 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
        Prueba la clasificación en vivo
      </p>
      <p className="mt-1 text-xs text-neutral-500">
        Escribe cómo se siente una paciente, en sus propias palabras. No se
        guarda ningún caso, en vivo o de ejemplo — solo se muestra la
        clasificación.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setText(EXAMPLES.with_symptoms)}
          className="rounded border border-neutral-300 px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
        >
          Ejemplo: con síntomas
        </button>
        <button
          type="button"
          onClick={() => setText(EXAMPLES.without_symptoms)}
          className="rounded border border-neutral-300 px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
        >
          Ejemplo: sin síntomas
        </button>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={500}
        rows={3}
        placeholder="Ej. Me levanto varias veces en la noche a orinar y tengo mucha sed."
        className="mt-3 w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
      />

      <button
        type="button"
        onClick={handleClassify}
        disabled={busy || text.trim().length === 0}
        className="mt-3 rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
      >
        {busy ? "Clasificando…" : "Clasificar"}
      </button>

      {error && (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-4 rounded border border-neutral-300 bg-neutral-50 p-4">
          <p className="text-sm">
            <strong>
              {result.has_credible_signal
                ? "Señal disponible"
                : "Sin señal creíble"}
            </strong>
            {!isLive && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800">
                Resultado de ejemplo, no en vivo
              </span>
            )}
          </p>
          {result.symptoms.length > 0 && (
            <p className="mt-1 text-sm text-neutral-700">
              Síntomas candidatos: {result.symptoms.join(", ")}
            </p>
          )}
          <p className="mt-2 text-sm text-neutral-700">{result.rationale}</p>
          {!isLive && fallbackMessage && (
            <p className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {fallbackMessage}
            </p>
          )}
          {isLive && (
            <div className="mt-3">
              <AiDisclosure />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
