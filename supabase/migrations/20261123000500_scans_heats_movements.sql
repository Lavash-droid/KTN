-- 1-ci mərhələ: boğazlıq yoxlaması, qızğınlıq və heyvan hərəkətləri (alış, satış, köçürmə, kəsim, ölüm).
-- İstifadə statistikasına görə ən çox işlənən funksiyalar: çəki, mayalanma, müalicə, boğazlıq yoxlaması, satış.

-- Yeni status: fermadan köçürülüb
alter table public.animals drop constraint if exists animals_status_check;
alter table public.animals add constraint animals_status_check
  check (status in ('aktiv', 'satilib', 'olub', 'kesilib', 'kocurulub'));

-- Boğazlıq yoxlaması (USM / əl ilə)
create table public.preg_checks (
  id          uuid primary key,
  farm_id     uuid not null references public.farms (id) on delete cascade,
  animal_id   uuid not null references public.animals (id) on delete cascade,
  breeding_id uuid references public.breedings (id) on delete set null,
  date        date not null,
  result      text not null check (result in ('positive', 'negative', 'uncertain')),
  fetuses     integer check (fetuses is null or fetuses between 0 and 6),
  method      text not null default 'scan' check (method in ('scan', 'manual')),
  notes       text not null default '',
  updated_at  timestamptz not null default now()
);
create index preg_checks_farm_idx on public.preg_checks (farm_id);
create index preg_checks_animal_idx on public.preg_checks (animal_id);
create index preg_checks_breeding_idx on public.preg_checks (breeding_id);

-- Qızğınlıq müşahidəsi
create table public.heats (
  id          uuid primary key,
  farm_id     uuid not null references public.farms (id) on delete cascade,
  animal_id   uuid not null references public.animals (id) on delete cascade,
  date        date not null,
  notes       text not null default '',
  updated_at  timestamptz not null default now()
);
create index heats_farm_idx on public.heats (farm_id);
create index heats_animal_idx on public.heats (animal_id);

-- Heyvan hərəkətləri: fermaya giriş (alış) və çıxış (satış, köçürmə, kəsim, ölüm)
create table public.movements (
  id           uuid primary key,
  farm_id      uuid not null references public.farms (id) on delete cascade,
  animal_id    uuid not null references public.animals (id) on delete cascade,
  date         date not null,
  type         text not null check (type in ('purchase', 'sale', 'move_out', 'slaughter', 'death')),
  counterparty text not null default '',
  price        numeric(12, 2) check (price is null or price >= 0),
  weight       numeric(8, 2) check (weight is null or weight > 0),
  notes        text not null default '',
  updated_at   timestamptz not null default now()
);
create index movements_farm_idx on public.movements (farm_id);
create index movements_animal_idx on public.movements (animal_id);

do $$
declare
  t text;
begin
  foreach t in array array['preg_checks', 'heats', 'movements'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated_at()', t || '_touch', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.check_animal_farm()', t || '_animal_farm', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (private.is_farm_member(farm_id))', t || ': üzvlər görür', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (private.can_write_farm(farm_id))', t || ': əlavə', t);
    execute format('create policy %I on public.%I for update to authenticated using (private.can_write_farm(farm_id)) with check (private.can_write_farm(farm_id))', t || ': yeniləmə', t);
    execute format('create policy %I on public.%I for delete to authenticated using (private.can_write_farm(farm_id))', t || ': silmə', t);
  end loop;
end;
$$;
