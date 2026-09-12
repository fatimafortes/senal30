# IMPLEMENTATION PROMPT — paste into Claude Code

> Paste everything below the line into your terminal session. Paste `docs/PACKET.md` first if it isn't already in the repo.

---

## Context

I'm building **SEÑAL 30**, a 30-day return-signal checkpoint for post-detection diabetes care in Mexico. Full spec is in `docs/PACKET.md` — read it before writing code.

**The one-sentence purpose:** before a detected patient can be marked as enrolled in follow-through, the system must establish that a *credible 30-day return signal* exists — something the patient can actually feel change within 30 days that is downstream of taking the medication. When no credible signal exists, the system must refuse to enrol the case and say so on screen. This refusal is the product, not an edge case.

**Non-negotiable behaviour:** the app must always be able to say no. Do not add any configuration, override, or "skip check" path that lets every case pass. If you find yourself building one, stop and tell me.

## Stack (fixed — do not substitute)

Next.js App Router + TypeScript · Tailwind · Supabase (Postgres + Auth + RLS) · Anthropic API called **only** from server-side route handlers · deployed to Vercel · secrets in Vercel env vars, `.env.local` gitignored · Zod validation on every input, client and server.

## Security floor — implement from commit 1, not retrofitted

1. No secrets in code or repo. `ANTHROPIC_API_KEY` and Supabase service key exist only as env vars and are never referenced in a client component.
2. Supabase Auth with Google sign-in. No page showing case data renders without a session.
3. RLS ON for every table. `cases` scoped by `owner_id = auth.uid()`; child tables scoped through their case.
4. Zod on every form: length caps, type checks, enum checks. Re-validate server-side. Nothing goes raw from a textarea into the database or into an LLM prompt.
5. All seed data invented and visibly labeled as fictional. No real personal data anywhere.
6. Every screen region containing model output carries a visible label: "Contenido generado por IA — revisar antes de actuar".

## Data model

```
cases        id, owner_id, patient_alias, detection_type, detection_value,
             detected_at, affordability_status, signal_status, simulated_day, created_at
baselines    id, case_id, raw_text, classified_symptoms jsonb, declared_signal,
             has_credible_signal bool, created_at
checkpoints  id, case_id, day int, responses jsonb, verdict, ai_rationale,
             confirmed_by_owner_id, confirmed_at, created_at
audit_log    id, case_id, event, actor, payload jsonb, created_at
```

`signal_status` enum: `available` | `no_credible_signal` | `manufactured` | `unresolved`
`verdict` enum: `confirmed` | `failed` | `not_scalable`
`affordability_status` enum: `covered` | `lower_cost` | `funded` | `unresolved`

## Build it as these commits, in this order

Each commit must leave the app deployable. Stop after each and let me review before continuing.

**Commit 1 — skeleton + security floor.** Next.js app, Tailwind, Supabase client, Google auth, the four tables with RLS policies, protected `/cases` route that redirects when signed out. No features yet. Deploy to Vercel. Acceptance: signed-out user cannot reach `/cases`; a second account cannot read the first account's rows by ID.

**Commit 2 — intake and baseline classification.** `/cases/new` form: patient alias, detection type, detection value, date, affordability status, and a free-text box where the patient describes how she feels in her own words. On submit, a server route sends that text to Claude with a prompt that classifies it into reversible-within-30-days symptom candidates (nocturia, thirst, fatigue, blurred vision, recurrent infection, slow-healing wounds) and returns strict JSON: `{ symptoms: [], has_credible_signal: bool, suggested_primary_signal: string|null, rationale: string }`. Parse defensively; never trust the shape. Store in `baselines`. Acceptance: T1 returns nocturia as a candidate; T2 returns `has_credible_signal: false`; T3 returns no candidates.

**Commit 3 — the refusal.** `/cases/[id]` detail screen. When `has_credible_signal` is false, render a prominent warning card — "SIN SEÑAL DE RETORNO CREÍBLE — no se puede inscribir" — with the reason, and **the enrol action must be disabled**. The owner gets exactly two paths: declare a manufactured signal (with a required free-text justification) or record the case as `unresolved`. Write both to `audit_log`. Acceptance: T2 cannot be enrolled through the UI or by posting directly to the API route.

**Commit 4 — the 30-day loop.** Checkpoint scheduling against `simulated_day`, plus a clearly-labeled dev control to advance simulated time. At day 30, generate three plain-language Spanish questions targeted at the declared signal (Claude drafts; store them). A patient-facing answer screen captures responses. A server route compares day-30 responses to the baseline and produces `confirmed`, `failed`, or `not_scalable` plus a rationale. Acceptance: T4 yields `confirmed`; T5 yields `failed` and surfaces an escalation on the caseload list.

**Commit 5 — human confirmation and audit.** No verdict is final without `confirmed_by_owner_id`. The AI drafts the rationale; the owner confirms or overrides with a reason. Every state change appends to `audit_log`. Caseload list at `/cases` shows status badges and sorts escalations to the top. Acceptance: T6 — a case cannot reach a closed state through the API without owner confirmation.

**Commit 6+ — bug fixes from the test plan and the persona test.** Second deploy happens here at the latest.

## LLM prompt rules

- Server-side only. Temperature low. Ask for JSON only, no prose, no markdown fences, and strip fences defensively before parsing.
- If parsing fails, fall back to `has_credible_signal: false` and flag for human review. **Fail toward refusal, never toward enrolment.**
- Never send the patient alias or any identifier to the API. Send only the symptom text.
- Cap input length before the call.

## How to work with me

Small steps. After each commit: show me the diff summary, tell me what you'd do next, and wait. If something in the packet is ambiguous, ask instead of guessing. If a design choice would weaken the refusal behaviour, say so explicitly rather than quietly working around it.

At the end of every session, update `DECISIONS.md` with what changed, what broke, and tomorrow's first move — then commit and push.
