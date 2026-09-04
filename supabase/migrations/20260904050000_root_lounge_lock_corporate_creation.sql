revoke insert, update, delete on table public.organizations from authenticated;
revoke insert, update, delete on table public.organization_members from authenticated;
revoke all on function public.create_organization(text) from public, anon, authenticated;
grant select on table public.organizations to authenticated;
grant select on table public.organization_members to authenticated;
