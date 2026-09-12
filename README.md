# SEÑAL 30

Checkpoint de señal de retorno a 30 días para seguimiento post-detección de
diabetes. Ver `docs/PACKET.md` para el spec completo y `docs/IMPLEMENTATION_PROMPT.md`
para el plan de commits.

## Stack

Next.js (App Router, TypeScript) · Tailwind · Supabase (Postgres + Auth + RLS)
· Anthropic API (server-side only) · Vercel.

## Setup local

1. `npm install`
2. Copia `.env.local.example` a `.env.local` y llena los valores (ver
   comentarios en el archivo para saber dónde encontrarlos).
3. Corre `supabase/migrations/0000_check_existing_tables.sql` en el SQL
   Editor de Supabase primero (solo lectura), luego
   `supabase/migrations/0001_senal30_init.sql` para crear las tablas
   (prefijo `senal30_`, este proyecto de Supabase es compartido).
4. `npm run dev` y abre http://localhost:3000

## Decisiones y progreso

Ver `DECISIONS.md`, actualizado al final de cada sesión de trabajo.
