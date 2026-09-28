# SEÑAL 30

**Demo pública, sin cuenta:** https://senal30.vercel.app/demo

Checkpoint de señal de retorno a 30 días para seguimiento post-detección de
diabetes. Ver `docs/PACKET.md` para el spec completo y `docs/IMPLEMENTATION_PROMPT.md`
para el plan de commits.

## Stack

Next.js (App Router, TypeScript) · Tailwind · Supabase (Postgres + Auth + RLS)
· Google Gemini API (server-side only) · Vercel.

## Setup local

1. `npm install`
2. Copia `.env.local.example` a `.env.local` y llena los valores (ver
   comentarios en el archivo para saber dónde encontrarlos).
3. Corre las migraciones en `supabase/migrations/` **en orden numérico**
   en el SQL Editor de Supabase (prefijo `senal30_`, este proyecto de
   Supabase es compartido — `0000` es de solo lectura, para confirmar que
   no hay choque de nombres antes de crear nada):
   `0000` → `0001` → `0002` → `0003` → `0004`.
4. `npm run dev` y abre http://localhost:3000

## Decisiones y progreso

Ver `DECISIONS.md`, actualizado al final de cada sesión de trabajo.
