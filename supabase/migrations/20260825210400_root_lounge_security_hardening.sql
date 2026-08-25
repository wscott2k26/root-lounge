create or replace function private.is_community_owner(target_community uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.community_members m
    where m.community_id = target_community
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role = 'owner'
  );
$$;

grant execute on function private.is_community_owner(uuid) to authenticated;

drop policy if exists communities_insert on public.communities;
drop policy if exists community_members_manage_mod_insert on public.community_members;
drop policy if exists community_members_manage_mod_update on public.community_members;
drop policy if exists community_members_manage_mod_delete on public.community_members;
drop policy if exists join_requests_update on public.community_join_requests;
drop policy if exists posts_update on public.posts;
drop policy if exists comments_update on public.comments;
drop policy if exists post_reactions_update on public.post_reactions;
drop policy if exists comment_reactions_update on public.comment_reactions;
drop policy if exists conversations_insert on public.conversations;
drop policy if exists direct_messages_update on public.direct_messages;

create policy community_members_owner_insert on public.community_members
for insert to authenticated
with check (private.is_community_owner(community_id));

create policy community_members_owner_update on public.community_members
for update to authenticated
using (private.is_community_owner(community_id))
with check (private.is_community_owner(community_id));

create policy community_members_owner_delete on public.community_members
for delete to authenticated
using (private.is_community_owner(community_id));

create policy join_requests_cancel_own on public.community_join_requests
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid() and status = 'canceled');

create policy join_requests_update_mod on public.community_join_requests
for update to authenticated
using (private.is_community_mod(community_id))
with check (private.is_community_mod(community_id));

create policy posts_update on public.posts
for update to authenticated
using (
  author_id = auth.uid()
  or (community_id is not null and private.is_community_mod(community_id))
)
with check (
  (author_id = auth.uid() and (community_id is null or private.is_community_member(community_id)))
  or (community_id is not null and private.is_community_mod(community_id))
);

create policy comments_update on public.comments
for update to authenticated
using (author_id = auth.uid())
with check (author_id = auth.uid() and private.can_view_post(post_id));

create policy post_reactions_update on public.post_reactions
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid() and private.can_view_post(post_id));

create policy comment_reactions_update on public.comment_reactions
for update to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.comments c
    where c.id = comment_id and private.can_view_post(c.post_id)
  )
);

create policy direct_messages_update on public.direct_messages
for update to authenticated
using (sender_id = auth.uid())
with check (sender_id = auth.uid() and private.is_conversation_member(conversation_id));

create or replace function private.refresh_community_member_count()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_id uuid;
begin
  target_id := coalesce(new.community_id, old.community_id);
  update public.communities
  set member_count = (
    select count(*)::integer
    from public.community_members m
    where m.community_id = target_id and m.status = 'active'
  )
  where id = target_id;
  return coalesce(new, old);
end;
$$;

drop trigger if exists community_members_count_after_insert on public.community_members;
drop trigger if exists community_members_count_after_delete on public.community_members;
drop trigger if exists community_members_count_after_status on public.community_members;
create trigger community_members_count_after_insert
after insert on public.community_members
for each row execute function private.refresh_community_member_count();
create trigger community_members_count_after_delete
after delete on public.community_members
for each row execute function private.refresh_community_member_count();
create trigger community_members_count_after_status
after update of status on public.community_members
for each row execute function private.refresh_community_member_count();

create or replace function public.review_join_request(request_id uuid, decision text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_community uuid;
  target_user uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if decision not in ('approved','declined') then raise exception 'Decision must be approved or declined'; end if;

  select community_id, user_id
  into target_community, target_user
  from public.community_join_requests
  where id = request_id and status = 'pending';

  if target_community is null then raise exception 'Pending request not found'; end if;
  if not private.is_community_mod(target_community) then raise exception 'Moderator access required'; end if;

  update public.community_join_requests
  set status = decision, updated_at = now()
  where id = request_id;

  if decision = 'approved' then
    insert into public.community_members(community_id, user_id, role, status)
    values (target_community, target_user, 'member', 'active')
    on conflict (community_id, user_id)
    do update set role = 'member', status = 'active';
  end if;
end;
$$;

grant execute on function public.review_join_request(uuid,text) to authenticated;

revoke all on function private.assert_safe_lounge_text(text) from public, anon, authenticated;
revoke all on function private.moderate_incident_before_write() from public, anon, authenticated;
revoke all on function private.moderate_message_before_write() from public, anon, authenticated;
revoke all on function private.moderate_post_before_write() from public, anon, authenticated;
revoke all on function private.moderate_comment_before_write() from public, anon, authenticated;
revoke all on function private.moderate_dm_before_write() from public, anon, authenticated;
revoke all on function private.set_updated_at() from public, anon, authenticated;
revoke all on function private.refresh_post_comment_count() from public, anon, authenticated;
revoke all on function private.refresh_post_reaction_count() from public, anon, authenticated;
revoke all on function private.refresh_comment_reaction_count() from public, anon, authenticated;
revoke all on function private.refresh_community_member_count() from public, anon, authenticated;

revoke all on function private.is_org_member(uuid) from public, anon;
revoke all on function private.is_org_owner(uuid) from public, anon;
revoke all on function private.is_community_member(uuid) from public, anon;
revoke all on function private.is_community_mod(uuid) from public, anon;
revoke all on function private.is_community_owner(uuid) from public, anon;
revoke all on function private.can_view_community(uuid) from public, anon;
revoke all on function private.can_view_post(uuid) from public, anon;
revoke all on function private.is_conversation_member(uuid) from public, anon;

grant execute on function private.is_org_member(uuid) to authenticated;
grant execute on function private.is_org_owner(uuid) to authenticated;
grant execute on function private.is_community_member(uuid) to authenticated;
grant execute on function private.is_community_mod(uuid) to authenticated;
grant execute on function private.is_community_owner(uuid) to authenticated;
grant execute on function private.can_view_community(uuid) to authenticated;
grant execute on function private.can_view_post(uuid) to authenticated;
grant execute on function private.is_conversation_member(uuid) to authenticated;

revoke all on function public.support_incident(uuid) from public, anon;
revoke all on function public.create_organization(text) from public, anon;
revoke all on function public.bootstrap_profile() from public, anon;
revoke all on function public.create_community(text,text,text,text) from public, anon;
revoke all on function public.join_community(uuid,text) from public, anon;
revoke all on function public.start_conversation(uuid) from public, anon;
revoke all on function public.review_join_request(uuid,text) from public, anon;

grant execute on function public.support_incident(uuid) to authenticated;
grant execute on function public.create_organization(text) to authenticated;
grant execute on function public.bootstrap_profile() to authenticated;
grant execute on function public.create_community(text,text,text,text) to authenticated;
grant execute on function public.join_community(uuid,text) to authenticated;
grant execute on function public.start_conversation(uuid) to authenticated;
grant execute on function public.review_join_request(uuid,text) to authenticated;
