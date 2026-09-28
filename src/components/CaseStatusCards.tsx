import { AiDisclosure } from "@/components/AiDisclosure";

// Tarjetas de estado puramente presentacionales — sin fetch, sin
// interactividad, sin "use client". Las usan tanto /cases/[id] (con los
// botones de acción al lado) como /demo/[id] (de solo lectura, donde no
// existe ningún camino de escritura compilado en la pantalla en absoluto).

export function RefusalCard({
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

export function AvailableCard({
  declaredSignal,
  showAiDisclosure,
}: {
  declaredSignal: string | null | undefined;
  showAiDisclosure: boolean;
}) {
  return (
    <div className="mt-6 rounded border border-emerald-700 bg-emerald-50 p-5">
      <h2 className="text-lg font-bold text-emerald-800">
        Señal de retorno disponible
      </h2>
      <p className="mt-2 text-sm text-emerald-900">
        Señal declarada: <strong>{declaredSignal}</strong>
      </p>
      {showAiDisclosure && (
        <div className="mt-3">
          <AiDisclosure />
        </div>
      )}
    </div>
  );
}

export function ManufacturedCard({
  heading,
  declaredSignal,
  justification,
}: {
  heading: string;
  declaredSignal: string;
  justification: string;
}) {
  return (
    <div className="mt-6 rounded border border-amber-600 bg-amber-50 p-5">
      <h2 className="text-lg font-bold text-amber-800">{heading}</h2>
      <p className="mt-2 text-sm text-amber-900">
        Señal declarada: <strong>{declaredSignal}</strong>
      </p>
      <p className="mt-2 text-sm text-neutral-700">
        Justificación: {justification}
      </p>
    </div>
  );
}

export function UnresolvedCard({ note }: { note: string | null }) {
  return (
    <div className="mt-6 rounded border border-neutral-300 bg-neutral-50 p-5">
      <h2 className="text-lg font-bold text-neutral-800">
        Caso resuelto — sin señal de retorno
      </h2>
      <p className="mt-1 text-sm text-neutral-600">
        Este caso queda cerrado y contado como resuelto. No había con qué
        comprobar que el tratamiento le está funcionando — eso se documenta
        como evidencia, no como un pendiente.
      </p>
      {note && (
        <p className="mt-2 text-sm text-neutral-700">Nota: {note}</p>
      )}
    </div>
  );
}

export const VERDICT_LABELS: Record<string, string> = {
  confirmed: "SEÑAL CONFIRMADA",
  failed: "SEÑAL FALLÓ",
  not_scalable: "NO ESCALABLE",
};

export const VERDICT_STYLES: Record<string, string> = {
  confirmed: "border-emerald-700 bg-emerald-50 text-emerald-900",
  failed: "border-red-700 bg-red-50 text-red-900",
  not_scalable: "border-neutral-300 bg-neutral-50 text-neutral-800",
};

// Solo el estado YA confirmado — es el único que puede aparecer en
// /demo (los casos semilla con checkpoint siempre vienen pre-confirmados;
// un borrador sin confirmar necesita a alguien con sesión para resolverlo).
export function ConfirmedVerdictCard({
  verdict,
  rationale,
  confirmedAt,
  wasOverridden,
  overrideOriginalVerdict,
  overrideReason,
  showAiDisclosure,
  correctedByLabel = "la responsable de caso",
}: {
  verdict: "confirmed" | "failed" | "not_scalable";
  rationale: string | null;
  confirmedAt: string | null;
  wasOverridden: boolean;
  overrideOriginalVerdict: "confirmed" | "failed" | "not_scalable" | null;
  overrideReason: string | null;
  showAiDisclosure: boolean;
  correctedByLabel?: string;
}) {
  return (
    <div className={`mt-3 rounded border-2 p-5 ${VERDICT_STYLES[verdict]}`}>
      <h3 className="text-xl font-bold">{VERDICT_LABELS[verdict]}</h3>
      {wasOverridden ? (
        <p className="mt-2 text-sm">
          Corregido por {correctedByLabel}
          {overrideOriginalVerdict
            ? ` (borrador original: ${VERDICT_LABELS[overrideOriginalVerdict]})`
            : ""}
          . Razón: {overrideReason}
        </p>
      ) : (
        rationale && <p className="mt-2 text-sm">{rationale}</p>
      )}
      <p className="mt-2 text-xs opacity-80">
        Confirmado
        {confirmedAt
          ? ` el ${new Date(confirmedAt).toLocaleString("es-MX")}`
          : ""}
        .
      </p>
      {!wasOverridden && verdict !== "not_scalable" && showAiDisclosure && (
        <div className="mt-3">
          <AiDisclosure />
        </div>
      )}
    </div>
  );
}
