-- Hesabın silinməsi (App Store tələbi: hesab yaratmağa imkan verən tətbiq onu silməyə də imkan verməlidir).
-- İstifadəçinin yeganə sahibi olduğu fermalar bütün qeydləri ilə (ON DELETE CASCADE) silinir,
-- digər fermalardakı üzvlüyü ləğv olunur və auth istifadəçisi silinir.
-- Şəkillər Storage API ilə tətbiq tərəfindən bu funksiyadan ƏVVƏL silinir
-- (Supabase storage.objects cədvəlindən birbaşa SQL ilə silməyə icazə vermir).

create or replace function public.delete_account()
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  delete from public.farms f
  where exists (
      select 1 from public.farm_members m
      where m.farm_id = f.id and m.user_id = uid and m.role = 'owner'
    )
    and not exists (
      select 1 from public.farm_members m
      where m.farm_id = f.id and m.user_id <> uid and m.role = 'owner'
    );

  delete from auth.users where id = uid;  -- farm_members ON DELETE CASCADE ilə silinir
end;
$$;

revoke execute on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;

-- Tətbiq şəkilləri silməzdən əvvəl soruşur: bu fermanın başqa sahibi varmı?
create or replace function public.is_sole_owner(f uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
      select 1 from public.farm_members m
      where m.farm_id = f and m.user_id = (select auth.uid()) and m.role = 'owner'
    )
    and not exists (
      select 1 from public.farm_members m
      where m.farm_id = f and m.user_id <> (select auth.uid()) and m.role = 'owner'
    );
$$;

revoke execute on function public.is_sole_owner(uuid) from public, anon;
grant execute on function public.is_sole_owner(uuid) to authenticated;
