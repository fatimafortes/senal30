"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FictionalDataNotice } from "@/components/FictionalDataNotice";

const AFFORDABILITY_OPTIONS: { value: string; label: string }[] = [
  { value: "covered", label: "Cubierto" },
  { value: "lower_cost", label: "Costo reducido" },
  { value: "funded", label: "Financiado" },
  { value: "unresolved", label: "Financieramente no resuelto" },
];

export default function NewCasePage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [createdCaseId, setCreatedCaseId] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      patient_alias: formData.get("patient_alias"),
      detection_type: formData.get("detection_type"),
      detection_value: formData.get("detection_value"),
      detected_at: formData.get("detected_at"),
      affordability_status: formData.get("affordability_status"),
      raw_text: formData.get("raw_text"),
    };

    let response: Response;
    try {
      response = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      // Lo que ya escribió la usuaria sigue en el formulario — no se pierde
      // nada, solo no se pudo enviar todavía.
      setError(
        "No se pudo conectar con el servidor. Tu información sigue aquí — intenta de nuevo."
      );
      setSubmitting(false);
      return;
    }

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      setError(body?.error ?? "Ocurrió un error al guardar el caso.");
      setSubmitting(false);
      return;
    }

    if (body?.classification_unavailable) {
      // No navegamos de inmediato: la usuaria necesita ver este aviso, no
      // solo el estado final en la lista de casos.
      setNotice(
        "El servicio de clasificación no está disponible en este momento — el caso se guardó marcado para revisión humana."
      );
      setCreatedCaseId(body.id);
      setSubmitting(false);
      router.refresh();
      return;
    }

    router.push("/cases");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-stone-100 px-6 py-10 text-neutral-900">
      <div className="mx-auto max-w-xl rounded border border-neutral-300 bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
          SEÑAL 30 · nuevo caso
        </p>
        <p className="mt-1 text-sm text-neutral-500">
          Detección positiva — línea base en las palabras de la paciente.
        </p>

        <div className="mt-3">
          <FictionalDataNotice />
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <Field label="Alias de la paciente" name="patient_alias" required />
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Tipo de detección"
              name="detection_type"
              placeholder="Glucosa capilar"
              required
            />
            <Field
              label="Valor"
              name="detection_value"
              placeholder="210 mg/dL"
              required
            />
          </div>
          <Field
            label="Fecha de detección"
            name="detected_at"
            type="date"
            required
          />

          <div>
            <label className="block text-sm font-medium text-neutral-700">
              Estatus de asequibilidad
            </label>
            <select
              name="affordability_status"
              required
              defaultValue=""
              className="mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
            >
              <option value="" disabled>
                Selecciona una opción
              </option>
              {AFFORDABILITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700">
              ¿Cómo se siente? (en sus propias palabras)
            </label>
            <textarea
              name="raw_text"
              required
              maxLength={2000}
              rows={5}
              placeholder="Ej. Me levanto varias veces en la noche a orinar y tengo mucha sed."
              className="mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
            />
          </div>

          {error && (
            <p
              className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
              role="alert"
            >
              {error}
            </p>
          )}
          {notice && (
            <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <p>{notice}</p>
              {createdCaseId && (
                <a
                  href={`/cases/${createdCaseId}`}
                  className="mt-1 inline-block font-medium underline"
                >
                  Ver el caso guardado →
                </a>
              )}
            </div>
          )}

          {!notice && (
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-60"
            >
              {submitting ? "Guardando…" : "Guardar caso"}
            </button>
          )}
        </form>
      </div>
    </main>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-700">
        {label}
      </label>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        maxLength={80}
        className="mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
      />
    </div>
  );
}
