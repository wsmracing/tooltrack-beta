-- ToolTrack V5 pre-launch security migration
-- Shared beta access rate-limit store for serverless deployments.

create table if not exists public.beta_access_attempts (
  id uuid primary key default gen_random_uuid(),
  rate_key text not null,
  success boolean not null default false,
  attempted_at timestamptz not null default now()
);

create index if not exists beta_access_attempts_rate_key_attempted_idx
  on public.beta_access_attempts (rate_key, attempted_at desc);

alter table public.beta_access_attempts enable row level security;

drop policy if exists "No public beta access attempt reads" on public.beta_access_attempts;
drop policy if exists "No public beta access attempt writes" on public.beta_access_attempts;

create policy "No public beta access attempt reads"
  on public.beta_access_attempts for select
  using (false);

create policy "No public beta access attempt writes"
  on public.beta_access_attempts for all
  using (false)
  with check (false);

-- Keep the table small. Run manually if required, or schedule later:
-- delete from public.beta_access_attempts where attempted_at < now() - interval '7 days';
