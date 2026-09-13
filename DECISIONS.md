# DECISIONS

## 2026-09-13 — Incidente: secreto pegado en el chat + rotación pendiente

Se pegó una `GEMINI_API_KEY` directamente en el chat con Claude Code antes de
establecer la regla de no pasar secretos por ahí. Esa key resultó ser
compartida con dos entregas anteriores de la clase que todavía no se
califican, así que **no se revoca todavía** para no romperlas.

**Qué se hizo**: se creó una `GEMINI_API_KEY` nueva, exclusiva de SEÑAL 30,
y esa es la que vive en `.env.local` de este proyecto. Se estableció la
regla, hacia adelante, de no pasar secretos por el chat — valores como keys
o tokens se ponen directo en `.env.local` o en el dashboard correspondiente.

**Pendiente**: rotar (revocar) la key compartida en cuanto esas dos entregas
anteriores se hayan calificado.

## 2026-09-13 — Commit 2: intake + clasificación de línea base (Gemini)

**Qué cambió**
- `/cases/new`: formulario de alta (alias, tipo/valor de detección, fecha,
  estatus de asequibilidad, texto libre de síntomas), Zod en cliente y
  servidor (`src/lib/validation.ts`), tope de 2000 caracteres en el texto.
- `POST /api/cases`: valida, inserta en `senal30_cases`, llama al
  clasificador con **solo** el texto de síntomas (nunca el alias ni otro
  identificador), inserta en `senal30_baselines`, y escribe dos eventos en
  `senal30_audit_log` (`case_created`, `baseline_classified`).
- `src/lib/llm.ts`: único punto de contacto con el proveedor de LLM —
  expone `classifyBaselineSymptoms(text)` y nada más sale de este archivo.
  Temperatura 0.1, `responseMimeType: application/json`, defensa contra
  fences de markdown, y **cualquier fallo (red, parseo, forma inesperada,
  schema inválido) cae en `has_credible_signal: false` marcado para
  revisión humana** — nunca hacia inscripción automática. Además hay una
  red de seguridad adicional al prompt: si no hay síntomas concretos o no
  hay señal primaria declarada, `has_credible_signal` se fuerza a `false`
  sin importar lo que haya dicho el modelo (de esto depende T2, el caso más
  duro del packet).
- `/cases` ahora lista los casos reales del owner con su `signal_status`.

**Nota de modelo**: `gemini-2.5-flash` ya no está disponible para cuentas
nuevas (404 de la API); se usa `gemini-3.6-flash`, que es lo que la propia
API de Google recomienda en el mensaje de error. Un cambio de modelo futuro
solo toca la constante `GEMINI_MODEL` en `src/lib/llm.ts`.

**Pruebas de aceptación (T1/T2/T3) — corridas con `scripts/test-classification.ts`
contra la API real**:
- T1 ("me levanto 4 veces en la noche... mucha sed"): `has_credible_signal: true`,
  `symptoms: ["nicturia", "sed excesiva"]`, `suggested_primary_signal: "nicturia"` ✓
- T2 ("me siento bien, me salió alta el azúcar"): `has_credible_signal: false`,
  `symptoms: []` ✓
- T3 ("me duele la rodilla"): `has_credible_signal: false`, `symptoms: []` ✓

Las tres pasaron. En una corrida intermedia T1 cayó una vez en el fallback
genérico por una sobrecarga temporal (503) del modelo — se agregó logging
de errores en `lib/llm.ts` (`console.error("[llm] ...")`) para poder
diagnosticar esto en producción sin romper el comportamiento de "fallar
hacia el rechazo".

**Qué NO cambia**: todo lo del packet — la señal primaria solo se declara
si `has_credible_signal` es verdadero; el caso se crea con
`signal_status: 'available'` o `'no_credible_signal'` según el resultado,
pero la pantalla de rechazo (tarjeta de advertencia, botón de inscribir
deshabilitado) es trabajo del commit 3, todavía no existe.

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
