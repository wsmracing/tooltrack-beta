-- ToolTrack V3.2 Beta schema
-- Run this entire file once in a new Supabase project.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  business_name text,
  account_type text not null default 'individual' check (account_type in ('individual','tradesperson','business')),
  email_sighting_notifications boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  make text not null,
  model text not null,
  category text not null,
  serial_original text not null,
  serial_normalized text not null unique,
  secondary_identifier text,
  colour text,
  storage_location text,
  estimated_value numeric(12,2),
  supplier text,
  purchase_date date,
  purchase_price numeric(12,2),
  invoice_number text,
  security_id text,
  status text not null default 'safe' check (status in ('safe','stolen','recovered','transfer')),
  registered_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists assets_owner_id_idx on public.assets(owner_id);
create index if not exists assets_serial_normalized_idx on public.assets(serial_normalized);

create table if not exists public.asset_photos (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  original_name text not null,
  image_type text not null default 'additional',
  created_at timestamptz not null default now()
);

create table if not exists public.asset_documents (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  original_name text not null,
  document_type text not null default 'proof_of_ownership',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.theft_reports (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  theft_date date not null,
  location_area text not null,
  police_reference text,
  circumstances text,
  public_reference text not null unique,
  reported_at timestamptz not null default now(),
  recovered_at timestamptz
);
create index if not exists theft_reports_asset_id_idx on public.theft_reports(asset_id);

create table if not exists public.sightings (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  theft_report_id uuid not null references public.theft_reports(id) on delete cascade,
  reporter_email text,
  location_area text not null,
  listing_url text,
  details text not null,
  status text not null default 'new' check (status in ('new','reviewed','dismissed')),
  notification_status text not null default 'pending',
  notification_sent_at timestamptz,
  notification_error text,
  created_at timestamptz not null default now()
);
create index if not exists sightings_asset_id_idx on public.sightings(asset_id);
create index if not exists sightings_theft_report_id_idx on public.sightings(theft_report_id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(new.raw_user_meta_data->>'full_name', ''))
  on conflict do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.assets enable row level security;
alter table public.asset_photos enable row level security;
alter table public.asset_documents enable row level security;
alter table public.theft_reports enable row level security;
alter table public.sightings enable row level security;

drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile" on public.profiles for select using (auth.uid() = id);
drop policy if exists "Users insert own profile" on public.profiles;
create policy "Users insert own profile" on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Owners read assets" on public.assets;
create policy "Owners read assets" on public.assets for select using (auth.uid() = owner_id);
drop policy if exists "Owners insert assets" on public.assets;
create policy "Owners insert assets" on public.assets for insert with check (auth.uid() = owner_id);
drop policy if exists "Owners update assets" on public.assets;
create policy "Owners update assets" on public.assets for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "Owners delete assets" on public.assets;
create policy "Owners delete assets" on public.assets for delete using (auth.uid() = owner_id);

drop policy if exists "Owners read photos" on public.asset_photos;
create policy "Owners read photos" on public.asset_photos for select using (auth.uid() = owner_id);
drop policy if exists "Owners insert photos" on public.asset_photos;
create policy "Owners insert photos" on public.asset_photos for insert with check (auth.uid() = owner_id);
drop policy if exists "Owners delete photos" on public.asset_photos;
create policy "Owners delete photos" on public.asset_photos for delete using (auth.uid() = owner_id);

drop policy if exists "Owners read documents" on public.asset_documents;
create policy "Owners read documents" on public.asset_documents for select using (auth.uid() = owner_id);
drop policy if exists "Owners insert documents" on public.asset_documents;
create policy "Owners insert documents" on public.asset_documents for insert with check (auth.uid() = owner_id);
drop policy if exists "Owners delete documents" on public.asset_documents;
create policy "Owners delete documents" on public.asset_documents for delete using (auth.uid() = owner_id);

drop policy if exists "Owners read theft reports" on public.theft_reports;
create policy "Owners read theft reports" on public.theft_reports for select using (auth.uid() = owner_id);
drop policy if exists "Owners insert theft reports" on public.theft_reports;
create policy "Owners insert theft reports" on public.theft_reports for insert with check (auth.uid() = owner_id);
drop policy if exists "Owners update theft reports" on public.theft_reports;
create policy "Owners update theft reports" on public.theft_reports for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "Owners read sightings for own assets" on public.sightings;
create policy "Owners read sightings for own assets" on public.sightings for select using (
  exists (select 1 from public.assets where assets.id = sightings.asset_id and assets.owner_id = auth.uid())
);
drop policy if exists "Owners update sightings for own assets" on public.sightings;
create policy "Owners update sightings for own assets" on public.sightings for update using (
  exists (select 1 from public.assets where assets.id = sightings.asset_id and assets.owner_id = auth.uid())
) with check (
  exists (select 1 from public.assets where assets.id = sightings.asset_id and assets.owner_id = auth.uid())
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('asset-photos', 'asset-photos', false, 10485760, array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do update set public = false;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ownership-documents', 'ownership-documents', false, 15728640, array['application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do update set public = false;

drop policy if exists "Users upload own asset photos" on storage.objects;
create policy "Users upload own asset photos" on storage.objects for insert to authenticated
with check (bucket_id = 'asset-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Users read own asset photos" on storage.objects;
create policy "Users read own asset photos" on storage.objects for select to authenticated
using (bucket_id = 'asset-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Users delete own asset photos" on storage.objects;
create policy "Users delete own asset photos" on storage.objects for delete to authenticated
using (bucket_id = 'asset-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users upload own documents" on storage.objects;
create policy "Users upload own documents" on storage.objects for insert to authenticated
with check (bucket_id = 'ownership-documents' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Users read own documents" on storage.objects;
create policy "Users read own documents" on storage.objects for select to authenticated
using (bucket_id = 'ownership-documents' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Users delete own documents" on storage.objects;
create policy "Users delete own documents" on storage.objects for delete to authenticated
using (bucket_id = 'ownership-documents' and (storage.foldername(name))[1] = auth.uid()::text);
