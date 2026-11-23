-- 2-ci mərhələ: yem anbarı, alışlar (dərman və yem), süd çəni qeydləri.

-- Yem anbarı (qarğıdalı silosu, arpa, yonca, qarışıq yem…)
create table public.feeds (
  id          uuid primary key,
  farm_id     uuid not null references public.farms (id) on delete cascade,
  name        text not null check (char_length(trim(name)) > 0),
  qty         numeric(12, 2) not null default 0,
  unit        text not null default 'kq',
  min_qty     numeric(12, 2) not null default 0,
  notes       text not null default '',
  updated_at  timestamptz not null default now()
);
create index feeds_farm_idx on public.feeds (farm_id);

-- Alışlar: dərman və ya yem. item_id FK deyil (iki cədvələ aid ola bilər);
-- maddə silinsə də xərc tarixçəsi qalır — ad item_name-də saxlanılır.
create table public.purchases (
  id          uuid primary key,
  farm_id     uuid not null references public.farms (id) on delete cascade,
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
create index purchases_farm_idx on public.purchases (farm_id);
create index purchases_item_idx on public.purchases (item_id);

-- Süd çəni (südçülük müəssisəsinə təhvil / ölçmə)
create table public.milk_records (
  id          uuid primary key,
  farm_id     uuid not null references public.farms (id) on delete cascade,
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
create index milk_records_farm_idx on public.milk_records (farm_id);

do $$
declare
  t text;
begin
  foreach t in array array['feeds', 'purchases', 'milk_records'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated_at()', t || '_touch', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (private.is_farm_member(farm_id))', t || ': üzvlər görür', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (private.can_write_farm(farm_id))', t || ': əlavə', t);
    execute format('create policy %I on public.%I for update to authenticated using (private.can_write_farm(farm_id)) with check (private.can_write_farm(farm_id))', t || ': yeniləmə', t);
    execute format('create policy %I on public.%I for delete to authenticated using (private.can_write_farm(farm_id))', t || ': silmə', t);
  end loop;
end;
$$;
