create or replace function private.refresh_community_member_count()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_community uuid;
begin
  target_community := coalesce(new.community_id, old.community_id);
  update public.communities c
  set member_count = (
    select count(*)::integer
    from public.community_members m
    where m.community_id = target_community
      and m.status = 'active'
  )
  where c.id = target_community;
  return coalesce(new, old);
end;
$$;
revoke all on function private.refresh_community_member_count() from public, anon, authenticated;

drop trigger if exists community_members_refresh_count on public.community_members;
create trigger community_members_refresh_count
after insert or delete or update of status on public.community_members
for each row execute function private.refresh_community_member_count();

update public.communities c
set member_count = (
  select count(*)::integer
  from public.community_members m
  where m.community_id = c.id
    and m.status = 'active'
);

create or replace function private.notify_post_reaction()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_user uuid;
  target_title text;
begin
  select p.author_id, p.title into target_user, target_title
  from public.posts p where p.id = new.post_id;
  if target_user is null or target_user = new.user_id then return new; end if;
  insert into public.notifications(recipient_id, actor_id, notification_type, title, body, link_path, metadata)
  values (
    target_user,
    new.user_id,
    'reaction',
    'Your post got support',
    coalesce(left(target_title, 180), 'Someone supported your post.'),
    '/?view=community&post=' || new.post_id::text,
    jsonb_build_object('post_id', new.post_id, 'reaction', new.reaction)
  );
  return new;
end;
$$;
revoke all on function private.notify_post_reaction() from public, anon, authenticated;

drop trigger if exists notify_post_reaction on public.post_reactions;
create trigger notify_post_reaction
after insert on public.post_reactions
for each row execute function private.notify_post_reaction();

create or replace function private.notify_post_comment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_user uuid;
  target_title text;
begin
  select p.author_id, p.title into target_user, target_title
  from public.posts p where p.id = new.post_id;
  if target_user is null or target_user = new.author_id then return new; end if;
  insert into public.notifications(recipient_id, actor_id, notification_type, title, body, link_path, metadata)
  values (
    target_user,
    new.author_id,
    'comment',
    'New reply on your post',
    coalesce(left(target_title, 180), left(new.body, 180)),
    '/?view=community&post=' || new.post_id::text,
    jsonb_build_object('post_id', new.post_id, 'comment_id', new.id)
  );
  return new;
end;
$$;
revoke all on function private.notify_post_comment() from public, anon, authenticated;

drop trigger if exists notify_post_comment on public.comments;
create trigger notify_post_comment
after insert on public.comments
for each row execute function private.notify_post_comment();

create or replace function private.notify_follow()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_handle text;
begin
  if new.follower_id = new.followed_id then return new; end if;
  select p.handle into actor_handle from public.profiles p where p.user_id = new.follower_id;
  insert into public.notifications(recipient_id, actor_id, notification_type, title, body, link_path, metadata)
  values (
    new.followed_id,
    new.follower_id,
    'follow',
    'New follower',
    coalesce(actor_handle, 'An operator') || ' followed you.',
    '/?view=community&tab=people',
    jsonb_build_object('follower_id', new.follower_id)
  );
  return new;
end;
$$;
revoke all on function private.notify_follow() from public, anon, authenticated;

drop trigger if exists notify_follow on public.follows;
create trigger notify_follow
after insert on public.follows
for each row execute function private.notify_follow();

create or replace function private.touch_conversation_from_message()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.conversations
  set updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$;
revoke all on function private.touch_conversation_from_message() from public, anon, authenticated;

drop trigger if exists touch_conversation_from_message on public.direct_messages;
create trigger touch_conversation_from_message
after insert or update of body on public.direct_messages
for each row execute function private.touch_conversation_from_message();

create or replace function private.notify_direct_message()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.notifications(recipient_id, actor_id, notification_type, title, body, link_path, metadata)
  select
    m.user_id,
    new.sender_id,
    'message',
    'New direct message',
    left(new.body, 180),
    '/?view=community&tab=inbox&conversation=' || new.conversation_id::text,
    jsonb_build_object('conversation_id', new.conversation_id, 'message_id', new.id)
  from public.conversation_members m
  where m.conversation_id = new.conversation_id
    and m.user_id <> new.sender_id;
  return new;
end;
$$;
revoke all on function private.notify_direct_message() from public, anon, authenticated;

drop trigger if exists notify_direct_message on public.direct_messages;
create trigger notify_direct_message
after insert on public.direct_messages
for each row execute function private.notify_direct_message();

create or replace function private.notify_join_request()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  community_name text;
begin
  select c.name into community_name from public.communities c where c.id = new.community_id;
  if tg_op = 'INSERT' then
    insert into public.notifications(recipient_id, actor_id, notification_type, title, body, link_path, metadata)
    select
      m.user_id,
      new.user_id,
      'community',
      'New community join request',
      coalesce(community_name, 'A community') || ' has a new access request.',
      '/?view=community&tab=communities',
      jsonb_build_object('community_id', new.community_id, 'request_id', new.id)
    from public.community_members m
    where m.community_id = new.community_id
      and m.status = 'active'
      and m.role in ('owner','moderator')
      and m.user_id <> new.user_id;
  elsif old.status is distinct from new.status and new.status in ('approved','declined') then
    insert into public.notifications(recipient_id, actor_id, notification_type, title, body, link_path, metadata)
    values (
      new.user_id,
      auth.uid(),
      'community',
      case when new.status = 'approved' then 'Community access approved' else 'Community access declined' end,
      coalesce(community_name, 'Your community request') || case when new.status = 'approved' then ' is ready.' else ' was declined.' end,
      '/?view=community&tab=communities',
      jsonb_build_object('community_id', new.community_id, 'request_id', new.id, 'status', new.status)
    );
  end if;
  return new;
end;
$$;
revoke all on function private.notify_join_request() from public, anon, authenticated;

drop trigger if exists notify_join_request on public.community_join_requests;
create trigger notify_join_request
after insert or update of status on public.community_join_requests
for each row execute function private.notify_join_request();
