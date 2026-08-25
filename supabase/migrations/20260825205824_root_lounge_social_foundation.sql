create or replace function private.set_updated_at()
returns trigger language plpgsql set search_path = pg_catalog as $$ begin new.updated_at = now(); return new; end; $$;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  handle text check (handle is null or handle ~ '^[A-Za-z0-9_]{3,24}$'),
  display_name text check (display_name is null or char_length(display_name) between 1 and 80),
  bio text check (bio is null or char_length(bio) <= 600),
  avatar_url text,
  role_title text check (role_title is null or char_length(role_title) <= 80),
  interests text[] not null default '{}'::text[],
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index profiles_handle_lower_uidx on public.profiles(lower(handle)) where handle is not null;

create table public.communities (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{2,39}$'),
  name text not null check (char_length(name) between 2 and 80),
  description text check (description is null or char_length(description) <= 1200),
  visibility text not null default 'public' check (visibility in ('public','restricted','private')),
  icon_url text,
  banner_url text,
  rules jsonb not null default '[]'::jsonb check (jsonb_typeof(rules) = 'array'),
  member_count integer not null default 1 check (member_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index communities_slug_lower_uidx on public.communities(lower(slug));

create table public.community_members (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','moderator','member')),
  status text not null default 'active' check (status in ('active','muted','banned')),
  joined_at timestamptz not null default now(),
  primary key (community_id, user_id)
);

create table public.community_join_requests (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  message text check (message is null or char_length(message) <= 500),
  status text not null default 'pending' check (status in ('pending','approved','declined','canceled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(community_id, user_id)
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  community_id uuid references public.communities(id) on delete cascade,
  post_type text not null default 'discussion' check (post_type in ('discussion','question','poll','incident','win','resource')),
  title text check (title is null or char_length(title) between 1 and 240),
  body text not null check (char_length(body) between 1 and 12000),
  media_urls text[] not null default '{}'::text[],
  tags text[] not null default '{}'::text[],
  status text not null default 'published' check (status in ('published','review','hidden','removed')),
  is_pinned boolean not null default false,
  reaction_count integer not null default 0 check (reaction_count >= 0),
  comment_count integer not null default 0 check (comment_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 6000),
  media_urls text[] not null default '{}'::text[],
  status text not null default 'published' check (status in ('published','review','hidden','removed')),
  reaction_count integer not null default 0 check (reaction_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.post_reactions (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null check (reaction in ('support','same','helpful','funny','insightful','upvote')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.comment_reactions (
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null check (reaction in ('support','same','helpful','funny','insightful','upvote')),
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create table public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  followed_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  check (follower_id <> followed_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  notification_type text not null check (notification_type in ('reaction','comment','follow','mention','community','moderation','system','message')),
  title text not null check (char_length(title) between 1 and 160),
  body text check (body is null or char_length(body) <= 1000),
  link_path text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  community_id uuid references public.communities(id) on delete cascade,
  target_type text not null check (target_type in ('post','comment','message','profile','incident')),
  target_id uuid not null,
  reason text not null check (reason in ('spam','harassment','threat','unsafe_content','credential_leak','off_topic','other')),
  details text check (details is null or char_length(details) <= 1200),
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'direct' check (kind in ('direct','group')),
  title text check (title is null or char_length(title) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);

create table public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 6000),
  media_urls text[] not null default '{}'::text[],
  status text not null default 'published' check (status in ('published','review','hidden','removed')),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create index community_members_user_idx on public.community_members(user_id, status);
create index join_requests_community_status_idx on public.community_join_requests(community_id, status, created_at);
create index posts_feed_idx on public.posts(status, created_at desc);
create index posts_community_idx on public.posts(community_id, status, created_at desc);
create index comments_post_idx on public.comments(post_id, status, created_at);
create index follows_followed_idx on public.follows(followed_id, created_at desc);
create index notifications_recipient_idx on public.notifications(recipient_id, read_at, created_at desc);
create index reports_community_status_idx on public.reports(community_id, status, created_at);
create index conversation_members_user_idx on public.conversation_members(user_id, joined_at desc);
create index direct_messages_conversation_idx on public.direct_messages(conversation_id, created_at);

create or replace function private.is_community_member(target_community uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.community_members m where m.community_id = target_community and m.user_id = auth.uid() and m.status = 'active');
$$;
create or replace function private.is_community_mod(target_community uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.community_members m where m.community_id = target_community and m.user_id = auth.uid() and m.status = 'active' and m.role in ('owner','moderator'));
$$;
create or replace function private.can_view_community(target_community uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.communities c where c.id = target_community and (c.visibility in ('public','restricted') or private.is_community_member(c.id)));
$$;
create or replace function private.can_view_post(target_post uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.posts p where p.id = target_post and (p.author_id = auth.uid() or (p.status = 'published' and (p.community_id is null or private.can_view_community(p.community_id)))));
$$;
create or replace function private.is_conversation_member(target_conversation uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.conversation_members m where m.conversation_id = target_conversation and m.user_id = auth.uid());
$$;

grant execute on function private.is_community_member(uuid) to authenticated;
grant execute on function private.is_community_mod(uuid) to authenticated;
grant execute on function private.can_view_community(uuid) to authenticated;
grant execute on function private.can_view_post(uuid) to authenticated;
grant execute on function private.is_conversation_member(uuid) to authenticated;

create or replace function private.moderate_post_before_write()
returns trigger language plpgsql set search_path = public, private, pg_temp as $$ begin if new.title is not null then perform private.assert_safe_lounge_text(new.title); end if; perform private.assert_safe_lounge_text(new.body); return new; end; $$;
create or replace function private.moderate_comment_before_write()
returns trigger language plpgsql set search_path = public, private, pg_temp as $$ begin perform private.assert_safe_lounge_text(new.body); return new; end; $$;
create or replace function private.moderate_dm_before_write()
returns trigger language plpgsql set search_path = public, private, pg_temp as $$ begin perform private.assert_safe_lounge_text(new.body); return new; end; $$;

create trigger posts_moderate before insert or update of title, body on public.posts for each row execute function private.moderate_post_before_write();
create trigger comments_moderate before insert or update of body on public.comments for each row execute function private.moderate_comment_before_write();
create trigger direct_messages_moderate before insert or update of body on public.direct_messages for each row execute function private.moderate_dm_before_write();

create trigger profiles_set_updated_at before update on public.profiles for each row execute function private.set_updated_at();
create trigger communities_set_updated_at before update on public.communities for each row execute function private.set_updated_at();
create trigger community_join_requests_set_updated_at before update on public.community_join_requests for each row execute function private.set_updated_at();
create trigger posts_set_updated_at before update on public.posts for each row execute function private.set_updated_at();
create trigger comments_set_updated_at before update on public.comments for each row execute function private.set_updated_at();
create trigger reports_set_updated_at before update on public.reports for each row execute function private.set_updated_at();
create trigger conversations_set_updated_at before update on public.conversations for each row execute function private.set_updated_at();

create or replace function private.refresh_post_comment_count()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then update public.posts set comment_count = comment_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then update public.posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
  end if;
  return coalesce(new, old);
end; $$;
create trigger comments_count_after_insert after insert on public.comments for each row execute function private.refresh_post_comment_count();
create trigger comments_count_after_delete after delete on public.comments for each row execute function private.refresh_post_comment_count();

create or replace function private.refresh_post_reaction_count()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then update public.posts set reaction_count = reaction_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then update public.posts set reaction_count = greatest(reaction_count - 1, 0) where id = old.post_id;
  end if;
  return coalesce(new, old);
end; $$;
create trigger post_reactions_count_after_insert after insert on public.post_reactions for each row execute function private.refresh_post_reaction_count();
create trigger post_reactions_count_after_delete after delete on public.post_reactions for each row execute function private.refresh_post_reaction_count();

create or replace function private.refresh_comment_reaction_count()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then update public.comments set reaction_count = reaction_count + 1 where id = new.comment_id;
  elsif tg_op = 'DELETE' then update public.comments set reaction_count = greatest(reaction_count - 1, 0) where id = old.comment_id;
  end if;
  return coalesce(new, old);
end; $$;
create trigger comment_reactions_count_after_insert after insert on public.comment_reactions for each row execute function private.refresh_comment_reaction_count();
create trigger comment_reactions_count_after_delete after delete on public.comment_reactions for each row execute function private.refresh_comment_reaction_count();

alter table public.profiles enable row level security;
alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.community_join_requests enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.post_reactions enable row level security;
alter table public.comment_reactions enable row level security;
alter table public.follows enable row level security;
alter table public.notifications enable row level security;
alter table public.reports enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.direct_messages enable row level security;

create policy profiles_read on public.profiles for select to authenticated using (true);
create policy profiles_insert_own on public.profiles for insert to authenticated with check (user_id = auth.uid());
create policy profiles_update_own on public.profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy communities_read on public.communities for select to authenticated using (visibility in ('public','restricted') or private.is_community_member(id));
create policy communities_insert on public.communities for insert to authenticated with check (creator_id = auth.uid());
create policy communities_update_mod on public.communities for update to authenticated using (private.is_community_mod(id)) with check (private.is_community_mod(id));
create policy communities_delete_owner on public.communities for delete to authenticated using (exists (select 1 from public.community_members m where m.community_id = id and m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active'));
create policy community_members_read on public.community_members for select to authenticated using (private.can_view_community(community_id));
create policy community_members_manage_mod_insert on public.community_members for insert to authenticated with check (private.is_community_mod(community_id));
create policy community_members_manage_mod_update on public.community_members for update to authenticated using (private.is_community_mod(community_id)) with check (private.is_community_mod(community_id));
create policy community_members_manage_mod_delete on public.community_members for delete to authenticated using (private.is_community_mod(community_id));
create policy join_requests_read on public.community_join_requests for select to authenticated using (user_id = auth.uid() or private.is_community_mod(community_id));
create policy join_requests_insert_own on public.community_join_requests for insert to authenticated with check (user_id = auth.uid());
create policy join_requests_update on public.community_join_requests for update to authenticated using (user_id = auth.uid() or private.is_community_mod(community_id));
create policy posts_read on public.posts for select to authenticated using (author_id = auth.uid() or (status = 'published' and (community_id is null or private.can_view_community(community_id))));
create policy posts_insert on public.posts for insert to authenticated with check (author_id = auth.uid() and (community_id is null or private.is_community_member(community_id)));
create policy posts_update on public.posts for update to authenticated using (author_id = auth.uid() or (community_id is not null and private.is_community_mod(community_id))) with check (author_id = auth.uid() or (community_id is not null and private.is_community_mod(community_id)));
create policy posts_delete on public.posts for delete to authenticated using (author_id = auth.uid() or (community_id is not null and private.is_community_mod(community_id)));
create policy comments_read on public.comments for select to authenticated using (author_id = auth.uid() or (status = 'published' and private.can_view_post(post_id)));
create policy comments_insert on public.comments for insert to authenticated with check (author_id = auth.uid() and private.can_view_post(post_id));
create policy comments_update on public.comments for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy comments_delete on public.comments for delete to authenticated using (author_id = auth.uid() or exists (select 1 from public.posts p where p.id = post_id and p.community_id is not null and private.is_community_mod(p.community_id)));
create policy post_reactions_read on public.post_reactions for select to authenticated using (private.can_view_post(post_id));
create policy post_reactions_insert on public.post_reactions for insert to authenticated with check (user_id = auth.uid() and private.can_view_post(post_id));
create policy post_reactions_update on public.post_reactions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy post_reactions_delete on public.post_reactions for delete to authenticated using (user_id = auth.uid());
create policy comment_reactions_read on public.comment_reactions for select to authenticated using (exists (select 1 from public.comments c where c.id = comment_id and private.can_view_post(c.post_id)));
create policy comment_reactions_insert on public.comment_reactions for insert to authenticated with check (user_id = auth.uid() and exists (select 1 from public.comments c where c.id = comment_id and private.can_view_post(c.post_id)));
create policy comment_reactions_update on public.comment_reactions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy comment_reactions_delete on public.comment_reactions for delete to authenticated using (user_id = auth.uid());
create policy follows_read on public.follows for select to authenticated using (follower_id = auth.uid() or followed_id = auth.uid());
create policy follows_insert on public.follows for insert to authenticated with check (follower_id = auth.uid());
create policy follows_delete on public.follows for delete to authenticated using (follower_id = auth.uid());
create policy notifications_read_own on public.notifications for select to authenticated using (recipient_id = auth.uid());
create policy notifications_update_own on public.notifications for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
create policy notifications_delete_own on public.notifications for delete to authenticated using (recipient_id = auth.uid());
create policy reports_read on public.reports for select to authenticated using (reporter_id = auth.uid() or (community_id is not null and private.is_community_mod(community_id)));
create policy reports_insert on public.reports for insert to authenticated with check (reporter_id = auth.uid());
create policy reports_update_mod on public.reports for update to authenticated using (community_id is not null and private.is_community_mod(community_id));
create policy conversations_read on public.conversations for select to authenticated using (private.is_conversation_member(id));
create policy conversations_insert on public.conversations for insert to authenticated with check (created_by = auth.uid());
create policy conversations_update on public.conversations for update to authenticated using (private.is_conversation_member(id));
create policy conversations_delete on public.conversations for delete to authenticated using (created_by = auth.uid());
create policy conversation_members_read on public.conversation_members for select to authenticated using (private.is_conversation_member(conversation_id));
create policy conversation_members_insert on public.conversation_members for insert to authenticated with check (exists (select 1 from public.conversations c where c.id = conversation_id and c.created_by = auth.uid()));
create policy conversation_members_update on public.conversation_members for update to authenticated using (user_id = auth.uid() or exists (select 1 from public.conversations c where c.id = conversation_id and c.created_by = auth.uid()));
create policy conversation_members_delete on public.conversation_members for delete to authenticated using (user_id = auth.uid() or exists (select 1 from public.conversations c where c.id = conversation_id and c.created_by = auth.uid()));
create policy direct_messages_read on public.direct_messages for select to authenticated using (private.is_conversation_member(conversation_id));
create policy direct_messages_insert on public.direct_messages for insert to authenticated with check (sender_id = auth.uid() and private.is_conversation_member(conversation_id));
create policy direct_messages_update on public.direct_messages for update to authenticated using (sender_id = auth.uid()) with check (sender_id = auth.uid());
create policy direct_messages_delete on public.direct_messages for delete to authenticated using (sender_id = auth.uid());

create or replace function public.bootstrap_profile()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.profiles(user_id) values (auth.uid()) on conflict do nothing;
  insert into public.user_metrics(user_id) values (auth.uid()) on conflict do nothing;
end; $$;
grant execute on function public.bootstrap_profile() to authenticated;

create or replace function public.create_community(community_name text, community_slug text, community_description text default null, community_visibility text default 'public')
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.communities(creator_id, slug, name, description, visibility)
  values (auth.uid(), lower(community_slug), community_name, community_description, community_visibility)
  returning id into new_id;
  insert into public.community_members(community_id, user_id, role) values (new_id, auth.uid(), 'owner');
  return new_id;
end; $$;
grant execute on function public.create_community(text,text,text,text) to authenticated;

create or replace function public.join_community(target_community uuid, request_message text default null)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare vis text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select visibility into vis from public.communities where id = target_community;
  if vis is null then raise exception 'Community not found'; end if;
  if exists (select 1 from public.community_members where community_id = target_community and user_id = auth.uid() and status = 'active') then return 'joined'; end if;
  if vis = 'public' then
    insert into public.community_members(community_id, user_id) values (target_community, auth.uid()) on conflict (community_id,user_id) do update set status='active';
    update public.communities set member_count = (select count(*) from public.community_members where community_id = target_community and status='active') where id = target_community;
    return 'joined';
  end if;
  insert into public.community_join_requests(community_id,user_id,message,status)
  values (target_community,auth.uid(),request_message,'pending')
  on conflict (community_id,user_id) do update set message=excluded.message,status='pending',updated_at=now();
  return 'requested';
end; $$;
grant execute on function public.join_community(uuid,text) to authenticated;

create or replace function public.start_conversation(peer_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if peer_id = auth.uid() then raise exception 'Choose another member'; end if;
  if not exists (select 1 from auth.users where id = peer_id) then raise exception 'Member not found'; end if;
  insert into public.conversations(created_by,kind) values (auth.uid(),'direct') returning id into new_id;
  insert into public.conversation_members(conversation_id,user_id,role) values (new_id,auth.uid(),'owner'),(new_id,peer_id,'member');
  return new_id;
end; $$;
grant execute on function public.start_conversation(uuid) to authenticated;

do $$ begin alter publication supabase_realtime add table public.posts; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.comments; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.direct_messages; exception when duplicate_object then null; end $$;
