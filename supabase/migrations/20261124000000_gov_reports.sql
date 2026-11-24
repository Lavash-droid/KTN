-- Dövlət hesabatları: EKTİS (Kənd Təsərrüfatı Nazirliyi) və AQTA (Qida Təhlükəsizliyi Agentliyi).
-- Fermanın dövlət identifikatorları və təqdim olunmuş hesabatların jurnalı (hansı qeydlərin artıq bildirildiyi).

alter table public.farms
  add column if not exists ektis_no text not null default '',
  add column if not exists voen     text not null default '' check (voen = '' or voen ~ '^[0-9]{10}$');

create table public.gov_reports (
  id          uuid primary key,
  farm_id     uuid not null references public.farms (id) on delete cascade,
  agency      text not null check (agency in ('ektis', 'aqta')),
  date        date not null,
  status      text not null default 'sent' check (status in ('sent', 'accepted', 'rejected')),
  -- api: birbaşa inteqrasiya ilə; file: fayl ixrac edilib portala yüklənib / təqdim olunub
  method      text not null default 'file' check (method in ('api', 'file')),
  reference   text not null default '',
  -- Hesabata daxil olan qeydlərin açarları: "reg:<heyvan id>", "mv:<hərəkət id>", "tr:<müalicə id>"
  item_keys   text[] not null default '{}' check (cardinality(item_keys) <= 20000),
  notes       text not null default '',
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at  timestamptz not null default now()
);
create index gov_reports_farm_idx on public.gov_reports (farm_id);
create index gov_reports_created_by_idx on public.gov_reports (created_by);

create trigger gov_reports_touch before update on public.gov_reports for each row execute function public.touch_updated_at();
alter table public.gov_reports enable row level security;
create policy "gov_reports: üzvlər görür" on public.gov_reports for select to authenticated using (private.is_farm_member(farm_id));
create policy "gov_reports: əlavə" on public.gov_reports for insert to authenticated with check (private.can_write_farm(farm_id));
create policy "gov_reports: yeniləmə" on public.gov_reports for update to authenticated using (private.can_write_farm(farm_id)) with check (private.can_write_farm(farm_id));
create policy "gov_reports: silmə" on public.gov_reports for delete to authenticated using (private.can_write_farm(farm_id));
