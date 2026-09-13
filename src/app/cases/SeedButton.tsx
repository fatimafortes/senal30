"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Modo de demostración: carga casos inventados y ya clasificados sin
// llamar a Gemini, para que la demo no dependa de la cuota gratuita.
export function SeedButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    await fetch("/api/seed", { method: "POST" });
    router.refresh();
    setBusy(false);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm font-medium text-neutral-300 hover:bg-neutral-900 disabled:opacity-60"
    >
      {busy ? "Cargando…" : "Cargar casos de demostración"}
    </button>
  );
}
