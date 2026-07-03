-- ToolTrack V4.7.5
-- Shop checkout helper for safe stock updates. Repeatable.

create or replace function public.decrement_shop_stock(
  p_product_id uuid,
  p_quantity integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_quantity < 1 then
    raise exception 'Invalid stock quantity.';
  end if;

  update public.shop_products
  set stock_quantity = stock_quantity - p_quantity,
      updated_at = now()
  where id = p_product_id
    and stock_quantity >= p_quantity;

  if not found then
    raise exception 'Product stock could not be updated.';
  end if;
end;
$$;

revoke all on function public.decrement_shop_stock(uuid, integer) from public;
grant execute on function public.decrement_shop_stock(uuid, integer) to service_role;
