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
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-neutral-950 px-4 text-neutral-100">
      <div className="w-full max-w-sm rounded-lg border border-neutral-800 bg-neutral-900 p-8 text-center">
        <h1 className="text-lg font-semibold tracking-tight">SEÑAL 30</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Acceso para responsables de caso
        </p>
        <button
          onClick={signInWithGoogle}
          disabled={loading}
          className="mt-6 w-full rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-white disabled:opacity-60"
        >
          {loading ? "Redirigiendo…" : "Iniciar sesión con Google"}
        </button>
        {error && (
          <p className="mt-4 text-sm text-red-400" role="alert">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
