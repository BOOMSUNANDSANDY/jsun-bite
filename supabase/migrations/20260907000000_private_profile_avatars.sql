-- Private profile avatars. Files are stored as <profile_id>/<uuid>.jpg.
create or replace function public.can_view_profile(target_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_profile = auth.uid()
    or exists (
      select 1 from public.couples c
      where auth.uid() in (c.member_a, c.member_b)
        and target_profile in (c.member_a, c.member_b)
    );
$$;

revoke all on function public.can_view_profile(uuid) from public;
grant execute on function public.can_view_profile(uuid) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-avatars', 'profile-avatars', false, 2097152, array['image/jpeg'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "couple reads profile avatars" on storage.objects;
create policy "couple reads profile avatars"
on storage.objects for select to authenticated
using (
  bucket_id = 'profile-avatars'
  and public.can_view_profile(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "owner uploads profile avatar" on storage.objects;
create policy "owner uploads profile avatar"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-avatars'
  and ((storage.foldername(name))[1])::uuid = auth.uid()
  and storage.extension(name) = 'jpg'
);

drop policy if exists "owner updates profile avatar" on storage.objects;
create policy "owner updates profile avatar"
on storage.objects for update to authenticated
using (
  bucket_id = 'profile-avatars'
  and ((storage.foldername(name))[1])::uuid = auth.uid()
)
with check (
  bucket_id = 'profile-avatars'
  and ((storage.foldername(name))[1])::uuid = auth.uid()
  and storage.extension(name) = 'jpg'
);

drop policy if exists "owner deletes profile avatar" on storage.objects;
create policy "owner deletes profile avatar"
on storage.objects for delete to authenticated
using (
  bucket_id = 'profile-avatars'
  and ((storage.foldername(name))[1])::uuid = auth.uid()
);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end;
$$;
