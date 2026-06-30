-- ToolTrack V3.2 migration
-- Run once in Supabase SQL Editor after the V3.1 sightings migration.

alter table public.profiles
  add column if not exists business_name text,
  add column if not exists email_sighting_notifications boolean not null default true;

alter table public.sightings
  add column if not exists notification_status text not null default 'pending',
  add column if not exists notification_sent_at timestamptz,
  add column if not exists notification_error text;

drop policy if exists "Users insert own profile" on public.profiles;
create policy "Users insert own profile" on public.profiles
for insert with check (auth.uid() = id);

drop policy if exists "Owners update sightings for own assets" on public.sightings;
create policy "Owners update sightings for own assets" on public.sightings
for update using (
  exists (
    select 1 from public.assets
    where assets.id = sightings.asset_id
      and assets.owner_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.assets
    where assets.id = sightings.asset_id
      and assets.owner_id = auth.uid()
  )
);
