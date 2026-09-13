# DECISIONS

## 2026-09-13 — Cambio de proveedor LLM: Anthropic → Google Gemini

**Qué cambió**: `docs/PACKET.md` (tabla de arquitectura, fila LLM) y
`.env.local.example` ahora dicen Google Gemini API / `GEMINI_API_KEY` en vez
de Anthropic API / `ANTHROPIC_API_KEY`. Nada más del packet se tocó.

**Por qué**: la usuaria tiene tier gratuito en Google Gemini y prefiere
usarlo en vez de pagar por la API de Anthropic para este proyecto escolar.

**Qué NO cambia** (se mantiene igual que en `docs/IMPLEMENTATION_PROMPT.md`,
sección "LLM prompt rules"):
- La llamada al modelo sigue siendo exclusivamente desde un route handler de
  servidor — la key nunca llega al cliente.
- Respuesta exigida en JSON estricto, sin prosa ni fences de markdown; se
  despoja cualquier fence de forma defensiva antes de parsear.
- Si el parseo falla, el resultado cae a `has_credible_signal: false` y se
  marca para revisión humana — falla siempre hacia el rechazo, nunca hacia
  la inscripción automática.
- Nunca se envía el alias del paciente ni ningún identificador al modelo,
  solo el texto de síntomas, con un tope de longitud antes de la llamada.
- La etiqueta en pantalla sigue siendo "Contenido generado por IA — revisar
  antes de actuar", sin nombrar el proveedor.

El código del commit 2 aísla el proveedor detrás de una sola función
(`src/lib/llm.ts`) para que un futuro cambio de proveedor no toque el resto
de la app.

## 2026-09-12 — Commit 1: skeleton + security floor

**What changed**
- Scaffolded Next.js (App Router, TypeScript, Tailwind) via `create-next-app`.
- Added Supabase SSR auth (`@supabase/ssr`): browser client, server client, and
  a middleware (`src/middleware.ts`) that refreshes the session on every
  request and redirects signed-out users away from `/cases` to `/login`.
- Google sign-in wired through Supabase Auth (`/login` triggers
  `signInWithOAuth`, `/auth/callback` exchanges the code, `/auth/signout`
  clears the session).
- `/cases` is a protected placeholder — no case data yet, just proves the
  auth gate works end to end.
- SQL migration `supabase/migrations/0001_senal30_init.sql` creates the four
  tables from the packet (`senal30_cases`, `senal30_baselines`,
  `senal30_checkpoints`, `senal30_audit_log`) plus RLS policies scoping every
  row to `owner_id = auth.uid()` (child tables scoped via a join to
  `senal30_cases`). All objects are `senal30_`-prefixed because the Supabase
  project ("semestre") is shared with other class assignments — see
  `supabase/migrations/0000_check_existing_tables.sql`, a read-only check to
  run first.

**Why the `senal30_` prefix and the read-only check first**: the Supabase
project is shared across the user's coursework, not exclusive to this app.
No destructive statements anywhere in the migration; it only touches
`senal30_*` objects and is safe to re-run.

**What broke / open items**
- Nothing broken yet — pending first real deploy + first login test once
  Supabase credentials and the Google OAuth redirect URL are in place.
- Google OAuth provider already exists in this Supabase project for other
  assignments (shared Client ID/Secret) — we only add a redirect URL to its
  existing allow-list, never touch the provider's credentials.

**Tomorrow's first move**
- Once `.env.local` has real Supabase values and the migration has run:
  test sign-in locally, confirm `/cases` redirects when signed out, then
  deploy to Vercel and confirm the same on the live URL (commit 1
  acceptance test). Then start commit 2 (intake form + baseline
  classification via Claude).
