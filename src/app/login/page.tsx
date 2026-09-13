"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signInWithGoogle() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-stone-100 px-4 text-neutral-900">
      <div className="w-full max-w-sm rounded border border-neutral-300 bg-white p-8 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
          SEÑAL 30
        </p>
        <p className="mt-1 text-sm text-neutral-500">
          Acceso para responsables de caso
        </p>
        <button
          onClick={signInWithGoogle}
          disabled={loading}
          className="mt-6 w-full rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-60"
        >
          {loading ? "Redirigiendo…" : "Iniciar sesión con Google"}
        </button>
        {error && (
          <p className="mt-4 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
