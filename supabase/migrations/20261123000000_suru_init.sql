-- Sürü — ilkin sxem
-- Hər istifadəçinin bir və ya bir neçə ferması ola bilər (farm_members). Bütün məlumat
-- cədvəlləri farm_id ilə fermaya bağlıdır və Row Level Security ilə qorunur:
-- istifadəçi yalnız üzv olduğu fermanın məlumatını görür və dəyişir.
--
-- Qeyd: id-lər mobil tətbiqdə (cihazda) yaradılır ki, internetsiz yazmaq mümkün olsun.

-- ---------------------------------------------------------------------------
-- Fermalar və üzvlük
-- ---------------------------------------------------------------------------
create table public.farms (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'Mənim fermam',
  owner_name  text not null default '',
  region      text not null default '',
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.farm_members (
  farm_id     uuid not null references public.farms (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  -- owner: sahib; worker: işçi; vet: baytar; viewer: yalnız baxış
  role        text not null default 'owner' check (role in ('owner', 'worker', 'vet', 'viewer')),
  created_at  timestamptz not null default now(),
  primary key (farm_id, user_id)
);
create index farm_members_user_idx on public.farm_members (user_id);

-- Üzvlük yoxlamaları (RLS siyasətlərində istifadə olunur). SECURITY DEFINER — farm_members
-- cədvəlinin öz RLS-i ilə sonsuz dövrə yaranmasın deyə.
create or replace function public.is_farm_member(f uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.farm_members m
    where m.farm_id = f and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.can_write_farm(f uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.farm_members m
    where m.farm_id = f and m.user_id = (select auth.uid()) and m.role <> 'viewer'
  );
$$;

-- Storage yolu "<farm_id>/<fayl>" formatındadır; ilk qovluq fermanın id-sidir.
create or replace function public.can_access_farm_path(path text, write boolean default false)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  folder text := split_part(path, '/', 1);
begin
  if folder !~ '^[0-9a-fA-F-]{36}$' then
    return false;
  end if;
  if write then
    return public.can_write_farm(folder::uuid);
  end if;
  return public.is_farm_member(folder::uuid);
end;
$$;

-- İstifadəçinin fermasının id-sini qaytarır; yoxdursa yaradır və onu sahib edir.
create or replace function public.ensure_farm()
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  fid uuid;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  -- Eyni istifadəçinin paralel sorğuları iki ferma yaratmasın.
  perform pg_advisory_xact_lock(hashtext(uid::text));
  select m.farm_id into fid
    from public.farm_members m
    where m.user_id = uid
    order by (m.role = 'owner') desc, m.created_at
    limit 1;
  if fid is null then
    insert into public.farms (created_by) values (uid) returning id into fid;
    insert into public.farm_members (farm_id, user_id, role) values (fid, uid, 'owner');
  end if;
  return fid;
end;
$$;

revoke execute on function public.ensure_farm() from public, anon;
grant execute on function public.ensure_farm() to authenticated;
revoke execute on function public.is_farm_member(uuid) from public, anon;
grant execute on function public.is_farm_member(uuid) to authenticated;
revoke execute on function public.can_write_farm(uuid) from public, anon;
grant execute on function public.can_write_farm(uuid) to authenticated;
revoke execute on function public.can_access_farm_path(text, boolean) from public, anon;
grant execute on function public.can_access_farm_path(text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Məlumat cədvəlləri
-- ---------------------------------------------------------------------------
create table public.animals (
  id          uuid primary key,
  farm_id     uuid not null references public.farms (id) on delete cascade,
  tag         text not null check (length(trim(tag)) > 0),
  name        text not null default '',
  species     text not null default 'inek' check (species in ('inek', 'camis', 'qoyun', 'keci')),
  breed       text not null default '',
  sex         text not null default 'd' check (sex in ('d', 'e')),
  dob         date,
  dam_tag     text not null default '',
  group_name  text not null default '',
  status      text not null default 'aktiv' check (status in ('aktiv', 'satilib', 'olub', 'kesilib')),
  notes       text not null default '',
  photo_path  text,
  created_at  date not null default current_date,
  updated_at  timestamptz not null default now()
);
create index animals_farm_idx on public.animals (farm_id);
-- Bir fermada eyni bırka nömrəsi iki dəfə ola bilməz (böyük/kiçik hərf fərqi nəzərə alınmır).
create unique index animals_farm_tag_uidx on public.animals (farm_id, lower(trim(tag)));

create table public.treatments (
  id          uuid primary key,
  farm_id     uuid not null references public.farms (id) on delete cascade,
  animal_id   uuid not null references public.animals (id) on delete cascade,
  batch_id    uuid,
  date        date not null,
  medicine    text not null default '',
  dose        text not null default '',
  reason      text not null default '',
  meat_wd     integer not null default 0 check (meat_wd >= 0),
  milk_wd     integer not null default 0 check (milk_wd >= 0),
  updated_at  timestamptz not null default now()
);
create index treatments_farm_idx on public.treatments (farm_id);
create index treatments_animal_idx on public.treatments (animal_id);

create table public.weights (
  id          uuid primary key,
  farm_id     uuid not null references public.farms (id) on delete cascade,
  animal_id   uuid not null references public.animals (id) on delete cascade,
  date        date not null,
  kg          numeric(8, 2) not null check (kg > 0),
  updated_at  timestamptz not null default now()
);
create index weights_farm_idx on public.weights (farm_id);
create index weights_animal_idx on public.weights (animal_id);

create table public.breedings (
  id          uuid primary key,
  farm_id     uuid not null references public.farms (id) on delete cascade,
  animal_id   uuid not null references public.animals (id) on delete cascade,
  date        date not null,
  method      text not null default 'suni' check (method in ('suni', 'tebii')),
  sire        text not null default '',
  expected    date not null,
  outcome     text not null default '',
  updated_at  timestamptz not null default now()
);
create index breedings_farm_idx on public.breedings (farm_id);
create index breedings_animal_idx on public.breedings (animal_id);

create table public.tasks (
  id          uuid primary key,
  farm_id     uuid not null references public.farms (id) on delete cascade,
  title       text not null,
  due         date,
  done        boolean not null default false,
  updated_at  timestamptz not null default now()
);
create index tasks_farm_idx on public.tasks (farm_id);

create table public.meds (
  id          uuid primary key,
  farm_id     uuid not null references public.farms (id) on delete cascade,
  name        text not null,
  qty         numeric(10, 2) not null default 0,
  unit        text not null default 'ml',
  min_qty     numeric(10, 2) not null default 0,
  expiry      date,
  meat_wd     integer not null default 0 check (meat_wd >= 0),
  milk_wd     integer not null default 0 check (milk_wd >= 0),
  notes       text not null default '',
  updated_at  timestamptz not null default now()
);
create index meds_farm_idx on public.meds (farm_id);

-- Uşaq qeydin heyvanı başqa fermaya aid ola bilməz.
create or replace function public.check_animal_farm()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.animals a where a.id = new.animal_id and a.farm_id = new.farm_id) then
    raise exception 'animal % does not belong to farm %', new.animal_id, new.farm_id using errcode = '23503';
  end if;
  return new;
end;
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['farms', 'animals', 'treatments', 'weights', 'breedings', 'tasks', 'meds'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated_at()', t || '_touch', t);
  end loop;
  foreach t in array array['treatments', 'weights', 'breedings'] loop
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.check_animal_farm()', t || '_animal_farm', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.farms enable row level security;
alter table public.farm_members enable row level security;

create policy "farms: üzvlər görür" on public.farms
  for select to authenticated using (public.is_farm_member(id));
create policy "farms: yazma hüququ olanlar yeniləyir" on public.farms
  for update to authenticated using (public.can_write_farm(id)) with check (public.can_write_farm(id));
-- Ferma yalnız ensure_farm() ilə yaradılır; silinmə hələlik yoxdur.

create policy "farm_members: öz fermasının üzvlərini görür" on public.farm_members
  for select to authenticated using (user_id = (select auth.uid()) or public.is_farm_member(farm_id));
-- Üzv dəvəti gələcəkdə ayrıca RPC ilə əlavə olunacaq.

do $$
declare
  t text;
begin
  foreach t in array array['animals', 'treatments', 'weights', 'breedings', 'tasks', 'meds'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_farm_member(farm_id))', t || ': üzvlər görür', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.can_write_farm(farm_id))', t || ': əlavə', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.can_write_farm(farm_id)) with check (public.can_write_farm(farm_id))', t || ': yeniləmə', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.can_write_farm(farm_id))', t || ': silmə', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Heyvan şəkilləri (Storage) — gizli bucket, imzalı URL ilə oxunur
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('animal-photos', 'animal-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "animal-photos: üzvlər oxuyur" on storage.objects
  for select to authenticated
  using (bucket_id = 'animal-photos' and public.can_access_farm_path(name));
create policy "animal-photos: yükləmə" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'animal-photos' and public.can_access_farm_path(name, true));
create policy "animal-photos: yeniləmə" on storage.objects
  for update to authenticated
  using (bucket_id = 'animal-photos' and public.can_access_farm_path(name, true))
  with check (bucket_id = 'animal-photos' and public.can_access_farm_path(name, true));
create policy "animal-photos: silmə" on storage.objects
  for delete to authenticated
  using (bucket_id = 'animal-photos' and public.can_access_farm_path(name, true));
