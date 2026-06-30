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
