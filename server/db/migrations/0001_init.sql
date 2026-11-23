-- Sürü — daxili server sxemi (standart PostgreSQL 14+, Supabase-dən asılı deyil).
--
-- Məlumat cədvəlləri /supabase/migrations ilə EYNİDİR (sütun adları, tiplər, məhdudiyyətlər) —
-- köçürmə skripti (scripts/migrate-from-supabase.ts) sətirləri olduğu kimi köçürür.
-- Fərqlər:
--   * auth.users        → public.users (+ sessions)       — kimlik yoxlaması serverin özündədir
--   * storage.objects    → diskdə fayllar (STORAGE_DIR)   — şəkil yolu eynidir: "<farm_id>/<fayl>"
--   * Row Level Security → icazələr API qatında yoxlanılır (src/farm.ts): hər sorğu farm_id ilə məhdudlaşır
--   * private.external_identities → public.external_identities

create extension if not exists pgcrypto;  -- gen_random_uuid() (PG 13+ daxilində də var)

-- ---------------------------------------------------------------------------
-- İstifadəçilər və sessiyalar
-- ---------------------------------------------------------------------------
create table users (
  id                 uuid primary key default gen_random_uuid(),
  email              text not null,
  -- "scrypt$..." (server) və ya "$2a$/$2b$..." (Supabase-dən gələn bcrypt — ilk girişdə yenilənir).
  -- NULL = yalnız myGov ilə giriş.
  password_hash      text,
  full_name          text not null default '',
  provider           text not null default 'email',
  email_confirmed_at timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create unique index users_email_uidx on users (lower(email));

-- Giriş tokenləri. Token özü saxlanılmır — yalnız SHA-256 dəyəri.
create table sessions (
  id           uuid primary key default gen_random_uuid(),
  token_hash   text not null unique,
  user_id      uuid not null references users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  expires_at   timestamptz not null,
  user_agent   text not null default ''
);
create index sessions_user_idx on sessions (user_id);
create index sessions_expires_idx on sessions (expires_at);

-- myGov / dövlət girişi. FİN açıq saxlanılmır — yalnız HMAC-SHA256 (subject_hash).
create table external_identities (
  provider      text not null,
  subject_hash  text not null,
  user_id       uuid not null references users (id) on delete cascade,
  created_at    timestamptz not null default now(),
  last_login_at timestamptz not null default now(),
  primary key (provider, subject_hash)
);
create index external_identities_user_idx on external_identities (user_id);

-- ---------------------------------------------------------------------------
-- Fermalar və üzvlük
-- ---------------------------------------------------------------------------
create table farms (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'Mənim fermam',
  owner_name  text not null default '',
  region      text not null default '',
  created_by  uuid references users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index farms_created_by_idx on farms (created_by);

create table farm_members (
  farm_id     uuid not null references farms (id) on delete cascade,
  user_id     uuid not null references users (id) on delete cascade,
  -- owner: sahib; worker: işçi; vet: baytar; viewer: yalnız baxış
  role        text not null default 'owner' check (role in ('owner', 'worker', 'vet', 'viewer')),
  created_at  timestamptz not null default now(),
  primary key (farm_id, user_id)
);
create index farm_members_user_idx on farm_members (user_id);

-- ---------------------------------------------------------------------------
-- Məlumat cədvəlləri (id-ləri cihaz yaradır — internetsiz yazmaq üçün)
-- ---------------------------------------------------------------------------
create table animals (
  id          uuid primary key,
  farm_id     uuid not null references farms (id) on delete cascade,
  tag         text not null check (length(trim(tag)) > 0),
  name        text not null default '',
  species     text not null default 'inek' check (species in ('inek', 'camis', 'qoyun', 'keci')),
  breed       text not null default '',
  sex         text not null default 'd' check (sex in ('d', 'e')),
  dob         date,
  dam_tag     text not null default '',
  group_name  text not null default '',
  status      text not null default 'aktiv' check (status in ('aktiv', 'satilib', 'olub', 'kesilib', 'kocurulub')),
  notes       text not null default '',
  photo_path  text,
  created_at  date not null default current_date,
  updated_at  timestamptz not null default now()
);
create index animals_farm_idx on animals (farm_id);
create unique index animals_farm_tag_uidx on animals (farm_id, lower(trim(tag)));

create table treatments (
  id          uuid primary key,
  farm_id     uuid not null references farms (id) on delete cascade,
  animal_id   uuid not null references animals (id) on delete cascade,
  batch_id    uuid,
  date        date not null,
  medicine    text not null default '',
  dose        text not null default '',
  reason      text not null default '',
  meat_wd     integer not null default 0 check (meat_wd >= 0),
  milk_wd     integer not null default 0 check (milk_wd >= 0),
  updated_at  timestamptz not null default now()
);
create index treatments_farm_idx on treatments (farm_id);
create index treatments_animal_idx on treatments (animal_id);

create table weights (
  id          uuid primary key,
  farm_id     uuid not null references farms (id) on delete cascade,
  animal_id   uuid not null references animals (id) on delete cascade,
  date        date not null,
  kg          numeric(8, 2) not null check (kg > 0),
  updated_at  timestamptz not null default now()
);
create index weights_farm_idx on weights (farm_id);
create index weights_animal_idx on weights (animal_id);

create table breedings (
  id          uuid primary key,
  farm_id     uuid not null references farms (id) on delete cascade,
  animal_id   uuid not null references animals (id) on delete cascade,
  date        date not null,
  method      text not null default 'suni' check (method in ('suni', 'tebii')),
  sire        text not null default '',
  expected    date not null,
  outcome     text not null default '',
  updated_at  timestamptz not null default now()
);
create index breedings_farm_idx on breedings (farm_id);
create index breedings_animal_idx on breedings (animal_id);

create table tasks (
  id          uuid primary key,
  farm_id     uuid not null references farms (id) on delete cascade,
  title       text not null,
  due         date,
  done        boolean not null default false,
  updated_at  timestamptz not null default now()
);
create index tasks_farm_idx on tasks (farm_id);

create table meds (
  id          uuid primary key,
  farm_id     uuid not null references farms (id) on delete cascade,
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
create index meds_farm_idx on meds (farm_id);

create table preg_checks (
  id          uuid primary key,
  farm_id     uuid not null references farms (id) on delete cascade,
  animal_id   uuid not null references animals (id) on delete cascade,
  breeding_id uuid references breedings (id) on delete set null,
  date        date not null,
  result      text not null check (result in ('positive', 'negative', 'uncertain')),
  fetuses     integer check (fetuses is null or fetuses between 0 and 6),
  method      text not null default 'scan' check (method in ('scan', 'manual')),
  notes       text not null default '',
  updated_at  timestamptz not null default now()
);
create index preg_checks_farm_idx on preg_checks (farm_id);
create index preg_checks_animal_idx on preg_checks (animal_id);
create index preg_checks_breeding_idx on preg_checks (breeding_id);

create table heats (
  id          uuid primary key,
  farm_id     uuid not null references farms (id) on delete cascade,
  animal_id   uuid not null references animals (id) on delete cascade,
  date        date not null,
  notes       text not null default '',
  updated_at  timestamptz not null default now()
);
create index heats_farm_idx on heats (farm_id);
create index heats_animal_idx on heats (animal_id);

create table movements (
  id           uuid primary key,
  farm_id      uuid not null references farms (id) on delete cascade,
  animal_id    uuid not null references animals (id) on delete cascade,
  date         date not null,
  type         text not null check (type in ('purchase', 'sale', 'move_out', 'slaughter', 'death')),
  counterparty text not null default '',
  price        numeric(12, 2) check (price is null or price >= 0),
  weight       numeric(8, 2) check (weight is null or weight > 0),
  notes        text not null default '',
  updated_at   timestamptz not null default now()
);
create index movements_farm_idx on movements (farm_id);
create index movements_animal_idx on movements (animal_id);

create table feeds (
  id          uuid primary key,
  farm_id     uuid not null references farms (id) on delete cascade,
  name        text not null check (char_length(trim(name)) > 0),
  qty         numeric(12, 2) not null default 0,
  unit        text not null default 'kq',
  min_qty     numeric(12, 2) not null default 0,
  notes       text not null default '',
  updated_at  timestamptz not null default now()
);
create index feeds_farm_idx on feeds (farm_id);

create table purchases (
  id          uuid primary key,
  farm_id     uuid not null references farms (id) on delete cascade,
  kind        text not null check (kind in ('med', 'feed')),
  item_id     uuid,
  item_name   text not null,
  date        date not null,
  qty         numeric(12, 2) not null check (qty > 0),
  unit        text not null default '',
  price       numeric(12, 2) check (price is null or price >= 0),
  supplier    text not null default '',
  batch       text not null default '',
  expiry      date,
  notes       text not null default '',
  updated_at  timestamptz not null default now()
);
create index purchases_farm_idx on purchases (farm_id);
create index purchases_item_idx on purchases (item_id);

create table milk_records (
  id          uuid primary key,
  farm_id     uuid not null references farms (id) on delete cascade,
  date        date not null,
  liters      numeric(10, 1) not null check (liters > 0),
  fat         numeric(4, 2) check (fat is null or fat between 0 and 15),
  protein     numeric(4, 2) check (protein is null or protein between 0 and 10),
  scc         integer check (scc is null or scc >= 0),
  buyer       text not null default '',
  price       numeric(12, 2) check (price is null or price >= 0),
  notes       text not null default '',
  updated_at  timestamptz not null default now()
);
create index milk_records_farm_idx on milk_records (farm_id);

-- Saytın əlaqə formasından gələn müraciətlər
create table leads (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name       text not null check (char_length(trim(name)) between 1 and 120),
  phone      text not null check (char_length(trim(phone)) between 5 and 40),
  region     text not null default '' check (char_length(region) <= 120),
  herd_size  text not null default '' check (char_length(herd_size) <= 20),
  plan       text not null default '' check (char_length(plan) <= 40),
  message    text not null default '' check (char_length(message) <= 2000),
  handled    boolean not null default false
);
create index leads_created_idx on leads (created_at desc);

-- ---------------------------------------------------------------------------
-- Triggerlər
-- ---------------------------------------------------------------------------
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Uşaq qeydin heyvanı başqa fermaya aid ola bilməz.
create or replace function check_animal_farm()
returns trigger language plpgsql as $$
begin
  if not exists (select 1 from animals a where a.id = new.animal_id and a.farm_id = new.farm_id) then
    raise exception 'animal % does not belong to farm %', new.animal_id, new.farm_id using errcode = '23503';
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['users', 'farms', 'animals', 'treatments', 'weights', 'breedings', 'tasks', 'meds',
                           'preg_checks', 'heats', 'movements', 'feeds', 'purchases', 'milk_records'] loop
    execute format('create trigger %I before update on %I for each row execute function touch_updated_at()', t || '_touch', t);
  end loop;
  foreach t in array array['treatments', 'weights', 'breedings', 'preg_checks', 'heats', 'movements'] loop
    execute format('create trigger %I before insert or update on %I for each row execute function check_animal_farm()', t || '_animal_farm', t);
  end loop;
end;
$$;
