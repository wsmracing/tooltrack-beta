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
