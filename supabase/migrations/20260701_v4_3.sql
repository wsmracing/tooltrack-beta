-- ToolTrack V4.3
-- Full shop catalogue, product images, detailed product pages and order status repair.
-- Safe to run after the V4.2 migration.

create extension if not exists pgcrypto;

-- Expand the product catalogue while remaining compatible with older beta tables.
alter table public.shop_products add column if not exists sku text;
alter table public.shop_products add column if not exists full_description text;
alter table public.shop_products add column if not exists manufacturer text;
alter table public.shop_products add column if not exists model text;
alter table public.shop_products add column if not exists warranty text;
alter table public.shop_products add column if not exists features text[] not null default '{}'::text[];
alter table public.shop_products add column if not exists specifications jsonb not null default '{}'::jsonb;
alter table public.shop_products add column if not exists sale_price_cents integer;
alter table public.shop_products add column if not exists is_featured boolean not null default false;
alter table public.shop_products add column if not exists is_active boolean not null default true;
alter table public.shop_products add column if not exists updated_at timestamptz not null default now();

update public.shop_products
set sku = 'TT-' || upper(substr(replace(id::text, '-', ''), 1, 12))
where sku is null or btrim(sku) = '';

alter table public.shop_products
  alter column sku set default ('TT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)));

update public.shop_products set features = '{}'::text[] where features is null;
update public.shop_products set specifications = '{}'::jsonb where specifications is null;
update public.shop_products set is_featured = false where is_featured is null;
update public.shop_products set is_active = true where is_active is null;

-- Copy the old beta visibility field where it exists.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'shop_products' and column_name = 'active'
  ) then
    execute 'update public.shop_products set is_active = coalesce(active, is_active, true)';
  end if;
end $$;

-- Price validation, including optional sale prices.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.shop_products'::regclass
      and conname = 'shop_products_sale_price_check'
  ) then
    alter table public.shop_products
      add constraint shop_products_sale_price_check
      check (sale_price_cents is null or sale_price_cents >= 0);
  end if;
end $$;

create or replace function public.set_shop_product_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists shop_products_updated_at_trigger on public.shop_products;
create trigger shop_products_updated_at_trigger
before update on public.shop_products
for each row execute procedure public.set_shop_product_updated_at();

-- Keep the old `active` field and new `is_active` field aligned when both exist.
create or replace function public.sync_shop_product_active_columns()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.active := coalesce(new.is_active, new.active, true);
    new.is_active := new.active;
  elsif new.is_active is distinct from old.is_active then
    new.active := new.is_active;
  elsif new.active is distinct from old.active then
    new.is_active := new.active;
  end if;
  return new;
end;
$$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'shop_products' and column_name = 'active'
  ) then
    execute 'drop trigger if exists shop_products_active_sync_trigger on public.shop_products';
    execute 'create trigger shop_products_active_sync_trigger before insert or update on public.shop_products for each row execute procedure public.sync_shop_product_active_columns()';
  end if;
end $$;

-- Product image gallery.
create table if not exists public.shop_product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.shop_products(id) on delete cascade,
  storage_path text not null unique,
  alt_text text,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists shop_product_images_product_idx
  on public.shop_product_images(product_id, is_primary desc, sort_order, created_at);

alter table public.shop_product_images enable row level security;

drop policy if exists "Public read shop product images" on public.shop_product_images;
create policy "Public read shop product images"
on public.shop_product_images for select
using (true);

drop policy if exists "Admins insert shop product images" on public.shop_product_images;
create policy "Admins insert shop product images"
on public.shop_product_images for insert to authenticated
with check (public.is_platform_admin());

drop policy if exists "Admins update shop product images" on public.shop_product_images;
create policy "Admins update shop product images"
on public.shop_product_images for update to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "Admins delete shop product images" on public.shop_product_images;
create policy "Admins delete shop product images"
on public.shop_product_images for delete to authenticated
using (public.is_platform_admin());

-- Public storage bucket for shop imagery. Admin uploads remain protected by policy.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'shop-product-images',
  'shop-product-images',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public view shop product image files" on storage.objects;
create policy "Public view shop product image files"
on storage.objects for select
using (bucket_id = 'shop-product-images');

drop policy if exists "Admins upload shop product image files" on storage.objects;
create policy "Admins upload shop product image files"
on storage.objects for insert to authenticated
with check (bucket_id = 'shop-product-images' and public.is_platform_admin());

drop policy if exists "Admins update shop product image files" on storage.objects;
create policy "Admins update shop product image files"
on storage.objects for update to authenticated
using (bucket_id = 'shop-product-images' and public.is_platform_admin())
with check (bucket_id = 'shop-product-images' and public.is_platform_admin());

drop policy if exists "Admins delete shop product image files" on storage.objects;
create policy "Admins delete shop product image files"
on storage.objects for delete to authenticated
using (bucket_id = 'shop-product-images' and public.is_platform_admin());

-- Repair the order status values and constraint so the admin dropdown matches the database.
alter table public.shop_orders add column if not exists updated_at timestamptz not null default now();
alter table public.shop_orders add column if not exists status_updated_at timestamptz;
alter table public.shop_orders add column if not exists status_updated_by uuid references auth.users(id) on delete set null;

update public.shop_orders
set status = case lower(status)
  when 'shipped' then 'dispatched'
  when 'fulfilled' then 'delivered'
  when 'complete' then 'completed'
  when 'pending' then 'pending'
  when 'processing' then 'processing'
  when 'dispatched' then 'dispatched'
  when 'delivered' then 'delivered'
  when 'completed' then 'completed'
  when 'cancelled' then 'cancelled'
  when 'canceled' then 'cancelled'
  else 'pending'
end;

do $$
declare constraint_record record;
begin
  for constraint_record in
    select conname
    from pg_constraint
    where conrelid = 'public.shop_orders'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.shop_orders drop constraint %I', constraint_record.conname);
  end loop;
end $$;

alter table public.shop_orders
  add constraint shop_orders_status_check
  check (status in ('pending', 'processing', 'dispatched', 'delivered', 'completed', 'cancelled'));

create or replace function public.set_shop_order_status_metadata()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if new.status is distinct from old.status then
    new.status_updated_at := now();
    new.status_updated_by := coalesce(auth.uid(), new.status_updated_by);
  end if;
  return new;
end;
$$;

drop trigger if exists shop_orders_status_metadata_trigger on public.shop_orders;
create trigger shop_orders_status_metadata_trigger
before update on public.shop_orders
for each row execute procedure public.set_shop_order_status_metadata();

-- Improve the starter catalogue so detailed product pages are useful immediately.
update public.shop_products
set full_description = coalesce(full_description, description),
    features = case when cardinality(features) = 0 then array['Designed for tool and asset security', 'Suitable for everyday workshop or van use'] else features end,
    specifications = case when specifications = '{}'::jsonb then jsonb_build_object('Category', category) else specifications end
where true;

update public.shop_products
set warranty = coalesce(warranty, 'Manufacturer terms apply')
where warranty is null;
