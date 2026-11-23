# Sürü daxili serveri — Supabase-in əvəzi

Fiziki (öz) serverdə işləyən tam backend: **PostgreSQL + REST API + şəkil anbarı + HTTPS + gündəlik ehtiyat nüsxə**.
Mobil tətbiq, veb panel və saytın əlaqə forması Supabase əvəzinə bu serverə qoşulur — ekranlara və biznes
məntiqinə toxunmadan, yalnız konfiqurasiya ilə (`EXPO_PUBLIC_BACKEND=rest`).

```
 Telefon / veb panel / sayt
            │  HTTPS
            ▼
 ┌──────────────────────── fiziki server (docker compose) ────────────────────────┐
 │  caddy  ── avtomatik HTTPS (Let's Encrypt), api.suru.az [+ suru.az, /panel]     │
 │    │                                                                            │
 │  api    ── Node.js (Hono): giriş, ferma məlumatı, şəkillər, myGov, müraciətlər  │
 │    │            └── şəkillər: /data/photos/<farm_id>/<fayl>.jpg                 │
 │  db     ── PostgreSQL 17 (xaricə açıq deyil)                                    │
 │  backup ── hər gecə pg_dump + şəkillər (tar.gz), 14 gün saxlanılır              │
 └─────────────────────────────────────────────────────────────────────────────────┘
```

| Supabase-də | Bu serverdə |
|---|---|
| Postgres cədvəlləri (`/supabase/migrations`) | Eyni cədvəllər, eyni sütunlar — `db/migrations/0001_init.sql` |
| Auth (`auth.users`, JWT) | `users` + `sessions` cədvəlləri, şifrələr **scrypt**; Supabase-dən gələn **bcrypt** hash-lər qəbul olunur (istifadəçilər eyni şifrə ilə girir) |
| Row Level Security | Hər sorğu API qatında istifadəçinin fermasına məhdudlaşdırılır (`src/farm.ts`), rollar: owner/worker/vet/viewer |
| Storage `animal-photos` | Diskdə fayllar, eyni yol formatı; imzalı, 7 günlük URL-lər |
| Edge Function `mygov-auth` | Eyni kod (`supabase/functions/mygov-auth/handler.ts`) — `/auth/mygov/*` |
| `leads` (saytın forması) | `POST /leads` |

API müqaviləsi: [`mobile/docs/BACKEND.md`](../mobile/docs/BACKEND.md). Sahə adlarının çevrilməsi tətbiqlə
**eyni modul**dan gəlir (`mobile/src/data/mapping.ts`) — tətbiq və server ayrı düşə bilməz.

---

## 1. Serverin qurulması

**Tövsiyə olunan avadanlıq** (bir neçə min fermaya qədər): 2–4 nüvə, 4–8 GB RAM, 100 GB+ SSD
(fiziki serverdə **RAID 1** — iki disk), Ubuntu Server 24.04 LTS, UPS. Statik xarici IP; NAT arxasındadırsa,
routerdə 80 və 443 portları serverə yönləndirilməlidir.

```bash
# 1) Docker
curl -fsSL https://get.docker.com | sh

# 2) Firewall: yalnız SSH, HTTP, HTTPS
sudo ufw allow OpenSSH && sudo ufw allow 80,443/tcp && sudo ufw allow 443/udp && sudo ufw enable

# 3) Kod
sudo git clone https://github.com/Lavash-droid/KTN.git /opt/suru && cd /opt/suru/server
sudo cp .env.example .env && sudo nano .env
```

`.env`-də mütləq doldurun:

| Dəyişən | Nə |
|---|---|
| `API_DOMAIN`, `PUBLIC_URL` | məs. `api.suru.az` və `https://api.suru.az`. **DNS A qeydi** bu serverin IP-sinə yönəlməlidir |
| `POSTGRES_PASSWORD` | `openssl rand -hex 24` |
| `PHOTO_URL_SECRET` | `openssl rand -hex 32` |
| `CORS_ORIGINS` | veb panelin və saytın ünvanları: `https://suru.az,https://www.suru.az` |

```bash
# 4) İşə salmaq (ilk dəfə image yığılır, ~2 dəq.)
sudo docker compose up -d --build
sudo docker compose ps                 # hamısı "Up", api "healthy"
curl https://api.suru.az/health        # {"ok":true}
```

Server açılanda sxem miqrasiyaları avtomatik tətbiq olunur. Sertifikatı Caddy özü alır və yeniləyir.

**Saytı və /panel-i də bu serverdən vermək** (Vercel-dən tam çıxmaq) — `deploy/sites/site.caddy.example`-a baxın.

### Gündəlik işlər

```bash
cd /opt/suru/server
sudo docker compose logs -f api                      # loglar
sudo docker compose exec api node dist/cli.js stats  # istifadəçi / ferma / heyvan sayı
sudo docker compose exec api node dist/cli.js leads  # saytdan gələn son müraciətlər
sudo git pull && sudo docker compose up -d --build   # yeni versiya (miqrasiyalar avtomatik)
```

Monitorinq üçün `https://api.suru.az/health` ünvanını hər dəqiqə yoxlayan xidmət qoşun (Uptime Kuma, UptimeRobot).

---

## 2. Ehtiyat nüsxə və bərpa

`backup` xidməti hər gecə (`BACKUP_HOUR`, standart 03:00 Bakı vaxtı) `BACKUP_DIR`-ə yazır:
`db-YYYYmmdd-HHMM.dump` (PostgreSQL) və `photos-YYYYmmdd-HHMM.tar.gz` (şəkillər). `BACKUP_KEEP_DAYS` gündən
köhnələri silinir.

> **Vacib:** eyni diskdəki nüsxə disk sıradan çıxanda kömək etmir. Nüsxələri hər gün başqa yerə köçürün —
> ikinci server, NAS və ya şifrələnmiş bulud (`rclone sync /opt/suru/server/backups remote:suru-backups`).
> Ayda bir dəfə bərpanı sınayın.

```bash
sudo docker compose exec backup sh /backup.sh once            # indi nüsxə çıxar

# Bərpa (mövcud məlumatı nüsxə ilə ƏVƏZ edir):
sudo docker compose exec -T db pg_restore -U suru -d suru --clean --if-exists < backups/db-20261201-0300.dump
sudo docker compose run --rm -v "$PWD/backups:/backups" api sh -c 'tar -xzf /backups/photos-20261201-0300.tar.gz -C /data'
```

---

## 3. Tətbiqi serverə qoşmaq

| Hara | Nə dəyişir |
|---|---|
| Telefon tətbiqi — `mobile/eas.json` (`build.base.env`) | `EXPO_PUBLIC_BACKEND=rest`, `EXPO_PUBLIC_API_URL=https://api.suru.az` |
| Veb panel — `mobile/.env.production` | eyni iki dəyişən (Supabase dəyişənləri silinə bilər) |
| Sayt — `website/config.js` | `apiUrl: 'https://api.suru.az'` → əlaqə forması serverə yazır |
| myGov | provayderdə yeni qayıdış ünvanı: `https://api.suru.az/auth/mygov/callback`; `MYGOV_*` dəyişənləri `.env`-ə |

myGov üçün `MYGOV_ID_SECRET` **Supabase-dəki ilə eyni** olmalıdır — yoxsa myGov ilə girən istifadəçilər
köhnə hesablarına bağlanmır (FİN-in HMAC dəyəri bu açarla hesablanır). `MYGOV_STATE_SECRET` yeni ola bilər.

---

## 4. Supabase-dən keçid (məlumat itkisi olmadan)

Problem: tətbiq mağazalarda dərhal yenilənmir — keçiddən sonra bəzi fermerlər bir müddət **köhnə versiya** ilə
Supabase-ə yazmağa davam edəcək. Ona görə keçid üç hissədən ibarətdir:

1. **Köçürmə skripti** (`scripts/migrate-from-supabase.ts`) — istifadəçiləri (eyni id və şifrə ilə), bütün
   cədvəlləri və şəkilləri köçürür; id-lər dəyişmir.
2. **Keçid dövrü sinxronizasiyası** (`--continue`) — Supabase bir müddət açıq qalır; köhnə versiyanın yazıları
   saatda bir serverə ötürülür. Hər iki tərəfdə dəyişən qeyddə **daha yeni olan qalır** (`updated_at`).
3. **Tətbiqdə avtomatik ötürmə** — yeni versiya açılanda, köhnə versiyanın keşi və internetsiz edilmiş, hələ
   göndərilməmiş dəyişiklikləri yeni serverə göndərilir (`mobile/src/store/farmStore.ts` →
   `adoptFromPreviousBackend`). Bu kod bu commit-dən sonrakı **istənilən** yeni versiyada var.

Supabase məlumatları serverdə `/opt/suru/server/supabase.env` faylına yazılır (repoya düşmür; `sudo chmod 600 supabase.env`):
```bash
# Dashboard → Connect → Session pooler (IPv4) bağlantı sətri, DB şifrəsi ilə
SUPABASE_DB_URL=postgres://postgres.rutlmhwzintycizfpgyv:<DB-şifrə>@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
SUPABASE_URL=https://rutlmhwzintycizfpgyv.supabase.co
# Settings → API Keys → secret (service_role) açarı — yalnız şəkilləri yükləmək üçün
SUPABASE_SERVICE_ROLE_KEY=<açar>
```
Köçürmə `supabase-sync` xidməti ilə işləyir (`docker compose up` onu başlatmır):

### Mərhələ 1 — məşq (istifadəçilər heç nə hiss etmir)
```bash
sudo docker compose run --rm supabase-sync     # tam köçürmə; təkrar işlətmək təhlükəsizdir
```
Sonda say cədvəli çap olunur (Supabase = server), tapılmayan şəkillər ayrıca göstərilir.
Sonra test: `mobile/.env`-də `EXPO_PUBLIC_BACKEND=rest` və `EXPO_PUBLIC_API_URL` ilə paneli lokal açın
(`cd mobile && npx expo start --web`), **real hesabla, köhnə şifrə ilə** daxil olun, məlumatı və şəkilləri yoxlayın.

### Mərhələ 2 — yeni tətbiq versiyası (keçiddən 1–2 həftə əvvəl)
`mobile/eas.json`-da backend dəyişənlərini dəyişin, `eas build` + `eas submit`. Mağazalarda **əl ilə buraxılış**
seçin (App Store: *Manually release this version*; Google Play: *Managed publishing*) — versiya yoxlanılıb
hazır gözləyir, keçid anında bir düymə ilə buraxılır.

### Mərhələ 3 — keçid anı (az istifadə olunan saat, məs. gecə)
```bash
sudo docker compose run --rm supabase-sync --reset   # hədəfi təmizləyib Supabase-in son vəziyyətini köçürür, keçid nişanını qoyur
```
Dərhal ardınca:
1. Veb panel və sayt: `mobile/.env.production` və `website/config.js` dəyişikliyini deploy edin.
2. Mağazalarda yeni versiyanı buraxın.
3. myGov provayderində qayıdış ünvanını yeniləyin (bölmə 3).

### Mərhələ 4 — keçid dövrü (2–4 həftə)
Supabase **açıq qalır**. Hər saat köhnə versiyanın yazıları ötürülür (`crontab -e`, root):
```cron
7 * * * * cd /opt/suru/server && docker compose run --rm supabase-sync --continue >> /var/log/suru-sync.log 2>&1
```
- Hər iş əvvəlkinin qaldığı yerdən davam edir (nişan serverin bazasındadır).
- Yeni qeydlər və dəyişikliklər ötürülür; serverdəki daha yeni versiya əzilmir; artıq ötürülüb sonra yeni
  tətbiqdə silinmiş qeyd geri gəlmir.
- Yazıla bilməyən sətirlər (məs. eyni e-poçtla iki sistemdə ayrı qeydiyyat) logda `⚠` ilə göstərilir — əl ilə həll edin.
- **Məhdudiyyət:** köhnə versiyada edilən **silmələr** ötürülmür. Ona görə keçid dövrünü qısa saxlayın.

Köhnə versiyanın istifadəsi bitəndə (Supabase → Logs/Reports-da `rest/v1` sorğuları sıfıra yaxın): cron-u
dayandırın, sonuncu dəfə `sudo docker compose run --rm supabase-sync --continue` işlədin, Supabase layihəsini **Pause** edin.
Bir neçə ay sonra (geri qayıtma ehtiyacı olmadığına əmin olanda) silin.

**Geri qayıtma:** ilk saatlarda problem olarsa — veb/sayt konfiqurasiyasını geri qaytarın və mağazada
əvvəlki versiyaya qayıdın. Bu müddətdə serverə yazılan məlumat Supabase-ə avtomatik qayıtmır.

---

## 5. İnkişaf və testlər

```bash
cd server && npm install
# Lokal Postgres (məs. docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=dev postgres:17-alpine)
DATABASE_URL=postgres://postgres:dev@localhost:5432/postgres PUBLIC_URL=http://localhost:8080 \
PHOTO_URL_SECRET=dev-dev-dev-dev-dev-dev-dev-dev-dev-dev npm run dev

TEST_DATABASE_URL=postgres://postgres:dev@localhost:5432/postgres npm test   # hər test faylı öz bazasını yaradıb silir
npm run typecheck
```

Testlər real PostgreSQL ilə işləyir: API müqaviləsi (bütün cədvəllərin dəyişmədən qayıtması, idempotent upsert,
fermalar arası təcrid, rollar, şəkillər, hesabın silinməsi), myGov (saxta OIDC provayderi ilə), və Supabase-dən
köçürmə — mənbə baza **repodakı real `supabase/migrations`** ilə qurulur.

| Fayl | Nə edir |
|---|---|
| `src/app.ts` | marşrutlar, xəta formatı (`{ message }`), CORS, limitlər |
| `src/routes/*.ts` | `auth`, `data` (ferma/qeydlər), `photos`, `mygov`, `leads` |
| `src/records.ts` | oxuma/yazma — upsert, silmə, tam bərpa |
| `src/auth.ts` | şifrələr, sessiyalar (tokenin yalnız SHA-256 hash-i saxlanılır) |
| `src/storage.ts` | şəkil anbarı (disk); S3/MinIO lazım olsa `PhotoStore` interfeysini reallaşdırın |
| `db/migrations/` | sxem; yeni dəyişiklik = yeni `000N_*.sql` faylı |
| `scripts/migrate-from-supabase.ts` | Supabase-dən köçürmə və keçid dövrü sinxronizasiyası |
| `deploy/` | Caddy, ehtiyat nüsxə skripti |

### Təhlükəsizlik qeydləri
- Baza portu xaricə açılmır; `.env` və `supabase.env` yalnız root oxuya bilsin (`chmod 600`).
- Giriş cəhdləri e-poçt üzrə məhdudlaşdırılır (15 dəq.-də 10); IP limitləri mobil operatorların ortaq IP-si
  (CGNAT) nəzərə alınaraq yüksəkdir — `LIMIT_*` dəyişənləri ilə tənzimlənir.
- Şəkil faylları imzasız URL ilə açılmır; yükləmədə fayl tipi baytlardan yoxlanılır (JPEG/PNG/WebP).
- E-poçt təsdiqi və "şifrəni unutdum" hələ yoxdur — qeydiyyat dərhal aktiv olur. Lazım olanda SMTP ilə əlavə olunmalıdır.
