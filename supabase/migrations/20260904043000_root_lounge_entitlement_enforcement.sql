create or replace function public.set_corporate_entitlement_status(
  p_subscription_id text,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_org uuid;
  target_user uuid;
begin
  if p_status not in ('active','past_due','unpaid','canceled','incomplete') then
    raise exception 'invalid entitlement status';
  end if;

  select organization_id, user_id into target_org, target_user
  from public.corporate_entitlements
  where subscription_id = p_subscription_id;

  if target_org is null or target_user is null then
    return;
  end if;

  update public.corporate_entitlements
    set status = p_status, updated_at = now()
    where subscription_id = p_subscription_id;

  if p_status = 'active' then
    insert into public.organization_members(organization_id, user_id, role)
      values (target_org, target_user, 'owner')
      on conflict (organization_id, user_id) do update set role = 'owner';
  else
    delete from public.organization_members
      where organization_id = target_org and user_id = target_user;
  end if;
end;
$$;

revoke all on function public.set_corporate_entitlement_status(text,text) from public, anon, authenticated;
grant execute on function public.set_corporate_entitlement_status(text,text) to service_role;
