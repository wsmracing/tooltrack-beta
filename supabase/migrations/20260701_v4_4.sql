-- ToolTrack V4.4
-- Mobile cleanup, checkout compatibility, transfer-code preview and order status repair.
-- Safe to run after V4.3. Statements are designed to be repeatable.

create extension if not exists pgcrypto;

-- Keep the shop order table compatible with every earlier beta version.
alter table public.shop_orders add column if not exists order_number text;
alter table public.shop_orders add column if not exists payment_status text not null default 'not_charged';
alter table public.shop_orders add column if not exists subtotal_cents integer not null default 0;
alter table public.shop_orders add column if not exists delivery_cents integer not null default 0;
alter table public.shop_orders add column if not exists currency text not null default 'EUR';
alter table public.shop_orders add column if not exists contact_name text;
alter table public.shop_orders add column if not exists contact_email text;
alter table public.shop_orders add column if not exists contact_phone text;
alter table public.shop_orders add column if not exists delivery_address jsonb;
alter table public.shop_orders add column if not exists notes text;
alter table public.shop_orders add column if not exists updated_at timestamptz not null default now();
alter table public.shop_orders add column if not exists status_updated_at timestamptz;
alter table public.shop_orders add column if not exists status_updated_by uuid references auth.users(id) on delete set null;

update public.shop_orders
set order_number = 'TT-' || upper(substr(replace(id::text, '-', ''), 1, 10))
where order_number is null or btrim(order_number) = '';

update public.shop_orders
set subtotal_cents = coalesce(nullif(subtotal_cents, 0), total_cents, 0),
    delivery_cents = coalesce(delivery_cents, 0),
    currency = coalesce(nullif(currency, ''), 'EUR'),
    payment_status = coalesce(nullif(payment_status, ''), 'not_charged'),
    contact_name = coalesce(nullif(contact_name, ''), 'ToolTrack customer'),
    contact_email = coalesce(contact_email, ''),
    contact_phone = coalesce(contact_phone, ''),
    delivery_address = coalesce(delivery_address, '{}'::jsonb),
    updated_at = coalesce(updated_at, created_at, now());

alter table public.shop_orders
  alter column order_number set default ('TT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  alter column payment_status set default 'not_charged',
  alter column subtotal_cents set default 0,
  alter column delivery_cents set default 0,
  alter column currency set default 'EUR',
  alter column contact_name set default 'ToolTrack customer',
  alter column contact_email set default '',
  alter column contact_phone set default '',
  alter column delivery_address set default '{}'::jsonb;

-- Drop every legacy status check before normalising values.
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

update public.shop_orders
set status = case lower(coalesce(status, 'pending'))
  when 'shipped' then 'dispatched'
  when 'fulfilled' then 'delivered'
  when 'complete' then 'completed'
  when 'canceled' then 'cancelled'
  when 'pending' then 'pending'
  when 'processing' then 'processing'
  when 'dispatched' then 'dispatched'
  when 'delivered' then 'delivered'
  when 'completed' then 'completed'
  when 'cancelled' then 'cancelled'
  else 'pending'
end;

alter table public.shop_orders
  add constraint shop_orders_status_check
  check (status in ('pending', 'processing', 'dispatched', 'delivered', 'completed', 'cancelled'));

-- Earlier order-item tables may require a line total.
alter table public.shop_order_items add column if not exists line_total_cents integer;
update public.shop_order_items
set line_total_cents = unit_price_cents * quantity
where line_total_cents is null;
alter table public.shop_order_items alter column line_total_cents set default 0;

-- Use a broad catalogue category for new shop products.
alter table public.shop_products alter column category set default 'Accessories';
update public.shop_products set category = 'Accessories' where category = 'Security';

-- Preview a transfer before ownership changes. The serial remains masked.
create or replace function public.get_asset_transfer_preview(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  transfer_record public.ownership_transfers;
  asset_record public.assets;
  clean_code text;
  masked_serial text;
begin
  clean_code := regexp_replace(upper(coalesce(p_code, '')), '[^A-Z0-9]', '', 'g');
  if clean_code = '' then raise exception 'Transfer code is required.'; end if;

  select * into transfer_record
  from public.ownership_transfers
  where regexp_replace(upper(transfer_code), '[^A-Z0-9]', '', 'g') = clean_code
    and status = 'pending'
    and expires_at > now();

  if transfer_record.id is null then
    raise exception 'Transfer code is invalid, expired or already used.';
  end if;

  select * into asset_record from public.assets where id = transfer_record.asset_id;
  if asset_record.id is null then raise exception 'The transferred asset could not be found.'; end if;

  masked_serial := case
    when length(asset_record.serial_original) <= 4 then repeat('•', greatest(length(asset_record.serial_original) - 1, 1)) || right(asset_record.serial_original, 1)
    else repeat('•', length(asset_record.serial_original) - 4) || right(asset_record.serial_original, 4)
  end;

  return jsonb_build_object(
    'make', asset_record.make,
    'model', asset_record.model,
    'category', asset_record.category,
    'serial_masked', masked_serial,
    'expires_at', transfer_record.expires_at,
    'recipient_restricted', transfer_record.recipient_email is not null
  );
end;
$$;
grant execute on function public.get_asset_transfer_preview(text) to anon, authenticated;

-- Accept codes with or without dashes/spaces.
create or replace function public.accept_asset_transfer(p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  transfer_record public.ownership_transfers;
  user_email text;
  clean_code text;
begin
  if auth.uid() is null then raise exception 'Sign in required.'; end if;
  clean_code := regexp_replace(upper(coalesce(p_code, '')), '[^A-Z0-9]', '', 'g');

  select * into transfer_record
  from public.ownership_transfers
  where regexp_replace(upper(transfer_code), '[^A-Z0-9]', '', 'g') = clean_code
    and status = 'pending'
    and expires_at > now()
  for update;

  if transfer_record.id is null then raise exception 'Transfer code is invalid, expired or already used.'; end if;
  user_email := lower(coalesce(auth.jwt()->>'email', ''));
  if transfer_record.recipient_email is not null and lower(transfer_record.recipient_email) <> user_email then
    raise exception 'Sign in using the recipient email address.';
  end if;
  if transfer_record.from_owner_id = auth.uid() then raise exception 'You cannot transfer an asset to the same account.'; end if;

  update public.assets set owner_id = auth.uid(), organization_id = null, status = 'safe' where id = transfer_record.asset_id;
  update public.asset_photos set owner_id = auth.uid() where asset_id = transfer_record.asset_id;
  update public.asset_documents set owner_id = auth.uid() where asset_id = transfer_record.asset_id;
  update public.theft_reports set owner_id = auth.uid() where asset_id = transfer_record.asset_id;
  update public.ownership_transfers set status = 'accepted', accepted_by = auth.uid(), accepted_at = now() where id = transfer_record.id;
  return 'Transfer accepted. The asset is now in your ToolTrack account.';
end;
$$;
grant execute on function public.accept_asset_transfer(text) to authenticated;
