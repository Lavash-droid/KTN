# Vahid sayt: tanıtım + idarəetmə paneli

Bir sayt, bir domen:

| Ünvan | Nədir | Mənbə |
|---|---|---|
| `/` | Tanıtım saytı: imkanlar, qiymətlər, suallar, əlaqə forması | `website/` |
| `/panel` | **İdarəetmə paneli** — fermanı kompüterdən idarə etmək | `mobile/` (mobil tətbiqlə eyni kod) |
| `/mexfilik.html` | Məxfilik siyasəti (App Store / Google Play bu ünvanı tələb edir) | `docs/mexfilik-siyaseti.md`-dən avtomatik |

Panel mobil tətbiqlə **eyni kod**dur: telefona əlavə olunan hər funksiya avtomatik saytda da görünür.
Eyni hesabla telefonda və kompüterdə eyni ferma görünür (Supabase-də sinxronlaşır).

**Kompüter görünüşü (ekran ≥ 900 px):** solda loqo, ferma adı, menyu, sinxronizasiya vəziyyəti və "ana səhifə"
linki olan yan panel; geniş məzmun; əsas səhifə iki sütunda; heyvan siyahısında qrup / son çəki / status sütunları;
formalar ekranın ortasında dialoq kimi açılır. Telefonda isə alt menyu və aşağıdan çıxan formalar.

**Əlaqə forması** müraciətləri Supabase-dəki `leads` cədvəlinə yazır. Sayt yalnız yaza bilir, oxuya bilməz.
Müraciətlərə baxmaq: Supabase → Table Editor → `leads`.

## Lokal

```bash
npm install && npm install --prefix mobile   # bir dəfə, repo kökündə
npm run build                                # → site-dist/
npx serve site-dist -s                       # http://localhost:3000 və /panel
```
Yalnız panel üzərində işləyərkən (avtomatik yenilənmə ilə): `cd mobile && npx expo start --web`.

Panelin Supabase ayarları `mobile/.env`-dən götürülür (`cp mobile/.env.example mobile/.env`).

## İnternetdə yerləşdirmək — Vercel (`vercel.json` hazırdır)

1. Vercel → New Project → GitHub reposu. **Root Directory: repo kökü** (boş saxlayın).
2. Environment Variables (panelin build-i üçün):
   - `EXPO_PUBLIC_BACKEND=supabase`
   - `EXPO_PUBLIC_SUPABASE_URL=https://rutlmhwzintycizfpgyv.supabase.co`
   - `EXPO_PUBLIC_SUPABASE_KEY=sb_publishable_…` (`mobile/.env.example`-dəki dəyər)
   - `EXPO_PUBLIC_MYGOV_ENABLED=false` (myGov aktivləşəndə `true`)
3. Deploy. Domen: Settings → Domains → `suru.az`.
4. myGov üçün `https://suru.az` ünvanını Edge Function-un `MYGOV_ALLOWED_REDIRECTS` siyahısına əlavə edin.

**Başqa hostinq (nginx və s.):** `site-dist/` qovluğunu yükləyin. Yeganə tələb — panel üçün SPA qaydası:
```nginx
location /panel/ { try_files $uri /panel/index.html; }
```
