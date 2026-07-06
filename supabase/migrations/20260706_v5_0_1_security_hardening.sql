-- ToolTrack v5.0.1 security hardening
-- Run this in Supabase before relying on the deployed v5.0.1 API routes.

begin;

-- Shared server-side rate limits for Vercel/serverless deployments.
create table if not exists public.rate_limits (
  bucket_key text primary key,
  count integer not null default 0,
  reset_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.rate_limits enable row level security;

create index if not exists rate_limits_reset_at_idx on public.rate_limits (reset_at);

create or replace function public.tooltrack_check_rate_limit(
  p_key text,
  p_max integer,
  p_window_seconds integer
)
returns table(allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_reset_at timestamptz;
begin
  if p_key is null or length(trim(p_key)) = 0 or p_max < 1 or p_window_seconds < 1 then
    allowed := false;
    remaining := 0;
    reset_at := now() + interval '1 minute';
    return next;
    return;
  end if;

  delete from public.rate_limits
  where reset_at < now() - interval '1 day';

  insert into public.rate_limits as rl (bucket_key, count, reset_at, updated_at)
  values (p_key, 1, now() + make_interval(secs => p_window_seconds), now())
  on conflict (bucket_key) do update
  set
    count = case
      when rl.reset_at <= now() then 1
      else rl.count + 1
    end,
    reset_at = case
      when rl.reset_at <= now() then now() + make_interval(secs => p_window_seconds)
      else rl.reset_at
    end,
    updated_at = now()
  returning rl.count, rl.reset_at into v_count, v_reset_at;

  allowed := v_count <= p_max;
  remaining := greatest(0, p_max - v_count);
  reset_at := v_reset_at;
  return next;
end;
$$;

revoke all on function public.tooltrack_check_rate_limit(text, integer, integer) from public;
revoke all on function public.tooltrack_check_rate_limit(text, integer, integer) from anon;
revoke all on function public.tooltrack_check_rate_limit(text, integer, integer) from authenticated;
grant execute on function public.tooltrack_check_rate_limit(text, integer, integer) to service_role;

-- Seller-confirmation lockout fields.
alter table public.seller_confirmation_challenges
  add column if not exists failed_attempts integer not null default 0,
  add column if not exists locked_at timestamptz,
  add column if not exists last_failed_at timestamptz;

create index if not exists seller_confirmation_pending_asset_idx
  on public.seller_confirmation_challenges (asset_id, status, expires_at desc)
  where status = 'pending';

create index if not exists seller_confirmation_locked_at_idx
  on public.seller_confirmation_challenges (locked_at)
  where locked_at is not null;

commit;
