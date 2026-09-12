-- SEÑAL 30 — commit 1: skeleton tables + RLS.
--
-- This project's Supabase instance ("semestre") is SHARED with other class
-- assignments. Every object created here is prefixed senal30_ so it cannot
-- collide with or be confused for another assignment's schema. Nothing in
-- this file drops, alters, or reads any table that isn't prefixed senal30_.
-- Safe to run more than once (guards against re-creating existing objects).

do $$
begin
  if not exists (select 1 from pg_type where typname = 'senal30_signal_status') then
    create type senal30_signal_status as enum ('available', 'no_credible_signal', 'manufactured', 'unresolved');
  end if;

  if not exists (select 1 from pg_type where typname = 'senal30_verdict') then
    create type senal30_verdict as enum ('confirmed', 'failed', 'not_scalable');
  end if;

  if not exists (select 1 from pg_type where typname = 'senal30_affordability_status') then
    create type senal30_affordability_status as enum ('covered', 'lower_cost', 'funded', 'unresolved');
  end if;
end
$$;

create table if not exists senal30_cases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  patient_alias text not null,
  detection_type text not null,
  detection_value text not null,
  detected_at date not null,
  affordability_status senal30_affordability_status not null default 'unresolved',
  signal_status senal30_signal_status not null default 'unresolved',
  simulated_day int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists senal30_baselines (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references senal30_cases(id) on delete cascade,
  raw_text text not null,
  classified_symptoms jsonb not null default '[]'::jsonb,
  declared_signal text,
  has_credible_signal boolean not null default false,
  ai_labeled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists senal30_checkpoints (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references senal30_cases(id) on delete cascade,
  day int not null,
  responses jsonb,
  verdict senal30_verdict,
  ai_rationale text,
  confirmed_by_owner_id uuid references auth.users(id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists senal30_audit_log (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references senal30_cases(id) on delete cascade,
  event text not null,
  actor text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);

alter table senal30_cases enable row level security;
alter table senal30_baselines enable row level security;
alter table senal30_checkpoints enable row level security;
alter table senal30_audit_log enable row level security;

drop policy if exists senal30_cases_owner_all on senal30_cases;
create policy senal30_cases_owner_all
  on senal30_cases
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists senal30_baselines_owner_all on senal30_baselines;
create policy senal30_baselines_owner_all
  on senal30_baselines
  for all
  using (exists (
    select 1 from senal30_cases c
    where c.id = senal30_baselines.case_id and c.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from senal30_cases c
    where c.id = senal30_baselines.case_id and c.owner_id = auth.uid()
  ));

drop policy if exists senal30_checkpoints_owner_all on senal30_checkpoints;
create policy senal30_checkpoints_owner_all
  on senal30_checkpoints
  for all
  using (exists (
    select 1 from senal30_cases c
    where c.id = senal30_checkpoints.case_id and c.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from senal30_cases c
    where c.id = senal30_checkpoints.case_id and c.owner_id = auth.uid()
  ));

drop policy if exists senal30_audit_log_owner_all on senal30_audit_log;
create policy senal30_audit_log_owner_all
  on senal30_audit_log
  for all
  using (exists (
    select 1 from senal30_cases c
    where c.id = senal30_audit_log.case_id and c.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from senal30_cases c
    where c.id = senal30_audit_log.case_id and c.owner_id = auth.uid()
  ));
