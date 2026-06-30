-- ToolTrack Beta update: public sighting reports
-- Run once in Supabase SQL Editor after the original schema.sql.

create table if not exists public.sightings (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  theft_report_id uuid not null references public.theft_reports(id) on delete cascade,
  reporter_email text,
  location_area text not null,
  listing_url text,
  details text not null,
  status text not null default 'new' check (status in ('new','reviewed','dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists sightings_asset_id_idx on public.sightings(asset_id);
create index if not exists sightings_theft_report_id_idx on public.sightings(theft_report_id);
create index if not exists sightings_created_at_idx on public.sightings(created_at desc);

alter table public.sightings enable row level security;

drop policy if exists "Owners read sightings for own assets" on public.sightings;
create policy "Owners read sightings for own assets"
on public.sightings for select
using (
  exists (
    select 1 from public.assets
    where assets.id = sightings.asset_id
      and assets.owner_id = auth.uid()
  )
);
