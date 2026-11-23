-- myGov / dövlət girişi (OIDC) ilə daxil olan istifadəçilərin hesablara bağlanması.
-- FİN/şəxsiyyət identifikatoru açıq saxlanılmır: yalnız gizli açarla hesablanmış HMAC-SHA256 dəyəri
-- (subject_hash) saxlanılır. Hesablama Edge Function-da (supabase/functions/mygov-auth) aparılır.

create table private.external_identities (
  provider      text not null,
  subject_hash  text not null,
  user_id       uuid not null references auth.users (id) on delete cascade,
  created_at    timestamptz not null default now(),
  last_login_at timestamptz not null default now(),
  primary key (provider, subject_hash)
);
create index external_identities_user_idx on private.external_identities (user_id);
alter table private.external_identities enable row level security;
-- Siyasət yoxdur: cədvələ yalnız aşağıdakı service_role funksiyaları vasitəsilə çıxış var.

-- Aşağıdakı funksiyalar YALNIZ service_role (Edge Function) üçündür.
create or replace function public.auth_external_user(p_provider text, p_subject_hash text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid;
begin
  update private.external_identities
     set last_login_at = now()
   where provider = p_provider and subject_hash = p_subject_hash
  returning user_id into uid;
  return uid;
end;
$$;

create or replace function public.auth_link_external(p_provider text, p_subject_hash text, p_user_id uuid)
returns void language sql security definer set search_path = '' as $$
  insert into private.external_identities (provider, subject_hash, user_id)
  values (p_provider, p_subject_hash, p_user_id)
  on conflict (provider, subject_hash) do nothing;
$$;

create or replace function public.auth_user_id_by_email(p_email text)
returns uuid language sql stable security definer set search_path = '' as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;

revoke execute on function public.auth_external_user(text, text) from public, anon, authenticated;
revoke execute on function public.auth_link_external(text, text, uuid) from public, anon, authenticated;
revoke execute on function public.auth_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.auth_external_user(text, text) to service_role;
grant execute on function public.auth_link_external(text, text, uuid) to service_role;
grant execute on function public.auth_user_id_by_email(text) to service_role;

-- Yeni ferma yaradılanda sahibin adı (myGov-dan gələn ad və s.) avtomatik yazılır.
create or replace function public.ensure_farm()
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  fid uuid;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  perform pg_advisory_xact_lock(hashtext(uid::text));
  select m.farm_id into fid
    from public.farm_members m
    where m.user_id = uid
    order by (m.role = 'owner') desc, m.created_at
    limit 1;
  if fid is null then
    insert into public.farms (created_by, owner_name)
    values (uid, coalesce((select u.raw_user_meta_data ->> 'full_name' from auth.users u where u.id = uid), ''))
    returning id into fid;
    insert into public.farm_members (farm_id, user_id, role) values (fid, uid, 'owner');
  end if;
  return fid;
end;
$$;
