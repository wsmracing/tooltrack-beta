-- ToolTrack V4.5
-- Final web cleanup, seller verification, stronger transfers and evidence-status support.
-- Run after 20260701_v4_4.sql. Designed to be repeatable.

create extension if not exists pgcrypto;

-- Asset market and record-strength fields.
alter table public.assets add column if not exists market_status text not null default 'not_for_sale';
alter table public.assets add column if not exists sale_expires_at timestamptz;
alter table public.assets add column if not exists verification_level text not null default 'registered';

alter table public.assets drop constraint if exists assets_market_status_check;
alter table public.assets add constraint assets_market_status_check
  check (market_status in ('not_for_sale', 'for_sale', 'disputed'));
alter table public.assets drop constraint if exists assets_verification_level_check;
alter table public.assets add constraint assets_verification_level_check
  check (verification_level in ('registered', 'evidence_supplied', 'retailer_verified', 'transfer_history', 'disputed'));

update public.assets
set market_status = 'not_for_sale'
where market_status is null or market_status not in ('not_for_sale', 'for_sale', 'disputed');

update public.assets a
set verification_level = 'evidence_supplied'
where verification_level = 'registered'
  and (
    exists (select 1 from public.asset_documents d where d.asset_id = a.id)
    or exists (select 1 from public.asset_photos p where p.asset_id = a.id)
  );

-- Extra private sighting information for marketplace reports.
alter table public.sightings add column if not exists source_platform text;
alter table public.sightings add column if not exists seller_username text;
alter table public.sightings add column if not exists listing_title text;
alter table public.sightings add column if not exists asking_price_cents integer;
alter table public.sightings drop constraint if exists sightings_asking_price_check;
alter table public.sightings add constraint sightings_asking_price_check
  check (asking_price_cents is null or asking_price_cents >= 0);

-- Keep verification level in step with private evidence while preserving stronger states.
create or replace function public.refresh_asset_verification_level(p_asset_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.assets a
  set verification_level = case
    when a.verification_level in ('retailer_verified', 'transfer_history', 'disputed') then a.verification_level
    when exists (select 1 from public.asset_documents d where d.asset_id = a.id)
      or exists (select 1 from public.asset_photos p where p.asset_id = a.id)
      then 'evidence_supplied'
    else 'registered'
  end
  where a.id = p_asset_id;
end;
$$;
revoke all on function public.refresh_asset_verification_level(uuid) from public;

create or replace function public.refresh_asset_verification_from_evidence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_asset_verification_level(old.asset_id);
    return old;
  end if;
  perform public.refresh_asset_verification_level(new.asset_id);
  return new;
end;
$$;
revoke all on function public.refresh_asset_verification_from_evidence() from public;

drop trigger if exists asset_photos_verification_trigger on public.asset_photos;
create trigger asset_photos_verification_trigger
after insert or delete on public.asset_photos
for each row execute procedure public.refresh_asset_verification_from_evidence();

drop trigger if exists asset_documents_verification_trigger on public.asset_documents;
create trigger asset_documents_verification_trigger
after insert or delete on public.asset_documents
for each row execute procedure public.refresh_asset_verification_from_evidence();

-- Seller-control challenges. Direct browser access is intentionally denied;
-- trusted server routes use the service role after their own checks.
create table if not exists public.seller_confirmation_challenges (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  challenge_code_hash text not null,
  public_token uuid not null unique default gen_random_uuid(),
  status text not null default 'pending',
  expires_at timestamptz not null,
  confirmed_at timestamptz,
  confirmed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.seller_confirmation_challenges drop constraint if exists seller_confirmation_challenges_status_check;
alter table public.seller_confirmation_challenges add constraint seller_confirmation_challenges_status_check
  check (status in ('pending', 'confirmed', 'expired'));
create index if not exists seller_confirmation_asset_idx
  on public.seller_confirmation_challenges(asset_id, created_at desc);
create index if not exists seller_confirmation_expiry_idx
  on public.seller_confirmation_challenges(expires_at)
  where status = 'pending';
alter table public.seller_confirmation_challenges enable row level security;
revoke all on table public.seller_confirmation_challenges from anon, authenticated;

-- Transfer codes are stored as SHA-256 hashes. Remove the legacy uniqueness
-- requirement on the masked display column and backfill old plaintext codes.
alter table public.ownership_transfers add column if not exists transfer_code_hash text;
alter table public.ownership_transfers add column if not exists transfer_code_hint text;

do $$
declare constraint_record record;
begin
  for constraint_record in
    select conname
    from pg_constraint
    where conrelid = 'public.ownership_transfers'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) ilike '%transfer_code%'
      and pg_get_constraintdef(oid) not ilike '%transfer_code_hash%'
  loop
    execute format('alter table public.ownership_transfers drop constraint %I', constraint_record.conname);
  end loop;
end $$;

update public.ownership_transfers
set transfer_code_hash = encode(
      digest(regexp_replace(upper(transfer_code), '[^A-Z0-9]', '', 'g'), 'sha256'),
      'hex'
    ),
    transfer_code_hint = right(regexp_replace(upper(transfer_code), '[^A-Z0-9]', '', 'g'), 4)
where transfer_code_hash is null
  and length(regexp_replace(upper(transfer_code), '[^A-Z0-9]', '', 'g')) >= 4
  and transfer_code not like '••••%';

update public.ownership_transfers
set transfer_code_hint = coalesce(transfer_code_hint, right(regexp_replace(upper(transfer_code), '[^A-Z0-9]', '', 'g'), 4))
where transfer_code_hint is null;

update public.ownership_transfers
set transfer_code = '••••-••••-' || transfer_code_hint
where transfer_code_hash is not null
  and transfer_code_hint is not null
  and transfer_code not like '••••%';

with ranked_codes as (
  select id, row_number() over (partition by transfer_code_hash order by created_at desc, id desc) as code_rank
  from public.ownership_transfers
  where transfer_code_hash is not null
)
update public.ownership_transfers t
set transfer_code_hash = null
from ranked_codes r
where t.id = r.id and r.code_rank > 1;

create unique index if not exists ownership_transfers_code_hash_idx
  on public.ownership_transfers(transfer_code_hash)
  where transfer_code_hash is not null;

-- Preview a valid transfer without exposing the owner, raw serial or internal IDs.
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
  code_hash text;
  masked_serial text;
begin
  clean_code := regexp_replace(upper(coalesce(p_code, '')), '[^A-Z0-9]', '', 'g');
  if length(clean_code) < 4 or length(clean_code) > 64 then
    raise exception 'Transfer code is invalid, expired or already used.';
  end if;
  code_hash := encode(digest(clean_code, 'sha256'), 'hex');

  select * into transfer_record
  from public.ownership_transfers
  where transfer_code_hash = code_hash
    and status = 'pending'
    and expires_at > now()
  limit 1;

  if transfer_record.id is null then
    raise exception 'Transfer code is invalid, expired or already used.';
  end if;

  select * into asset_record from public.assets where id = transfer_record.asset_id;
  if asset_record.id is null then
    raise exception 'Transfer code is invalid, expired or already used.';
  end if;

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
revoke all on function public.get_asset_transfer_preview(text) from public;
grant execute on function public.get_asset_transfer_preview(text) to anon, authenticated;

-- The row lock, validation, ownership change and token consumption occur in one transaction.
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
  code_hash text;
begin
  if auth.uid() is null then raise exception 'Sign in required.'; end if;
  clean_code := regexp_replace(upper(coalesce(p_code, '')), '[^A-Z0-9]', '', 'g');
  if length(clean_code) < 4 or length(clean_code) > 64 then
    raise exception 'Transfer code is invalid, expired or already used.';
  end if;
  code_hash := encode(digest(clean_code, 'sha256'), 'hex');

  select * into transfer_record
  from public.ownership_transfers
  where transfer_code_hash = code_hash
    and status = 'pending'
    and expires_at > now()
  for update;

  if transfer_record.id is null then
    raise exception 'Transfer code is invalid, expired or already used.';
  end if;

  user_email := lower(coalesce(auth.jwt()->>'email', ''));
  if transfer_record.recipient_email is not null and lower(transfer_record.recipient_email) <> user_email then
    raise exception 'Sign in using the recipient email address.';
  end if;
  if transfer_record.from_owner_id = auth.uid() then
    raise exception 'You cannot transfer an asset to the same account.';
  end if;

  update public.assets
  set owner_id = auth.uid(),
      organization_id = null,
      status = 'safe',
      market_status = 'not_for_sale',
      sale_expires_at = null,
      verification_level = 'transfer_history'
  where id = transfer_record.asset_id;

  update public.asset_photos set owner_id = auth.uid() where asset_id = transfer_record.asset_id;
  update public.asset_documents set owner_id = auth.uid() where asset_id = transfer_record.asset_id;
  update public.theft_reports set owner_id = auth.uid() where asset_id = transfer_record.asset_id;

  update public.ownership_transfers
  set status = 'accepted', accepted_by = auth.uid(), accepted_at = now()
  where id = transfer_record.id and status = 'pending';

  insert into public.asset_audit_log(asset_id, actor_id, action, changes)
  values (
    transfer_record.asset_id,
    auth.uid(),
    'transfer_accepted',
    jsonb_build_object('from_owner_id', transfer_record.from_owner_id, 'transfer_id', transfer_record.id)
  );

  return 'Transfer accepted. The asset is now in your ToolTrack account.';
end;
$$;
revoke all on function public.accept_asset_transfer(text) from public;
grant execute on function public.accept_asset_transfer(text) to authenticated;

-- Expired sale labels should never remain effective indefinitely.
create or replace function public.clear_expired_asset_sale_status()
returns trigger
language plpgsql
as $$
begin
  if new.market_status = 'for_sale' and new.sale_expires_at is not null and new.sale_expires_at <= now() then
    new.market_status := 'not_for_sale';
    new.sale_expires_at := null;
  end if;
  return new;
end;
$$;
drop trigger if exists assets_sale_expiry_guard on public.assets;
create trigger assets_sale_expiry_guard
before insert or update on public.assets
for each row execute procedure public.clear_expired_asset_sale_status();
