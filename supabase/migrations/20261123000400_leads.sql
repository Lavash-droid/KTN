-- Saytın əlaqə formasından gələn müraciətlər (pilot proqram, paket sorğuları).
-- Sayt (anon) yalnız ƏLAVƏ edə bilər; oxumaq yalnız Supabase panelindən / service_role ilə.
create table public.leads (
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
alter table public.leads enable row level security;

revoke all on public.leads from anon, authenticated;
grant insert (name, phone, region, herd_size, plan, message) on public.leads to anon, authenticated;

create policy "leads: saytdan müraciət" on public.leads
  for insert to anon, authenticated
  with check (handled = false);
