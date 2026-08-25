create index if not exists chat_messages_organization_idx on public.chat_messages(organization_id) where organization_id is not null;
create index if not exists chat_messages_user_idx on public.chat_messages(user_id);
create index if not exists comment_reactions_user_idx on public.comment_reactions(user_id);
create index if not exists comments_author_idx on public.comments(author_id);
create index if not exists comments_parent_idx on public.comments(parent_id) where parent_id is not null;
create index if not exists communities_creator_idx on public.communities(creator_id);
create index if not exists community_join_requests_user_idx on public.community_join_requests(user_id);
create index if not exists conversations_created_by_idx on public.conversations(created_by);
create index if not exists direct_messages_sender_idx on public.direct_messages(sender_id);
create index if not exists incident_support_user_idx on public.incident_support(user_id);
create index if not exists incidents_organization_idx on public.incidents(organization_id) where organization_id is not null;
create index if not exists incidents_user_idx on public.incidents(user_id);
create index if not exists notifications_actor_idx on public.notifications(actor_id) where actor_id is not null;
create index if not exists organization_members_user_idx on public.organization_members(user_id);
create index if not exists organizations_created_by_idx on public.organizations(created_by);
create index if not exists post_reactions_user_idx on public.post_reactions(user_id);
create index if not exists posts_author_idx on public.posts(author_id);
create index if not exists reports_reporter_idx on public.reports(reporter_id);

create or replace function private.add_organization_creator_membership()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.organization_members(organization_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict (organization_id, user_id) do nothing;
  return new;
end; $$;
revoke all on function private.add_organization_creator_membership() from public, anon, authenticated;
drop trigger if exists organizations_add_creator on public.organizations;
create trigger organizations_add_creator after insert on public.organizations for each row execute function private.add_organization_creator_membership();

create or replace function private.add_community_creator_membership()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.community_members(community_id, user_id, role, status)
  values (new.id, new.creator_id, 'owner', 'active')
  on conflict (community_id, user_id) do nothing;
  return new;
end; $$;
revoke all on function private.add_community_creator_membership() from public, anon, authenticated;
drop trigger if exists communities_add_creator on public.communities;
create trigger communities_add_creator after insert on public.communities for each row execute function private.add_community_creator_membership();

create or replace function private.add_conversation_creator_membership()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.conversation_members(conversation_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict (conversation_id, user_id) do nothing;
  return new;
end; $$;
revoke all on function private.add_conversation_creator_membership() from public, anon, authenticated;
drop trigger if exists conversations_add_creator on public.conversations;
create trigger conversations_add_creator after insert on public.conversations for each row execute function private.add_conversation_creator_membership();

create or replace function private.refresh_incident_support_count()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare target_id uuid;
begin
  target_id := coalesce(new.incident_id, old.incident_id);
  update public.incidents
  set support_count = (select count(*)::integer from public.incident_support s where s.incident_id = target_id)
  where id = target_id;
  return coalesce(new, old);
end; $$;
revoke all on function private.refresh_incident_support_count() from public, anon, authenticated;
drop trigger if exists incident_support_count_after_insert on public.incident_support;
drop trigger if exists incident_support_count_after_delete on public.incident_support;
create trigger incident_support_count_after_insert after insert on public.incident_support for each row execute function private.refresh_incident_support_count();
create trigger incident_support_count_after_delete after delete on public.incident_support for each row execute function private.refresh_incident_support_count();

alter policy "Users read own metrics" on public.user_metrics using (user_id = (select auth.uid()));
alter policy "Users insert own metrics" on public.user_metrics with check (user_id = (select auth.uid()));
alter policy "Users update own metrics" on public.user_metrics using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy "Users create organizations" on public.organizations with check (created_by = (select auth.uid()));
alter policy "Members read organizations" on public.organizations using (created_by = (select auth.uid()) or private.is_org_member(id));
alter policy "Owners add memberships" on public.organization_members with check (private.is_org_owner(organization_id) or exists (select 1 from public.organizations o where o.id = organization_id and o.created_by = (select auth.uid())));
alter policy "Authenticated users read allowed incidents" on public.incidents using ((workspace_mode = 'community' and status = 'published') or user_id = (select auth.uid()) or (workspace_mode = 'corporate' and organization_id is not null and private.is_org_member(organization_id)));
alter policy "Authenticated users insert allowed incidents" on public.incidents with check (user_id = (select auth.uid()) and ((workspace_mode = 'community' and organization_id is null) or (workspace_mode = 'corporate' and organization_id is not null and private.is_org_member(organization_id))));
alter policy "Users update own incidents" on public.incidents using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy "Users read own support rows" on public.incident_support using (user_id = (select auth.uid()));
create policy "Users insert own support rows" on public.incident_support for insert to authenticated with check (user_id = (select auth.uid()) and exists (select 1 from public.incidents i where i.id = incident_id and ((i.workspace_mode = 'community' and i.status = 'published') or i.user_id = (select auth.uid()) or (i.workspace_mode = 'corporate' and i.organization_id is not null and private.is_org_member(i.organization_id)))));
alter policy "Authenticated users read allowed messages" on public.chat_messages using ((workspace_mode = 'community' and status = 'published') or user_id = (select auth.uid()) or (workspace_mode = 'corporate' and organization_id is not null and private.is_org_member(organization_id)));
alter policy "Authenticated users insert allowed messages" on public.chat_messages with check (user_id = (select auth.uid()) and ((workspace_mode = 'community' and organization_id is null) or (workspace_mode = 'corporate' and organization_id is not null and private.is_org_member(organization_id))));
alter policy "Users delete own messages" on public.chat_messages using (user_id = (select auth.uid()));

alter policy profiles_insert_own on public.profiles with check (user_id = (select auth.uid()));
alter policy profiles_update_own on public.profiles using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy communities_insert_own on public.communities for insert to authenticated with check (creator_id = (select auth.uid()));
alter policy communities_delete_owner on public.communities using (private.is_community_owner(id));
drop policy if exists community_members_owner_insert on public.community_members;
create policy community_members_insert_allowed on public.community_members for insert to authenticated with check (private.is_community_owner(community_id) or (private.is_community_mod(community_id) and role = 'member' and status = 'active') or (user_id = (select auth.uid()) and role = 'member' and status = 'active' and exists (select 1 from public.communities c where c.id = community_id and c.visibility = 'public')));
drop policy if exists join_requests_cancel_own on public.community_join_requests;
drop policy if exists join_requests_update_mod on public.community_join_requests;
create policy join_requests_update_allowed on public.community_join_requests for update to authenticated using (user_id = (select auth.uid()) or private.is_community_mod(community_id)) with check ((user_id = (select auth.uid()) and status in ('pending','canceled')) or private.is_community_mod(community_id));
alter policy join_requests_insert_own on public.community_join_requests with check (user_id = (select auth.uid()));
alter policy join_requests_read on public.community_join_requests using (user_id = (select auth.uid()) or private.is_community_mod(community_id));

alter policy posts_read on public.posts using (author_id = (select auth.uid()) or (status = 'published' and (community_id is null or private.can_view_community(community_id))));
alter policy posts_insert on public.posts with check (author_id = (select auth.uid()) and (community_id is null or private.is_community_member(community_id)));
alter policy posts_update on public.posts using (author_id = (select auth.uid()) or (community_id is not null and private.is_community_mod(community_id))) with check ((author_id = (select auth.uid()) and (community_id is null or private.is_community_member(community_id))) or (community_id is not null and private.is_community_mod(community_id)));
alter policy posts_delete on public.posts using (author_id = (select auth.uid()) or (community_id is not null and private.is_community_mod(community_id)));
alter policy comments_read on public.comments using (author_id = (select auth.uid()) or (status = 'published' and private.can_view_post(post_id)));
alter policy comments_insert on public.comments with check (author_id = (select auth.uid()) and private.can_view_post(post_id));
alter policy comments_update on public.comments using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()) and private.can_view_post(post_id));
alter policy comments_delete on public.comments using (author_id = (select auth.uid()) or exists (select 1 from public.posts p where p.id = post_id and p.community_id is not null and private.is_community_mod(p.community_id)));
alter policy post_reactions_insert on public.post_reactions with check (user_id = (select auth.uid()) and private.can_view_post(post_id));
alter policy post_reactions_update on public.post_reactions using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and private.can_view_post(post_id));
alter policy post_reactions_delete on public.post_reactions using (user_id = (select auth.uid()));
alter policy comment_reactions_insert on public.comment_reactions with check (user_id = (select auth.uid()) and exists (select 1 from public.comments c where c.id = comment_id and private.can_view_post(c.post_id)));
alter policy comment_reactions_update on public.comment_reactions using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and exists (select 1 from public.comments c where c.id = comment_id and private.can_view_post(c.post_id)));
alter policy comment_reactions_delete on public.comment_reactions using (user_id = (select auth.uid()));
alter policy follows_read on public.follows using (follower_id = (select auth.uid()) or followed_id = (select auth.uid()));
alter policy follows_insert on public.follows with check (follower_id = (select auth.uid()));
alter policy follows_delete on public.follows using (follower_id = (select auth.uid()));
alter policy notifications_read_own on public.notifications using (recipient_id = (select auth.uid()));
alter policy notifications_update_own on public.notifications using (recipient_id = (select auth.uid())) with check (recipient_id = (select auth.uid()));
alter policy notifications_delete_own on public.notifications using (recipient_id = (select auth.uid()));
alter policy reports_read on public.reports using (reporter_id = (select auth.uid()) or (community_id is not null and private.is_community_mod(community_id)));
alter policy reports_insert on public.reports with check (reporter_id = (select auth.uid()));

create policy conversations_insert_own on public.conversations for insert to authenticated with check (created_by = (select auth.uid()));
alter policy conversations_read on public.conversations using (created_by = (select auth.uid()) or private.is_conversation_member(id));
alter policy conversations_delete on public.conversations using (created_by = (select auth.uid()));
alter policy conversation_members_insert on public.conversation_members with check (exists (select 1 from public.conversations c where c.id = conversation_id and c.created_by = (select auth.uid())));
alter policy conversation_members_update on public.conversation_members using (user_id = (select auth.uid()) or exists (select 1 from public.conversations c where c.id = conversation_id and c.created_by = (select auth.uid()))) with check (user_id = (select auth.uid()) or exists (select 1 from public.conversations c where c.id = conversation_id and c.created_by = (select auth.uid())));
alter policy conversation_members_delete on public.conversation_members using (user_id = (select auth.uid()) or exists (select 1 from public.conversations c where c.id = conversation_id and c.created_by = (select auth.uid())));
alter policy direct_messages_insert on public.direct_messages with check (sender_id = (select auth.uid()) and private.is_conversation_member(conversation_id));
alter policy direct_messages_update on public.direct_messages using (sender_id = (select auth.uid())) with check (sender_id = (select auth.uid()) and private.is_conversation_member(conversation_id));
alter policy direct_messages_delete on public.direct_messages using (sender_id = (select auth.uid()));

create or replace function public.bootstrap_profile() returns void language plpgsql security invoker set search_path = public, pg_temp as $$ begin if auth.uid() is null then raise exception 'Authentication required'; end if; insert into public.profiles(user_id) values (auth.uid()) on conflict do nothing; insert into public.user_metrics(user_id) values (auth.uid()) on conflict do nothing; end; $$;
create or replace function public.create_organization(org_name text) returns uuid language plpgsql security invoker set search_path = public, pg_temp as $$ declare new_org_id uuid; begin if auth.uid() is null then raise exception 'Authentication required'; end if; insert into public.organizations(name, created_by) values (org_name, auth.uid()) returning id into new_org_id; return new_org_id; end; $$;
create or replace function public.create_community(community_name text, community_slug text, community_description text default null, community_visibility text default 'public') returns uuid language plpgsql security invoker set search_path = public, pg_temp as $$ declare new_id uuid; begin if auth.uid() is null then raise exception 'Authentication required'; end if; insert into public.communities(creator_id, slug, name, description, visibility) values (auth.uid(), lower(community_slug), community_name, community_description, community_visibility) returning id into new_id; return new_id; end; $$;
create or replace function public.join_community(target_community uuid, request_message text default null) returns text language plpgsql security invoker set search_path = public, pg_temp as $$ declare vis text; member_status text; begin if auth.uid() is null then raise exception 'Authentication required'; end if; select visibility into vis from public.communities where id = target_community; if vis is null then raise exception 'Community not found or not visible'; end if; select status into member_status from public.community_members where community_id = target_community and user_id = auth.uid(); if member_status = 'active' then return 'joined'; end if; if member_status in ('muted','banned') then raise exception 'Membership is not eligible for self-reactivation'; end if; if vis = 'public' then insert into public.community_members(community_id, user_id, role, status) values (target_community, auth.uid(), 'member', 'active'); return 'joined'; end if; insert into public.community_join_requests(community_id,user_id,message,status) values (target_community,auth.uid(),request_message,'pending') on conflict (community_id,user_id) do update set message=excluded.message,status='pending',updated_at=now(); return 'requested'; end; $$;
create or replace function public.review_join_request(request_id uuid, decision text) returns void language plpgsql security invoker set search_path = public, pg_temp as $$ declare target_community uuid; target_user uuid; begin if auth.uid() is null then raise exception 'Authentication required'; end if; if decision not in ('approved','declined') then raise exception 'Decision must be approved or declined'; end if; select community_id, user_id into target_community, target_user from public.community_join_requests where id = request_id and status = 'pending'; if target_community is null then raise exception 'Pending request not found'; end if; if not private.is_community_mod(target_community) then raise exception 'Moderator access required'; end if; update public.community_join_requests set status = decision, updated_at = now() where id = request_id; if decision = 'approved' then insert into public.community_members(community_id, user_id, role, status) values (target_community, target_user, 'member', 'active') on conflict (community_id, user_id) do update set role = 'member', status = 'active'; end if; end; $$;
create or replace function public.start_conversation(peer_id uuid) returns uuid language plpgsql security invoker set search_path = public, pg_temp as $$ declare new_id uuid; begin if auth.uid() is null then raise exception 'Authentication required'; end if; if peer_id = auth.uid() then raise exception 'Choose another member'; end if; insert into public.conversations(created_by,kind) values (auth.uid(),'direct') returning id into new_id; insert into public.conversation_members(conversation_id,user_id,role) values (new_id,peer_id,'member'); return new_id; end; $$;
create or replace function public.support_incident(target_incident_id uuid) returns integer language plpgsql security invoker set search_path = public, pg_temp as $$ declare new_count integer; begin if auth.uid() is null then raise exception 'Authentication required'; end if; insert into public.incident_support (incident_id, user_id) values (target_incident_id, auth.uid()) on conflict do nothing; select support_count into new_count from public.incidents where id = target_incident_id; if new_count is null then raise exception 'Incident is not accessible'; end if; return new_count; end; $$;

revoke all on function public.bootstrap_profile() from public, anon;
revoke all on function public.create_organization(text) from public, anon;
revoke all on function public.create_community(text,text,text,text) from public, anon;
revoke all on function public.join_community(uuid,text) from public, anon;
revoke all on function public.review_join_request(uuid,text) from public, anon;
revoke all on function public.start_conversation(uuid) from public, anon;
revoke all on function public.support_incident(uuid) from public, anon;
grant execute on function public.bootstrap_profile() to authenticated;
grant execute on function public.create_organization(text) to authenticated;
grant execute on function public.create_community(text,text,text,text) to authenticated;
grant execute on function public.join_community(uuid,text) to authenticated;
grant execute on function public.review_join_request(uuid,text) to authenticated;
grant execute on function public.start_conversation(uuid) to authenticated;
grant execute on function public.support_incident(uuid) to authenticated;
