-- Common account settings needed by the two-person app.
create or replace function public.update_couple_settings(
  target_couple uuid,
  new_pet_name text,
  new_anniversary date
)
returns public.couples
language plpgsql
security definer
set search_path = public
as $$
declare
  updated public.couples;
begin
  if auth.uid() is null then
    raise exception '请先登录';
  end if;

  if not public.is_couple_member(target_couple) then
    raise exception '只能修改自己的情侣空间';
  end if;

  if char_length(trim(new_pet_name)) not between 1 and 12 then
    raise exception '宠物名字应为 1 到 12 个字';
  end if;

  update public.couples
  set pet_name = trim(new_pet_name), anniversary = new_anniversary
  where id = target_couple
  returning * into updated;

  return updated;
end;
$$;

revoke all on function public.update_couple_settings(uuid, text, date) from public;
grant execute on function public.update_couple_settings(uuid, text, date) to authenticated;
