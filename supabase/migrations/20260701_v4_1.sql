-- ToolTrack V4.1 migration
-- Run once after the V4 migration.

create extension if not exists pgcrypto;

-- Community-grown make/model catalogue.
alter table public.product_catalogue
  add column if not exists community_count integer not null default 0,
  add column if not exists verification_status text not null default 'verified',
  add column if not exists last_seen_at timestamptz;

alter table public.product_catalogue drop constraint if exists product_catalogue_verification_status_check;
alter table public.product_catalogue add constraint product_catalogue_verification_status_check
  check (verification_status in ('verified','community','review'));

create or replace function public.normalise_catalogue_text(value text)
returns text language sql immutable as $$
  select lower(regexp_replace(coalesce(value,''), '[^a-zA-Z0-9]+', '', 'g'));
$$;

create or replace function public.refresh_asset_catalogue_candidate()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  matching_count integer;
  existing_id uuid;
  generated_key text;
  common_category text;
begin
  if trim(coalesce(new.make,'')) = '' or trim(coalesce(new.model,'')) = '' then return new; end if;

  select count(*), mode() within group (order by category)
    into matching_count, common_category
  from public.assets
  where public.normalise_catalogue_text(make) = public.normalise_catalogue_text(new.make)
    and public.normalise_catalogue_text(model) = public.normalise_catalogue_text(new.model);

  select id into existing_id
  from public.product_catalogue
  where public.normalise_catalogue_text(make) = public.normalise_catalogue_text(new.make)
    and public.normalise_catalogue_text(model) = public.normalise_catalogue_text(new.model)
  order by case when verification_status = 'verified' then 0 else 1 end
  limit 1;

  if existing_id is not null then
    update public.product_catalogue
      set community_count = matching_count,
          last_seen_at = now(),
          updated_at = now()
      where id = existing_id;
  else
    generated_key := 'community-' || md5(public.normalise_catalogue_text(new.make) || '|' || public.normalise_catalogue_text(new.model));
    insert into public.product_catalogue
      (catalogue_key, make, model, category, manufacturer_part_number, source, is_active, community_count, verification_status, last_seen_at)
    values
      (generated_key, trim(new.make), trim(new.model), coalesce(common_category, new.category), trim(new.model), 'ToolTrack community catalogue', matching_count, matching_count >= 5, case when matching_count >= 5 then 'community' else 'review' end, now())
    on conflict (catalogue_key) do update set
      category = excluded.category,
      community_count = excluded.community_count,
      is_active = excluded.community_count >= 5,
      verification_status = case when excluded.community_count >= 5 then 'community' else 'review' end,
      last_seen_at = now(),
      updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists assets_catalogue_candidate_trigger on public.assets;
create trigger assets_catalogue_candidate_trigger
after insert or update of make, model, category on public.assets
for each row execute procedure public.refresh_asset_catalogue_candidate();

-- Backfill counts from assets that were already registered before V4.1.
do $$
declare
  candidate record;
  existing_id uuid;
  generated_key text;
begin
  for candidate in
    select min(make) as make, min(model) as model, mode() within group (order by category) as category, count(*)::integer as matching_count
    from public.assets
    where trim(coalesce(make,'')) <> '' and trim(coalesce(model,'')) <> ''
    group by public.normalise_catalogue_text(make), public.normalise_catalogue_text(model)
  loop
    select id into existing_id from public.product_catalogue
    where public.normalise_catalogue_text(make) = public.normalise_catalogue_text(candidate.make)
      and public.normalise_catalogue_text(model) = public.normalise_catalogue_text(candidate.model)
    order by case when verification_status = 'verified' then 0 else 1 end limit 1;
    if existing_id is not null then
      update public.product_catalogue set community_count = candidate.matching_count, last_seen_at = now(), updated_at = now() where id = existing_id;
    else
      generated_key := 'community-' || md5(public.normalise_catalogue_text(candidate.make) || '|' || public.normalise_catalogue_text(candidate.model));
      insert into public.product_catalogue(catalogue_key, make, model, category, manufacturer_part_number, source, is_active, community_count, verification_status, last_seen_at)
      values(generated_key, candidate.make, candidate.model, candidate.category, candidate.model, 'ToolTrack community catalogue', candidate.matching_count >= 5, candidate.matching_count, case when candidate.matching_count >= 5 then 'community' else 'review' end, now())
      on conflict (catalogue_key) do update set community_count=excluded.community_count, is_active=excluded.is_active, verification_status=excluded.verification_status, last_seen_at=now(), updated_at=now();
    end if;
  end loop;
end $$;

-- Shop backend.
create sequence if not exists public.shop_order_number_seq start 1001;

create table if not exists public.shop_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.shop_products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  slug text not null unique,
  name text not null,
  description text,
  category text not null,
  price_cents integer not null check (price_cents >= 0),
  compare_at_price_cents integer check (compare_at_price_cents is null or compare_at_price_cents >= price_cents),
  currency text not null default 'EUR',
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  image_url text,
  active boolean not null default true,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists shop_products_category_idx on public.shop_products(category);
create index if not exists shop_products_active_idx on public.shop_products(active);

create table if not exists public.shop_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('TT-' || lpad(nextval('public.shop_order_number_seq')::text, 6, '0')),
  user_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'beta_pending' check (status in ('beta_pending','pending_payment','paid','processing','shipped','completed','cancelled')),
  payment_status text not null default 'not_charged' check (payment_status in ('not_charged','pending','paid','failed','refunded')),
  subtotal_cents integer not null default 0,
  shipping_cents integer not null default 0,
  total_cents integer not null default 0,
  currency text not null default 'EUR',
  contact_name text not null,
  contact_email text not null,
  contact_phone text,
  shipping_address jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists shop_orders_user_idx on public.shop_orders(user_id, created_at desc);
create index if not exists shop_orders_status_idx on public.shop_orders(status, created_at desc);

create table if not exists public.shop_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.shop_orders(id) on delete cascade,
  product_id uuid references public.shop_products(id) on delete set null,
  sku text not null,
  product_name text not null,
  unit_price_cents integer not null,
  quantity integer not null check (quantity > 0 and quantity <= 100),
  line_total_cents integer not null,
  created_at timestamptz not null default now()
);
create index if not exists shop_order_items_order_idx on public.shop_order_items(order_id);

alter table public.shop_admins enable row level security;
alter table public.shop_products enable row level security;
alter table public.shop_orders enable row level security;
alter table public.shop_order_items enable row level security;

create or replace function public.is_shop_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.shop_admins where user_id = auth.uid());
$$;
grant execute on function public.is_shop_admin() to authenticated;

DROP POLICY IF EXISTS "Public read active shop products" ON public.shop_products;
CREATE POLICY "Public read active shop products" ON public.shop_products FOR SELECT USING (active = true OR public.is_shop_admin());
DROP POLICY IF EXISTS "Shop admins manage products" ON public.shop_products;
CREATE POLICY "Shop admins manage products" ON public.shop_products FOR ALL TO authenticated USING (public.is_shop_admin()) WITH CHECK (public.is_shop_admin());

DROP POLICY IF EXISTS "Users read own shop orders" ON public.shop_orders;
CREATE POLICY "Users read own shop orders" ON public.shop_orders FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_shop_admin());
DROP POLICY IF EXISTS "Shop admins update orders" ON public.shop_orders;
CREATE POLICY "Shop admins update orders" ON public.shop_orders FOR UPDATE TO authenticated USING (public.is_shop_admin()) WITH CHECK (public.is_shop_admin());
DROP POLICY IF EXISTS "Users read own order items" ON public.shop_order_items;
CREATE POLICY "Users read own order items" ON public.shop_order_items FOR SELECT TO authenticated USING (exists(select 1 from public.shop_orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_shop_admin())));
DROP POLICY IF EXISTS "Users see own admin record" ON public.shop_admins;
CREATE POLICY "Users see own admin record" ON public.shop_admins FOR SELECT TO authenticated USING (user_id = auth.uid());

insert into public.shop_products (sku, slug, name, description, category, price_cents, compare_at_price_cents, stock_quantity, featured)
values
  ('TT-MARKER-001','security-marker-pen','Security marker pen','UV ownership marking pen for tools and equipment.','Marker & paint',899,null,50,true),
  ('TT-QR-020','tooltrack-qr-tags-20','ToolTrack QR tags','Pack of 20 tamper-evident asset labels.','Tags',1499,null,100,true),
  ('TT-BT-001','bluetooth-tracker','Bluetooth tracker','Compact tracker suitable for a tool case or storage box.','Trackers',2499,null,25,true),
  ('TT-PADLOCK-001','heavy-duty-padlock','Heavy-duty padlock','Hardened shackle padlock for sheds and tool storage.','Locks',1899,null,40,false),
  ('TT-VANLOCK-001','van-lock','Van lock','Additional rear-door security lock for commercial vehicles.','Van security',6899,null,10,true),
  ('TT-ANCHOR-001','ground-anchor','Ground anchor','Workshop or garage fixing point for chains and locks.','Locks',4999,null,15,false)
on conflict (sku) do update set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  price_cents = excluded.price_cents,
  stock_quantity = excluded.stock_quantity,
  active = true,
  updated_at = now();
