"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      patient_alias: formData.get("patient_alias"),
      detection_type: formData.get("detection_type"),
      detection_value: formData.get("detection_value"),
      detected_at: formData.get("detected_at"),
      affordability_status: formData.get("affordability_status"),
      raw_text: formData.get("raw_text"),
    };

    const response = await fetch("/api/cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Ocurrió un error al guardar el caso.");
      setSubmitting(false);
      return;
    }

    router.push("/cases");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-10 text-neutral-100">
      <div className="mx-auto max-w-xl">
        <h1 className="text-xl font-semibold tracking-tight">Nuevo caso</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Detección positiva — línea base en las palabras de la paciente.
        </p>

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
            <label className="block text-sm font-medium text-neutral-300">
              Estatus de asequibilidad
            </label>
            <select
              name="affordability_status"
              required
              defaultValue=""
              className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
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
            <label className="block text-sm font-medium text-neutral-300">
              ¿Cómo se siente? (en sus propias palabras)
            </label>
            <textarea
              name="raw_text"
              required
              maxLength={2000}
              rows={5}
              placeholder="Ej. Me levanto varias veces en la noche a orinar y tengo mucha sed."
              className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-white disabled:opacity-60"
          >
            {submitting ? "Guardando…" : "Guardar caso"}
          </button>
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
      <label className="block text-sm font-medium text-neutral-300">
        {label}
      </label>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        maxLength={80}
        className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
      />
    </div>
  );
}
