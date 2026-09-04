create table if not exists public.corporate_entitlements (
  subscription_id text primary key,
  stripe_session_id text unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id text,
  status text not null default 'active' check (status in ('active','past_due','unpaid','canceled','incomplete')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists corporate_entitlements_user_idx on public.corporate_entitlements(user_id);
create index if not exists corporate_entitlements_org_idx on public.corporate_entitlements(organization_id);

alter table public.corporate_entitlements enable row level security;
drop policy if exists "Users read own corporate entitlements" on public.corporate_entitlements;
create policy "Users read own corporate entitlements" on public.corporate_entitlements
for select to authenticated using (user_id = auth.uid());
revoke all on table public.corporate_entitlements from anon;
revoke insert, update, delete on table public.corporate_entitlements from authenticated;
grant select on table public.corporate_entitlements to authenticated;
grant select, insert, update, delete on table public.corporate_entitlements to service_role;

create table if not exists public.server_secrets (
  name text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.server_secrets enable row level security;
revoke all on table public.server_secrets from anon, authenticated;
grant select, insert, update, delete on table public.server_secrets to service_role;

create or replace function public.provision_corporate_entitlement(
  p_subscription_id text,
  p_session_id text,
  p_user_id uuid,
  p_customer_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_org uuid;
begin
  if p_subscription_id is null or char_length(trim(p_subscription_id)) < 4 then
    raise exception 'subscription id required';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'unknown Root Lounge user';
  end if;

  select organization_id into target_org
  from public.corporate_entitlements
  where subscription_id = p_subscription_id;

  if target_org is not null then
    update public.corporate_entitlements
      set status = 'active', stripe_session_id = coalesce(p_session_id, stripe_session_id),
          customer_id = coalesce(p_customer_id, customer_id), updated_at = now()
      where subscription_id = p_subscription_id;
    insert into public.organization_members(organization_id, user_id, role)
      values (target_org, p_user_id, 'owner')
      on conflict (organization_id, user_id) do update set role = 'owner';
    return target_org;
  end if;

  insert into public.organizations(name, created_by)
    values ('Root Lounge Team', p_user_id)
    returning id into target_org;

  insert into public.organization_members(organization_id, user_id, role)
    values (target_org, p_user_id, 'owner')
    on conflict (organization_id, user_id) do update set role = 'owner';

  insert into public.corporate_entitlements(
    subscription_id, stripe_session_id, user_id, organization_id, customer_id, status
  ) values (
    p_subscription_id, p_session_id, p_user_id, target_org, p_customer_id, 'active'
  );

  return target_org;
end;
$$;

create or replace function public.set_corporate_entitlement_status(
  p_subscription_id text,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_status not in ('active','past_due','unpaid','canceled','incomplete') then
    raise exception 'invalid entitlement status';
  end if;
  update public.corporate_entitlements
    set status = p_status, updated_at = now()
    where subscription_id = p_subscription_id;
end;
$$;

create or replace function public.revoke_corporate_entitlement(p_subscription_id text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_org uuid;
begin
  select organization_id into target_org
    from public.corporate_entitlements
    where subscription_id = p_subscription_id;
  if target_org is null then return; end if;
  update public.corporate_entitlements
    set status = 'canceled', updated_at = now()
    where subscription_id = p_subscription_id;
  delete from public.organization_members where organization_id = target_org;
end;
$$;

revoke all on function public.provision_corporate_entitlement(text,text,uuid,text) from public, anon, authenticated;
revoke all on function public.set_corporate_entitlement_status(text,text) from public, anon, authenticated;
revoke all on function public.revoke_corporate_entitlement(text) from public, anon, authenticated;
grant execute on function public.provision_corporate_entitlement(text,text,uuid,text) to service_role;
grant execute on function public.set_corporate_entitlement_status(text,text) to service_role;
grant execute on function public.revoke_corporate_entitlement(text) to service_role;

grant select, insert, update, delete on table public.payment_events to service_role;
grant select, insert, update, delete on table public.organizations to service_role;
grant select, insert, update, delete on table public.organization_members to service_role;
