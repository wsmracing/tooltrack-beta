-- ToolTrack V3.3 Beta schema
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


-- V3.3 product catalogue, barcode and email tracking
-- ToolTrack V3.3 migration
-- Run once in Supabase SQL Editor after the V3.2 migration.

create extension if not exists pg_trgm;

create table if not exists public.product_catalogue (
  id uuid primary key default gen_random_uuid(),
  catalogue_key text not null unique,
  make text not null,
  model text not null,
  category text not null,
  manufacturer_part_number text,
  gtin text,
  power_type text,
  voltage text,
  source text not null default 'ToolTrack starter catalogue',
  is_active boolean not null default true,
  search_text text generated always as (
    lower(
      coalesce(make, '') || ' ' ||
      coalesce(model, '') || ' ' ||
      coalesce(manufacturer_part_number, '') || ' ' ||
      coalesce(category, '')
    )
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists product_catalogue_gtin_unique
  on public.product_catalogue(gtin)
  where gtin is not null and gtin <> '';
create index if not exists product_catalogue_search_idx
  on public.product_catalogue using gin (search_text gin_trgm_ops);
create index if not exists product_catalogue_make_idx
  on public.product_catalogue(make);

alter table public.product_catalogue enable row level security;
drop policy if exists "Catalogue publicly readable" on public.product_catalogue;
create policy "Catalogue publicly readable" on public.product_catalogue
for select using (is_active = true);

alter table public.assets
  add column if not exists catalogue_item_id uuid references public.product_catalogue(id) on delete set null,
  add column if not exists product_barcode text;

alter table public.sightings
  add column if not exists notification_provider_id text;

insert into public.product_catalogue
  (catalogue_key, make, model, category, manufacturer_part_number, gtin, power_type, voltage, source)
values
  ('tooltrack-demo-tt-scan-001', 'ToolTrack Demo', 'TT-SCAN-001', 'Test equipment', 'TT-SCAN-001', '5390000000014', 'Demo', null, 'ToolTrack demo record'),
  ('makita-dhr242', 'Makita', 'DHR242', 'Rotary hammer', 'DHR242', null, 'Battery', '18V', 'ToolTrack starter catalogue'),
  ('makita-dhr202', 'Makita', 'DHR202', 'Rotary hammer', 'DHR202', null, 'Battery', '18V', 'ToolTrack starter catalogue'),
  ('makita-dtd153', 'Makita', 'DTD153', 'Impact driver', 'DTD153', null, 'Battery', '18V', 'ToolTrack starter catalogue'),
  ('makita-dhp482', 'Makita', 'DHP482', 'Drill / driver', 'DHP482', null, 'Battery', '18V', 'ToolTrack starter catalogue'),
  ('makita-dga452', 'Makita', 'DGA452', 'Angle grinder', 'DGA452', null, 'Battery', '18V', 'ToolTrack starter catalogue'),
  ('dewalt-dcd796', 'DeWalt', 'DCD796', 'Drill / driver', 'DCD796', null, 'Battery', '18V', 'ToolTrack starter catalogue'),
  ('dewalt-dcf887', 'DeWalt', 'DCF887', 'Impact driver', 'DCF887', null, 'Battery', '18V', 'ToolTrack starter catalogue'),
  ('dewalt-dch273', 'DeWalt', 'DCH273', 'Rotary hammer', 'DCH273', null, 'Battery', '18V', 'ToolTrack starter catalogue'),
  ('dewalt-dcg405', 'DeWalt', 'DCG405', 'Angle grinder', 'DCG405', null, 'Battery', '18V', 'ToolTrack starter catalogue'),
  ('milwaukee-m18-fpd3', 'Milwaukee', 'M18 FPD3', 'Drill / driver', 'M18FPD3', null, 'Battery', '18V', 'ToolTrack starter catalogue'),
  ('milwaukee-m18-fid3', 'Milwaukee', 'M18 FID3', 'Impact driver', 'M18FID3', null, 'Battery', '18V', 'ToolTrack starter catalogue'),
  ('milwaukee-m18-chx', 'Milwaukee', 'M18 CHX', 'Rotary hammer', 'M18CHX', null, 'Battery', '18V', 'ToolTrack starter catalogue'),
  ('bosch-gbh-18v-26', 'Bosch Professional', 'GBH 18V-26', 'Rotary hammer', 'GBH 18V-26', null, 'Battery', '18V', 'ToolTrack starter catalogue'),
  ('bosch-gsr-18v-55', 'Bosch Professional', 'GSR 18V-55', 'Drill / driver', 'GSR 18V-55', null, 'Battery', '18V', 'ToolTrack starter catalogue'),
  ('hilti-te-6-a22', 'Hilti', 'TE 6-A22', 'Rotary hammer', 'TE 6-A22', null, 'Battery', '22V', 'ToolTrack starter catalogue'),
  ('festool-ts-55', 'Festool', 'TS 55', 'Circular saw', 'TS 55', null, 'Mains', null, 'ToolTrack starter catalogue'),
  ('paslode-im350-plus', 'Paslode', 'IM350+', 'Nailer / stapler', 'IM350+', null, 'Gas / battery', null, 'ToolTrack starter catalogue'),
  ('stihl-ts-410', 'Stihl', 'TS 410', 'Cut-off saw / consaw', 'TS 410', null, 'Petrol', null, 'ToolTrack starter catalogue'),
  ('stihl-ts-420', 'Stihl', 'TS 420', 'Cut-off saw / consaw', 'TS 420', null, 'Petrol', null, 'ToolTrack starter catalogue'),
  ('stihl-ms-170', 'Stihl', 'MS 170', 'Chainsaw', 'MS 170', null, 'Petrol', null, 'ToolTrack starter catalogue'),
  ('stihl-fs-55', 'Stihl', 'FS 55', 'Strimmer / brush cutter', 'FS 55', null, 'Petrol', null, 'ToolTrack starter catalogue'),
  ('husqvarna-135-mark-ii', 'Husqvarna', '135 Mark II', 'Chainsaw', '135 Mark II', null, 'Petrol', null, 'ToolTrack starter catalogue'),
  ('husqvarna-129r', 'Husqvarna', '129R', 'Strimmer / brush cutter', '129R', null, 'Petrol', null, 'ToolTrack starter catalogue'),
  ('honda-hrx-537', 'Honda', 'HRX 537', 'Lawn mower', 'HRX 537', null, 'Petrol', null, 'ToolTrack starter catalogue'),
  ('belle-minimix-150', 'Belle', 'Minimix 150', 'Site equipment', 'Minimix 150', null, 'Electric / petrol', null, 'ToolTrack starter catalogue'),
  ('ryobi-r18pd3', 'Ryobi', 'R18PD3', 'Drill / driver', 'R18PD3', null, 'Battery', '18V', 'ToolTrack starter catalogue'),
  ('einhell-tp-cd-18-60', 'Einhell', 'TP-CD 18/60 Li-i BL', 'Drill / driver', 'TP-CD 18/60 Li-i BL', null, 'Battery', '18V', 'ToolTrack starter catalogue'),
  ('evolution-r300dct', 'Evolution', 'R300DCT', 'Cut-off saw / consaw', 'R300DCT', null, 'Mains', null, 'ToolTrack starter catalogue'),
  ('sealey-sac05020', 'Sealey', 'SAC05020', 'Compressor', 'SAC05020', null, 'Mains', null, 'ToolTrack starter catalogue')
on conflict (catalogue_key) do update set
  make = excluded.make,
  model = excluded.model,
  category = excluded.category,
  manufacturer_part_number = excluded.manufacturer_part_number,
  gtin = excluded.gtin,
  power_type = excluded.power_type,
  voltage = excluded.voltage,
  source = excluded.source,
  is_active = true,
  updated_at = now();
-- ToolTrack V4 migration
-- Run once after the V3.3 migration in Supabase SQL Editor.

create extension if not exists pgcrypto;

-- Account types and plan tiers
alter table public.profiles
  add column if not exists phone text,
  add column if not exists plan_tier text not null default 'starter',
  add column if not exists active_organization_id uuid,
  add column if not exists email_team_notifications boolean not null default true;

alter table public.profiles drop constraint if exists profiles_account_type_check;
alter table public.profiles add constraint profiles_account_type_check
  check (account_type in ('individual','tradesperson','business','hire_company'));
alter table public.profiles drop constraint if exists profiles_plan_tier_check;
alter table public.profiles add constraint profiles_plan_tier_check
  check (plan_tier in ('starter','pro','team','fleet'));

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  account_type text not null default 'business' check (account_type in ('individual','tradesperson','business','hire_company')),
  plan_tier text not null default 'team' check (plan_tier in ('starter','pro','team','fleet')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles drop constraint if exists profiles_active_organization_id_fkey;
alter table public.profiles add constraint profiles_active_organization_id_fkey
  foreign key (active_organization_id) references public.organizations(id) on delete set null;

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('owner','admin','editor','viewer')),
  status text not null default 'active' check (status in ('active','disabled')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index if not exists organization_members_user_idx on public.organization_members(user_id);

create table if not exists public.team_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invited_by uuid not null references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'viewer' check (role in ('admin','editor','viewer')),
  token text not null unique,
  status text not null default 'pending' check (status in ('pending','accepted','expired','cancelled')),
  expires_at timestamptz not null,
  email_status text not null default 'pending',
  email_provider_id text,
  email_error text,
  created_at timestamptz not null default now()
);
create index if not exists team_invitations_org_idx on public.team_invitations(organization_id);
create index if not exists team_invitations_email_idx on public.team_invitations(lower(email));

create table if not exists public.asset_locations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  location_type text,
  notes text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, name)
);
create index if not exists asset_locations_org_idx on public.asset_locations(organization_id);

alter table public.assets
  add column if not exists organization_id uuid references public.organizations(id) on delete set null,
  add column if not exists location_id uuid references public.asset_locations(id) on delete set null,
  add column if not exists notes text;
create index if not exists assets_organization_idx on public.assets(organization_id);
create index if not exists assets_location_idx on public.assets(location_id);

create table if not exists public.ownership_transfers (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  from_owner_id uuid not null references auth.users(id) on delete cascade,
  recipient_email text,
  transfer_code text not null unique,
  status text not null default 'pending' check (status in ('pending','accepted','cancelled','expired')),
  expires_at timestamptz not null,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  email_status text not null default 'pending',
  email_provider_id text,
  email_error text,
  created_at timestamptz not null default now()
);
create index if not exists ownership_transfers_asset_idx on public.ownership_transfers(asset_id);
create index if not exists ownership_transfers_recipient_idx on public.ownership_transfers(lower(recipient_email));

create table if not exists public.asset_audit_log (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  changes jsonb,
  created_at timestamptz not null default now()
);
create index if not exists asset_audit_asset_idx on public.asset_audit_log(asset_id, created_at desc);

-- Shared-access helpers
create or replace function public.is_org_member(org_id uuid, minimum_roles text[] default array['owner','admin','editor','viewer'])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = org_id
      and user_id = auth.uid()
      and status = 'active'
      and role = any(minimum_roles)
  );
$$;

create or replace function public.can_read_asset(asset_row public.assets)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() = asset_row.owner_id
    or (asset_row.organization_id is not null and public.is_org_member(asset_row.organization_id));
$$;

create or replace function public.can_edit_asset(asset_row public.assets)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() = asset_row.owner_id
    or (asset_row.organization_id is not null and public.is_org_member(asset_row.organization_id, array['owner','admin','editor']));
$$;

-- Updated RLS
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.team_invitations enable row level security;
alter table public.asset_locations enable row level security;
alter table public.ownership_transfers enable row level security;
alter table public.asset_audit_log enable row level security;

DROP POLICY IF EXISTS "Members read organizations" ON public.organizations;
CREATE POLICY "Members read organizations" ON public.organizations FOR SELECT USING (owner_id = auth.uid() OR public.is_org_member(id));
DROP POLICY IF EXISTS "Users create organizations" ON public.organizations;
CREATE POLICY "Users create organizations" ON public.organizations FOR INSERT WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS "Owners update organizations" ON public.organizations;
CREATE POLICY "Owners update organizations" ON public.organizations FOR UPDATE USING (owner_id = auth.uid() OR public.is_org_member(id, array['owner','admin'])) WITH CHECK (owner_id = auth.uid() OR public.is_org_member(id, array['owner','admin']));

DROP POLICY IF EXISTS "Members read organization members" ON public.organization_members;
CREATE POLICY "Members read organization members" ON public.organization_members FOR SELECT USING (user_id = auth.uid() OR public.is_org_member(organization_id));
DROP POLICY IF EXISTS "Owners add organization members" ON public.organization_members;
CREATE POLICY "Owners add organization members" ON public.organization_members FOR INSERT WITH CHECK (user_id = auth.uid() OR public.is_org_member(organization_id, array['owner','admin']));
DROP POLICY IF EXISTS "Admins update organization members" ON public.organization_members;
CREATE POLICY "Admins update organization members" ON public.organization_members FOR UPDATE USING (public.is_org_member(organization_id, array['owner','admin'])) WITH CHECK (public.is_org_member(organization_id, array['owner','admin']));
DROP POLICY IF EXISTS "Admins remove organization members" ON public.organization_members;
CREATE POLICY "Admins remove organization members" ON public.organization_members FOR DELETE USING (public.is_org_member(organization_id, array['owner','admin']) OR user_id = auth.uid());

DROP POLICY IF EXISTS "Admins read invitations" ON public.team_invitations;
CREATE POLICY "Admins read invitations" ON public.team_invitations FOR SELECT USING (public.is_org_member(organization_id, array['owner','admin']) OR lower(email) = lower(coalesce(auth.jwt()->>'email','')));
DROP POLICY IF EXISTS "Admins update invitations" ON public.team_invitations;
CREATE POLICY "Admins update invitations" ON public.team_invitations FOR UPDATE USING (public.is_org_member(organization_id, array['owner','admin'])) WITH CHECK (public.is_org_member(organization_id, array['owner','admin']));

DROP POLICY IF EXISTS "Users read asset locations" ON public.asset_locations;
CREATE POLICY "Users read asset locations" ON public.asset_locations FOR SELECT USING (owner_id = auth.uid() OR (organization_id IS NOT NULL AND public.is_org_member(organization_id)));
DROP POLICY IF EXISTS "Editors create asset locations" ON public.asset_locations;
CREATE POLICY "Editors create asset locations" ON public.asset_locations FOR INSERT WITH CHECK (owner_id = auth.uid() AND (organization_id IS NULL OR public.is_org_member(organization_id, array['owner','admin','editor'])));
DROP POLICY IF EXISTS "Editors update asset locations" ON public.asset_locations;
CREATE POLICY "Editors update asset locations" ON public.asset_locations FOR UPDATE USING (owner_id = auth.uid() OR (organization_id IS NOT NULL AND public.is_org_member(organization_id, array['owner','admin','editor']))) WITH CHECK (owner_id = auth.uid() OR (organization_id IS NOT NULL AND public.is_org_member(organization_id, array['owner','admin','editor'])));
DROP POLICY IF EXISTS "Editors delete asset locations" ON public.asset_locations;
CREATE POLICY "Editors delete asset locations" ON public.asset_locations FOR DELETE USING (owner_id = auth.uid() OR (organization_id IS NOT NULL AND public.is_org_member(organization_id, array['owner','admin'])));

DROP POLICY IF EXISTS "Owners read assets" ON public.assets;
CREATE POLICY "Owners and members read assets" ON public.assets FOR SELECT USING (public.can_read_asset(assets));
DROP POLICY IF EXISTS "Owners insert assets" ON public.assets;
CREATE POLICY "Owners and editors insert assets" ON public.assets FOR INSERT WITH CHECK (owner_id = auth.uid() AND (organization_id IS NULL OR public.is_org_member(organization_id, array['owner','admin','editor'])));
DROP POLICY IF EXISTS "Owners update assets" ON public.assets;
CREATE POLICY "Owners and editors update assets" ON public.assets FOR UPDATE USING (public.can_edit_asset(assets)) WITH CHECK (public.can_edit_asset(assets));
DROP POLICY IF EXISTS "Owners delete assets" ON public.assets;
CREATE POLICY "Owners and admins delete assets" ON public.assets FOR DELETE USING (owner_id = auth.uid() OR (organization_id IS NOT NULL AND public.is_org_member(organization_id, array['owner','admin'])));

DROP POLICY IF EXISTS "Owners read photos" ON public.asset_photos;
CREATE POLICY "Asset members read photos" ON public.asset_photos FOR SELECT USING (EXISTS (SELECT 1 FROM public.assets a WHERE a.id = asset_id AND public.can_read_asset(a)));
DROP POLICY IF EXISTS "Owners insert photos" ON public.asset_photos;
CREATE POLICY "Asset editors insert photos" ON public.asset_photos FOR INSERT WITH CHECK (owner_id = auth.uid() AND EXISTS (SELECT 1 FROM public.assets a WHERE a.id = asset_id AND public.can_edit_asset(a)));
DROP POLICY IF EXISTS "Owners delete photos" ON public.asset_photos;
CREATE POLICY "Asset editors delete photos" ON public.asset_photos FOR DELETE USING (EXISTS (SELECT 1 FROM public.assets a WHERE a.id = asset_id AND public.can_edit_asset(a)));

DROP POLICY IF EXISTS "Owners read documents" ON public.asset_documents;
CREATE POLICY "Asset members read documents" ON public.asset_documents FOR SELECT USING (EXISTS (SELECT 1 FROM public.assets a WHERE a.id = asset_id AND public.can_read_asset(a)));
DROP POLICY IF EXISTS "Owners insert documents" ON public.asset_documents;
CREATE POLICY "Asset editors insert documents" ON public.asset_documents FOR INSERT WITH CHECK (owner_id = auth.uid() AND EXISTS (SELECT 1 FROM public.assets a WHERE a.id = asset_id AND public.can_edit_asset(a)));
DROP POLICY IF EXISTS "Owners delete documents" ON public.asset_documents;
CREATE POLICY "Asset editors delete documents" ON public.asset_documents FOR DELETE USING (EXISTS (SELECT 1 FROM public.assets a WHERE a.id = asset_id AND public.can_edit_asset(a)));

DROP POLICY IF EXISTS "Owners read theft reports" ON public.theft_reports;
CREATE POLICY "Asset members read theft reports" ON public.theft_reports FOR SELECT USING (EXISTS (SELECT 1 FROM public.assets a WHERE a.id = asset_id AND public.can_read_asset(a)));
DROP POLICY IF EXISTS "Owners insert theft reports" ON public.theft_reports;
CREATE POLICY "Asset editors insert theft reports" ON public.theft_reports FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.assets a WHERE a.id = asset_id AND public.can_edit_asset(a)));
DROP POLICY IF EXISTS "Owners update theft reports" ON public.theft_reports;
CREATE POLICY "Asset editors update theft reports" ON public.theft_reports FOR UPDATE USING (EXISTS (SELECT 1 FROM public.assets a WHERE a.id = asset_id AND public.can_edit_asset(a))) WITH CHECK (EXISTS (SELECT 1 FROM public.assets a WHERE a.id = asset_id AND public.can_edit_asset(a)));

DROP POLICY IF EXISTS "Users read transfers" ON public.ownership_transfers;
CREATE POLICY "Users read transfers" ON public.ownership_transfers FOR SELECT USING (from_owner_id = auth.uid() OR accepted_by = auth.uid() OR lower(coalesce(recipient_email,'')) = lower(coalesce(auth.jwt()->>'email','')));
DROP POLICY IF EXISTS "Owners update transfers" ON public.ownership_transfers;
CREATE POLICY "Owners update transfers" ON public.ownership_transfers FOR UPDATE USING (from_owner_id = auth.uid()) WITH CHECK (from_owner_id = auth.uid());

DROP POLICY IF EXISTS "Asset members read audit" ON public.asset_audit_log;
CREATE POLICY "Asset members read audit" ON public.asset_audit_log FOR SELECT USING (EXISTS (SELECT 1 FROM public.assets a WHERE a.id = asset_id AND public.can_read_asset(a)));

-- Storage access through the asset UUID stored in path segment 2.
DROP POLICY IF EXISTS "Users read own asset photos" ON storage.objects;
DROP POLICY IF EXISTS "Team members read asset photos" ON storage.objects;
CREATE POLICY "Team members read asset photos" ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'asset-photos' AND
  EXISTS (SELECT 1 FROM public.assets a WHERE a.id::text = (storage.foldername(name))[2] AND public.can_read_asset(a))
);
DROP POLICY IF EXISTS "Users read own documents" ON storage.objects;
DROP POLICY IF EXISTS "Team members read documents" ON storage.objects;
CREATE POLICY "Team members read documents" ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'ownership-documents' AND
  EXISTS (SELECT 1 FROM public.assets a WHERE a.id::text = (storage.foldername(name))[2] AND public.can_read_asset(a))
);

DROP POLICY IF EXISTS "Users delete own asset photos" ON storage.objects;
DROP POLICY IF EXISTS "Team editors delete asset photos" ON storage.objects;
CREATE POLICY "Team editors delete asset photos" ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'asset-photos' AND
  EXISTS (SELECT 1 FROM public.assets a WHERE a.id::text = (storage.foldername(name))[2] AND public.can_edit_asset(a))
);
DROP POLICY IF EXISTS "Users delete own documents" ON storage.objects;
DROP POLICY IF EXISTS "Team editors delete documents" ON storage.objects;
CREATE POLICY "Team editors delete documents" ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'ownership-documents' AND
  EXISTS (SELECT 1 FROM public.assets a WHERE a.id::text = (storage.foldername(name))[2] AND public.can_edit_asset(a))
);

-- Audit trail
create or replace function public.set_asset_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists assets_updated_at_trigger on public.assets;
create trigger assets_updated_at_trigger before update on public.assets for each row execute procedure public.set_asset_updated_at();

create or replace function public.log_asset_audit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.asset_audit_log(asset_id, actor_id, action, changes) values (new.id, auth.uid(), 'asset_registered', to_jsonb(new));
  elsif tg_op = 'UPDATE' then
    insert into public.asset_audit_log(asset_id, actor_id, action, changes)
    values (new.id, auth.uid(), case when old.status is distinct from new.status then 'status_changed' else 'asset_updated' end,
      jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new)));
  end if;
  return new;
end;
$$;
drop trigger if exists assets_audit_trigger on public.assets;
create trigger assets_audit_trigger after insert or update on public.assets for each row execute procedure public.log_asset_audit();

-- Plan limits, enforced in the database.
create or replace function public.plan_asset_limit(tier text)
returns integer language sql immutable as $$
  select case tier when 'starter' then 25 when 'pro' then 250 when 'team' then 2000 when 'fleet' then 10000 else 25 end;
$$;
create or replace function public.enforce_asset_plan_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare current_tier text; current_count integer; maximum integer;
begin
  if new.organization_id is not null then
    select plan_tier into current_tier from public.organizations where id = new.organization_id;
    select count(*) into current_count from public.assets where organization_id = new.organization_id;
  else
    select plan_tier into current_tier from public.profiles where id = new.owner_id;
    select count(*) into current_count from public.assets where owner_id = new.owner_id and organization_id is null;
  end if;
  maximum := public.plan_asset_limit(coalesce(current_tier, 'starter'));
  if current_count >= maximum then raise exception 'Your ToolTrack plan allows up to % assets.', maximum; end if;
  return new;
end;
$$;
drop trigger if exists assets_plan_limit_trigger on public.assets;
create trigger assets_plan_limit_trigger before insert on public.assets for each row execute procedure public.enforce_asset_plan_limit();

-- Invitation acceptance.
create or replace function public.accept_team_invitation(invitation_token text)
returns text language plpgsql security definer set search_path = public as $$
declare invite public.team_invitations; user_email text;
begin
  if auth.uid() is null then raise exception 'Sign in required.'; end if;
  select * into invite from public.team_invitations where token = invitation_token and status = 'pending' and expires_at > now();
  if invite.id is null then raise exception 'Invitation is invalid or expired.'; end if;
  user_email := lower(coalesce(auth.jwt()->>'email',''));
  if user_email <> lower(invite.email) then raise exception 'Sign in using the invited email address.'; end if;
  insert into public.organization_members(organization_id, user_id, role, status) values(invite.organization_id, auth.uid(), invite.role, 'active') on conflict (organization_id,user_id) do update set role=excluded.role,status='active';
  update public.team_invitations set status='accepted' where id=invite.id;
  update public.profiles set active_organization_id=invite.organization_id where id=auth.uid();
  return 'Invitation accepted. Shared assets are now visible in your dashboard.';
end;
$$;
grant execute on function public.accept_team_invitation(text) to authenticated;

-- Ownership transfer acceptance.
create or replace function public.accept_asset_transfer(p_code text)
returns text language plpgsql security definer set search_path = public as $$
declare transfer public.ownership_transfers; user_email text;
begin
  if auth.uid() is null then raise exception 'Sign in required.'; end if;
  select * into transfer from public.ownership_transfers where upper(transfer_code)=upper(p_code) and status='pending' and expires_at > now() for update;
  if transfer.id is null then raise exception 'Transfer code is invalid or expired.'; end if;
  user_email := lower(coalesce(auth.jwt()->>'email',''));
  if transfer.recipient_email is not null and lower(transfer.recipient_email) <> user_email then raise exception 'Sign in using the recipient email address.'; end if;
  if transfer.from_owner_id = auth.uid() then raise exception 'You cannot transfer an asset to the same account.'; end if;
  update public.assets set owner_id=auth.uid(), organization_id=null, status='safe' where id=transfer.asset_id;
  update public.asset_photos set owner_id=auth.uid() where asset_id=transfer.asset_id;
  update public.asset_documents set owner_id=auth.uid() where asset_id=transfer.asset_id;
  update public.theft_reports set owner_id=auth.uid() where asset_id=transfer.asset_id;
  update public.ownership_transfers set status='accepted', accepted_by=auth.uid(), accepted_at=now() where id=transfer.id;
  return 'Transfer accepted. The asset is now in your ToolTrack account.';
end;
$$;
grant execute on function public.accept_asset_transfer(text) to authenticated;

-- Existing accounts receive sensible defaults.
update public.profiles set plan_tier = case account_type when 'tradesperson' then 'pro' when 'business' then 'team' when 'hire_company' then 'fleet' else 'starter' end where plan_tier is null or plan_tier = '';


-- ToolTrack V4.1 repair and clean-up migration
-- Run once after the V4 migration.

create extension if not exists pgcrypto;

-- Platform administrators. The oldest beta account is bootstrapped as super-admin when none exists.
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('admin','super_admin')),
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.platform_admins where user_id=auth.uid());
$$;
grant execute on function public.is_platform_admin() to authenticated;

drop policy if exists "Admins read own platform role" on public.platform_admins;
create policy "Admins read own platform role" on public.platform_admins for select to authenticated using (user_id=auth.uid());

insert into public.platform_admins(user_id,role)
select id,'super_admin' from auth.users
where not exists(select 1 from public.platform_admins)
order by created_at asc limit 1
on conflict (user_id) do nothing;

-- Shop catalogue and prototype orders.
create table if not exists public.shop_products (
 id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique, description text, category text not null default 'Security',
 price_cents integer not null check(price_cents>=0), stock_quantity integer not null default 0 check(stock_quantity>=0), is_active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- Compatibility with the earlier beta shop table, which used `active` instead of `is_active`.
alter table public.shop_products
  add column if not exists is_active boolean not null default true;
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='shop_products' and column_name='active'
  ) then
    execute 'update public.shop_products set is_active = coalesce(active, true)';
  end if;
end $$;

create table if not exists public.shop_orders (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','processing','dispatched','completed','cancelled')), total_cents integer not null default 0 check(total_cents>=0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.shop_order_items (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.shop_orders(id) on delete cascade, product_id uuid references public.shop_products(id) on delete set null,
 product_name text not null, quantity integer not null check(quantity>0), unit_price_cents integer not null check(unit_price_cents>=0)
);
create index if not exists shop_orders_user_idx on public.shop_orders(user_id,created_at desc);
create index if not exists shop_order_items_order_idx on public.shop_order_items(order_id);
alter table public.shop_products enable row level security; alter table public.shop_orders enable row level security; alter table public.shop_order_items enable row level security;

drop policy if exists "Public read active products" on public.shop_products; create policy "Public read active products" on public.shop_products for select using(is_active=true or public.is_platform_admin());
drop policy if exists "Admins insert products" on public.shop_products; create policy "Admins insert products" on public.shop_products for insert to authenticated with check(public.is_platform_admin());
drop policy if exists "Admins update products" on public.shop_products; create policy "Admins update products" on public.shop_products for update to authenticated using(public.is_platform_admin()) with check(public.is_platform_admin());
drop policy if exists "Admins delete products" on public.shop_products; create policy "Admins delete products" on public.shop_products for delete to authenticated using(public.is_platform_admin());
drop policy if exists "Users read own orders" on public.shop_orders; create policy "Users read own orders" on public.shop_orders for select to authenticated using(user_id=auth.uid() or public.is_platform_admin());
drop policy if exists "Users create own orders" on public.shop_orders; create policy "Users create own orders" on public.shop_orders for insert to authenticated with check(user_id=auth.uid());
drop policy if exists "Admins update orders" on public.shop_orders; create policy "Admins update orders" on public.shop_orders for update to authenticated using(public.is_platform_admin()) with check(public.is_platform_admin());
drop policy if exists "Users read own order items" on public.shop_order_items; create policy "Users read own order items" on public.shop_order_items for select to authenticated using(exists(select 1 from public.shop_orders o where o.id=order_id and (o.user_id=auth.uid() or public.is_platform_admin())));
drop policy if exists "Users create own order items" on public.shop_order_items; create policy "Users create own order items" on public.shop_order_items for insert to authenticated with check(exists(select 1 from public.shop_orders o where o.id=order_id and o.user_id=auth.uid()));

insert into public.shop_products(name,slug,description,category,price_cents,stock_quantity,is_active) values
 ('Security marker pen','security-marker-pen','UV ownership marking','Marker & paint',899,50,true),
 ('ToolTrack QR tags','tooltrack-qr-tags','20 tamper-evident labels','Tags',1499,40,true),
 ('Bluetooth tracker','bluetooth-tracker','Compact tool-case tracker','Trackers',2499,25,true),
 ('Heavy-duty padlock','heavy-duty-padlock','Hardened shackle','Locks',1899,30,true),
 ('Van lock','van-lock','Additional rear-door security','Van security',6899,12,true),
 ('Ground anchor','ground-anchor','Workshop and garage fixing','Locks',4999,18,true)
on conflict(slug) do nothing;

-- Team invitation preview and decline.
create or replace function public.get_team_invitation_preview(invitation_token text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare i public.team_invitations; org_name text; begin
 select * into i from public.team_invitations where token=invitation_token;
 if i.id is null then raise exception 'Invitation not found.'; end if;
 select name into org_name from public.organizations where id=i.organization_id;
 return jsonb_build_object('organization_name',coalesce(org_name,'ToolTrack team'),'role',i.role,'email',i.email,'expires_at',i.expires_at,'status',i.status);
end; $$;
grant execute on function public.get_team_invitation_preview(text) to anon,authenticated;

create or replace function public.decline_team_invitation(invitation_token text)
returns text language plpgsql security definer set search_path=public as $$
declare i public.team_invitations; user_email text; begin
 if auth.uid() is null then raise exception 'Sign in required.'; end if;
 select * into i from public.team_invitations where token=invitation_token and status='pending';
 if i.id is null then raise exception 'Invitation is invalid or no longer pending.'; end if;
 user_email:=lower(coalesce(auth.jwt()->>'email','')); if user_email<>lower(i.email) then raise exception 'Sign in using the invited email address.'; end if;
 update public.team_invitations set status='cancelled' where id=i.id; return 'Invitation declined.';
end; $$;
grant execute on function public.decline_team_invitation(text) to authenticated;

-- Remove any legacy asset trigger left by an earlier beta that writes integer values into boolean columns.
do $$ declare r record; begin
 for r in select tgname from pg_trigger where tgrelid='public.assets'::regclass and not tgisinternal loop execute format('drop trigger if exists %I on public.assets',r.tgname); end loop;
end $$;
create or replace function public.set_asset_updated_at() returns trigger language plpgsql as $$ begin new.updated_at:=now(); return new; end; $$;
create trigger assets_updated_at_trigger before update on public.assets for each row execute procedure public.set_asset_updated_at();
create or replace function public.log_asset_audit() returns trigger language plpgsql security definer set search_path=public as $$ begin if tg_op='INSERT' then insert into public.asset_audit_log(asset_id,actor_id,action,changes) values(new.id,auth.uid(),'asset_registered',to_jsonb(new)); elsif tg_op='UPDATE' then insert into public.asset_audit_log(asset_id,actor_id,action,changes) values(new.id,auth.uid(),case when old.status is distinct from new.status then 'status_changed' else 'asset_updated' end,jsonb_build_object('before',to_jsonb(old),'after',to_jsonb(new))); end if; return new; end; $$;
create trigger assets_audit_trigger after insert or update on public.assets for each row execute procedure public.log_asset_audit();
create trigger assets_plan_limit_trigger before insert on public.assets for each row execute procedure public.enforce_asset_plan_limit();
