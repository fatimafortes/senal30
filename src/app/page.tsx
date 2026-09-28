import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/cases");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-stone-100 px-4 text-neutral-900">
      <div className="w-full max-w-sm rounded border border-neutral-300 bg-white p-8 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
          SEÑAL 30
        </p>
        <p className="mt-1 text-sm text-neutral-500">
          Checkpoint de señal de retorno a 30 días
        </p>

        <Link
          href="/login"
          className="mt-6 block w-full rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
        >
          Iniciar sesión con Google
        </Link>

        <Link
          href="/demo"
          className="mt-3 block w-full rounded border border-neutral-400 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
        >
          Ver demostración (sin cuenta)
        </Link>
      </div>
    </main>
  );
}
