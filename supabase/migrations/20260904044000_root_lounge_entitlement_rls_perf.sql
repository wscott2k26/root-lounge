drop policy if exists "Users read own corporate entitlements" on public.corporate_entitlements;
create policy "Users read own corporate entitlements" on public.corporate_entitlements
for select to authenticated using (user_id = (select auth.uid()));
