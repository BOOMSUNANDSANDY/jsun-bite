-- JSun Bite V0.1 initial schema. Keep changes as new timestamped migrations after launch.
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.couples (
  id uuid primary key default gen_random_uuid(),
  member_a uuid not null references public.profiles(id),
  member_b uuid references public.profiles(id),
  invite_code text not null unique,
  anniversary date,
  pet_name text not null default '豆包',
  created_at timestamptz not null default now(),
  constraint different_members check (member_b is null or member_a <> member_b)
);

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  title text,
  meal_type text not null check (meal_type in ('早餐','午餐','晚餐','零食','饮料','其他')),
  eaten_at timestamptz not null default now(),
  calories integer check (calories is null or calories >= 0),
  partner_calories integer check (partner_calories is null or partner_calories >= 0),
  price_cents integer check (price_cents is null or price_cents >= 0),
  place text,
  note text,
  photo_paths text[] not null default '{}',
  is_together boolean not null default false,
  created_at timestamptz not null default now()
);

create index meals_couple_eaten_at_idx on public.meals (couple_id, eaten_at desc);
create index meals_author_id_idx on public.meals (author_id);

create table public.reactions (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meals(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null,
  label text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (meal_id, user_id, emoji)
);

create index reactions_meal_id_idx on public.reactions (meal_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meals(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create index comments_meal_id_created_at_idx on public.comments (meal_id, created_at);

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  expo_push_token text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index push_tokens_user_id_idx on public.push_tokens (user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, nickname)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nickname'), ''), split_part(new.email, '@', 1), '新朋友')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.get_my_couple()
returns table (
  id uuid,
  member_a uuid,
  member_b uuid,
  invite_code text,
  anniversary date,
  pet_name text,
  created_at timestamptz
)
language sql
stable
security definer set search_path = public
as $$
  select c.id, c.member_a, c.member_b, c.invite_code, c.anniversary, c.pet_name, c.created_at
  from public.couples c
  where auth.uid() in (c.member_a, c.member_b)
  order by c.created_at desc
  limit 1;
$$;

create or replace function public.create_couple_invite()
returns public.couples
language plpgsql
security definer set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  existing public.couples;
  created public.couples;
  next_code text;
begin
  if current_user_id is null then
    raise exception '请先登录';
  end if;

  perform pg_advisory_xact_lock(hashtext(current_user_id::text));

  select * into existing
  from public.couples c
  where current_user_id in (c.member_a, c.member_b)
  limit 1;

  if found then
    return existing;
  end if;

  loop
    next_code := upper(substr(encode(extensions.gen_random_bytes(5), 'hex'), 1, 6));
    begin
      insert into public.couples (member_a, invite_code)
      values (current_user_id, next_code)
      returning * into created;
      exit;
    exception when unique_violation then
      -- 极低概率的邀请码碰撞，事务内重新生成即可。
    end;
  end loop;

  return created;
end;
$$;

create or replace function public.accept_couple_invite(input_code text)
returns public.couples
language plpgsql
security definer set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_code text := upper(trim(input_code));
  target public.couples;
  existing public.couples;
begin
  if current_user_id is null then
    raise exception '请先登录';
  end if;

  if char_length(normalized_code) <> 6 then
    raise exception '邀请码应为 6 位';
  end if;

  perform pg_advisory_xact_lock(hashtext(normalized_code));
  perform pg_advisory_xact_lock(hashtext(current_user_id::text));

  select * into target
  from public.couples c
  where c.invite_code = normalized_code
  for update;

  if not found then
    raise exception '没有找到这个邀请码';
  end if;

  if target.member_a = current_user_id then
    raise exception '这是你自己的邀请码呀';
  end if;

  if target.member_b is not null then
    raise exception '这个邀请码已经绑定过啦';
  end if;

  select * into existing
  from public.couples c
  where current_user_id in (c.member_a, c.member_b)
  limit 1
  for update;

  if found then
    if existing.member_b is not null then
      raise exception '当前账号已经绑定伴侣';
    end if;
    delete from public.couples where id = existing.id;
  end if;

  update public.couples
  set member_b = current_user_id
  where id = target.id
  returning * into target;

  return target;
end;
$$;

revoke all on function public.get_my_couple() from public;
revoke all on function public.create_couple_invite() from public;
revoke all on function public.accept_couple_invite(text) from public;
grant execute on function public.get_my_couple() to authenticated;
grant execute on function public.create_couple_invite() to authenticated;
grant execute on function public.accept_couple_invite(text) to authenticated;

create or replace function public.is_couple_member(target_couple uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.couples c
    where c.id = target_couple and auth.uid() in (c.member_a, c.member_b)
  );
$$;

alter table public.profiles enable row level security;
alter table public.couples enable row level security;
alter table public.meals enable row level security;
alter table public.reactions enable row level security;
alter table public.comments enable row level security;
alter table public.push_tokens enable row level security;

create policy "profiles visible to self and partner" on public.profiles for select using (
  id = auth.uid() or exists (
    select 1 from public.couples c where auth.uid() in (c.member_a, c.member_b) and profiles.id in (c.member_a, c.member_b)
  )
);
create policy "profile owner inserts" on public.profiles for insert with check (id = auth.uid());
create policy "profile owner updates" on public.profiles for update using (id = auth.uid());

create policy "couple members read" on public.couples for select using (auth.uid() in (member_a, member_b));
-- 情侣关系只能通过 create_couple_invite / accept_couple_invite 两个事务函数写入。

create policy "couple meals read" on public.meals for select using (public.is_couple_member(couple_id));
create policy "member publishes own meal" on public.meals for insert with check (author_id = auth.uid() and public.is_couple_member(couple_id));
create policy "author updates meal" on public.meals for update using (author_id = auth.uid());
create policy "author deletes meal" on public.meals for delete using (author_id = auth.uid());

create policy "couple reactions read" on public.reactions for select using (exists (select 1 from public.meals m where m.id = meal_id and public.is_couple_member(m.couple_id)));
create policy "member reacts" on public.reactions for insert with check (user_id = auth.uid() and exists (select 1 from public.meals m where m.id = meal_id and public.is_couple_member(m.couple_id)));
create policy "reaction owner updates" on public.reactions for update
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (select 1 from public.meals m where m.id = meal_id and public.is_couple_member(m.couple_id))
);
create policy "reaction owner deletes" on public.reactions for delete using (user_id = auth.uid());

create policy "couple comments read" on public.comments for select using (exists (select 1 from public.meals m where m.id = meal_id and public.is_couple_member(m.couple_id)));
create policy "member comments" on public.comments for insert with check (user_id = auth.uid() and exists (select 1 from public.meals m where m.id = meal_id and public.is_couple_member(m.couple_id)));
create policy "comment owner deletes" on public.comments for delete using (user_id = auth.uid());

create policy "token owner reads" on public.push_tokens for select using (user_id = auth.uid());
create policy "token owner inserts" on public.push_tokens for insert with check (user_id = auth.uid());
create policy "token owner updates" on public.push_tokens for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "token owner deletes" on public.push_tokens for delete using (user_id = auth.uid());

alter publication supabase_realtime add table public.meals, public.reactions, public.comments;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meal-photos', 'meal-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/heic', 'image/heif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "couple members read meal photos"
on storage.objects for select to authenticated
using (
  bucket_id = 'meal-photos'
  and public.is_couple_member(((storage.foldername(name))[1])::uuid)
);

create policy "couple members upload meal photos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'meal-photos'
  and public.is_couple_member(((storage.foldername(name))[1])::uuid)
  and storage.extension(name) = 'jpg'
);

create policy "photo owner deletes meal photos"
on storage.objects for delete to authenticated
using (
  bucket_id = 'meal-photos'
  and owner_id = (select auth.uid()::text)
);

-- 私有路径：<couple_id>/<meal_id>/<uuid>.jpg；V0.1 每条记录最多两张。
