-- RLS köməkçi funksiyalarını API-yə açıq olmayan "private" sxeminə köçürürük ki,
-- /rest/v1/rpc/... vasitəsilə birbaşa çağırılmasınlar (Supabase security advisor 0029).
-- Siyasətlər funksiyalara OID ilə istinad etdiyi üçün ALTER ... SET SCHEMA onları qırmır.
-- ensure_farm() isə tətbiq tərəfindən çağırılır və public-də qalır.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

alter function public.is_farm_member(uuid) set schema private;
alter function public.can_write_farm(uuid) set schema private;
drop function public.can_access_farm_path(text, boolean) cascade;

create function private.can_access_farm_path(path text, write boolean default false)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  folder text := split_part(path, '/', 1);
begin
  if folder !~ '^[0-9a-fA-F-]{36}$' then
    return false;
  end if;
  if write then
    return private.can_write_farm(folder::uuid);
  end if;
  return private.is_farm_member(folder::uuid);
end;
$$;
revoke execute on function private.can_access_farm_path(text, boolean) from public, anon;
grant execute on function private.can_access_farm_path(text, boolean) to authenticated;

-- "cascade" yuxarıda storage siyasətlərini də sildi — yenidən yaradırıq.
create policy "animal-photos: üzvlər oxuyur" on storage.objects
  for select to authenticated
  using (bucket_id = 'animal-photos' and private.can_access_farm_path(name));
create policy "animal-photos: yükləmə" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'animal-photos' and private.can_access_farm_path(name, true));
create policy "animal-photos: yeniləmə" on storage.objects
  for update to authenticated
  using (bucket_id = 'animal-photos' and private.can_access_farm_path(name, true))
  with check (bucket_id = 'animal-photos' and private.can_access_farm_path(name, true));
create policy "animal-photos: silmə" on storage.objects
  for delete to authenticated
  using (bucket_id = 'animal-photos' and private.can_access_farm_path(name, true));

create index if not exists farms_created_by_idx on public.farms (created_by);
