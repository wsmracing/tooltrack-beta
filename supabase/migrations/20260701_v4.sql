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
