import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function CasesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-10 text-neutral-100">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">
            Casos — {user.email}
          </h1>
          <form action="/auth/signout" method="post">
            <button className="text-sm text-neutral-400 underline hover:text-neutral-200">
              Cerrar sesión
            </button>
          </form>
        </div>
        <p className="mt-6 text-sm text-neutral-400">
          Todavía no hay casos. La carga de casos llega en el siguiente
          commit.
        </p>
      </div>
    </main>
  );
}
