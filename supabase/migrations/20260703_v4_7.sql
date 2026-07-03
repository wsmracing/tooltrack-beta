-- ToolTrack V4.7
-- Checkout reliability and saved delivery details.
-- Run once after the V4.5 migration. Repeatable.

create extension if not exists pgcrypto;

alter table public.profiles add column if not exists address_line1 text;
alter table public.profiles add column if not exists address_line2 text;
alter table public.profiles add column if not exists city text;
alter table public.profiles add column if not exists county text;
alter table public.profiles add column if not exists eircode text;
alter table public.profiles add column if not exists country text not null default 'Ireland';

create or replace function public.place_shop_order(
  p_contact_name text,
  p_contact_email text,
  p_contact_phone text,
  p_delivery_address jsonb,
  p_items jsonb
)
returns table(order_id uuid, order_number text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_order_number text;
  v_subtotal integer := 0;
  v_item jsonb;
  v_product public.shop_products;
  v_quantity integer;
begin
  if auth.uid() is null then raise exception 'Sign in required.'; end if;
  if nullif(btrim(p_contact_name), '') is null then raise exception 'Contact name is required.'; end if;
  if nullif(btrim(p_contact_email), '') is null then raise exception 'Contact email is required.'; end if;
  if nullif(btrim(p_contact_phone), '') is null then raise exception 'Contact phone is required.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Your basket is empty.'; end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := greatest(coalesce((v_item->>'quantity')::integer, 0), 0);
    if v_quantity < 1 then raise exception 'Invalid basket quantity.'; end if;

    select * into v_product
    from public.shop_products
    where id = (v_item->>'product_id')::uuid and is_active = true
    for update;

    if v_product.id is null then raise exception 'A product in your basket is no longer available.'; end if;
    if v_product.stock_quantity < v_quantity then raise exception '% does not have enough stock.', v_product.name; end if;

    v_subtotal := v_subtotal +
      (case when v_product.sale_price_cents is not null and v_product.sale_price_cents < v_product.price_cents
        then v_product.sale_price_cents else v_product.price_cents end) * v_quantity;
  end loop;

  v_order_number := 'TT-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.shop_orders(
    user_id, order_number, status, payment_status, subtotal_cents,
    delivery_cents, total_cents, currency, contact_name, contact_email,
    contact_phone, delivery_address
  ) values (
    auth.uid(), v_order_number, 'pending', 'not_charged', v_subtotal,
    0, v_subtotal, 'EUR', btrim(p_contact_name), lower(btrim(p_contact_email)),
    btrim(p_contact_phone), p_delivery_address
  ) returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item->>'quantity')::integer;
    select * into v_product from public.shop_products where id = (v_item->>'product_id')::uuid for update;

    insert into public.shop_order_items(
      order_id, product_id, product_name, quantity, unit_price_cents, line_total_cents
    ) values (
      v_order_id, v_product.id, v_product.name, v_quantity,
      case when v_product.sale_price_cents is not null and v_product.sale_price_cents < v_product.price_cents
        then v_product.sale_price_cents else v_product.price_cents end,
      (case when v_product.sale_price_cents is not null and v_product.sale_price_cents < v_product.price_cents
        then v_product.sale_price_cents else v_product.price_cents end) * v_quantity
    );

    update public.shop_products
    set stock_quantity = stock_quantity - v_quantity, updated_at = now()
    where id = v_product.id;
  end loop;

  return query select v_order_id, v_order_number;
end;
$$;

revoke all on function public.place_shop_order(text,text,text,jsonb,jsonb) from public;
grant execute on function public.place_shop_order(text,text,text,jsonb,jsonb) to authenticated;
