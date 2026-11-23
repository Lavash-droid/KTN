# Sürü — mobil və veb tətbiq (Expo)

iOS, Android və **veb** (kompüter brauzeri) üçün ferma idarəetmə tətbiqi — eyni kod, eyni hesab. Köhnə veb-tətbiqin (`/app`, PWA) bütün imkanları
React Native + Expo-ya köçürülüb; məlumat **Supabase**-də saxlanılır, gələcəkdə daxili serverə keçmək
üçün backend qatı ayrıca saxlanılıb.

## İmkanlar
- Heyvan reyestri (inək, camış, qoyun, keçi), şəkil (kamera / qalereya), axtarış və filtrlər
- Müalicə jurnalı, **dərman qalığı** (ət/süd) son tarixləri, **qrup müalicəsi**
- **Dərman şkafı**: ehtiyat, son istifadə tarixi, az qalma xəbərdarlığı, müalicədə avtomatik çıxılma
- Mayalanma → gözlənilən doğum; "Doğdu" → bala formasının avtomatik açılması
- Çəki və orta gündəlik artım; tapşırıqlar; paneldə xatırlatmalar
- CSV (Excel) ixrac, JSON ehtiyat nüsxə; **köhnə PWA-nın ehtiyat faylını idxal** (şəkillər daxil)
- Hesab: e-poçt + şifrə və ya **myGov ilə giriş** (SİMA / ASAN İmza — [`docs/MYGOV.md`](docs/MYGOV.md)); tətbiqdən hesabın silinməsi, bir neçə cihaz, **internetsiz iş**: dəyişikliklər cihazda növbəyə düşür
  və bağlantı bərpa olunanda serverə göndərilir

## Quraşdırma

```bash
cd mobile
npm install
cp .env.example .env   # "suru" Supabase layihəsinin URL və açarı artıq yazılıb
npx expo start         # Expo Go ilə QR kodu skan edin
```

`.env` boş qalsa tətbiq **lokal rejimdə** (yalnız cihazda, hesabsız) işləyir — sınaq üçün əlverişlidir.

### Supabase
"suru" layihəsi (eu-central-1) artıq qurulub və `supabase/migrations/` içindəki sxem ona tətbiq olunub:
cədvəllər, Row Level Security qaydaları və `animal-photos` (gizli) bucket-i.

Yeni mühit (məs. ayrıca test layihəsi) qurmaq üçün:
1. Supabase-də layihə yaradın.
2. `supabase/migrations/` içindəki faylları ardıcıl tətbiq edin (SQL Editor və ya `supabase db push`).
3. Project Settings → API-dən URL və **publishable** açarı `.env`-ə yazın.
   `service_role` açarını heç vaxt tətbiqə qoymayın — publishable açar açıq olmaq üçündür, məlumatı RLS qoruyur.
4. Authentication → Providers → Email: test zamanı "Confirm email"-i söndürmək olar.

## Veb panel (kompüterdən idarə)

Eyni kod saytda `suru.az/panel` ünvanında işləyir (kompüter üçün yan panel, geniş görünüş). Tanıtım saytı ilə birlikdə bir sayt kimi yığılır və yerləşdirilir: [`docs/WEB.md`](docs/WEB.md). Yalnız panel üzərində işləmək: `npx expo start --web`.

## Struktur

```
src/
  app/            Ekranlar (Expo Router): (tabs)/ panel, heyvanlar, tapşırıqlar, digər; animal/[id], animal/form, meds, login
  domain/         Backend-dən asılı olmayan modellər və biznes məntiqi (dərman qalığı, artım, CSV, ehtiyat nüsxə)
  data/           Backend qatı — FarmRepository interfeysi və reallaşdırmalar:
    supabase/       indi
    rest/           gələcək daxili server (müqavilə: docs/BACKEND.md)
    local/          serversiz rejim
  store/          farmStore: yaddaş + keş + offline növbə (outbox) + sinxronizasiya; auth
  ui/             Ümumi komponentlər, tema (açıq/qaranlıq), formalar
```

**Daxili serverə keçid:** `docs/BACKEND.md`-dəki API-ni serverdə reallaşdırın və `.env`-də
`EXPO_PUBLIC_BACKEND=rest`, `EXPO_PUBLIC_API_URL=...` təyin edin. Ekranlar dəyişmir.

## İkonlar

Tətbiq və sayt eyni ikon dəstini işlədir: Material Design Icons (Apache 2.0) + Sürü üçün çəkilmiş keçi və camış.
Yeni ikon lazımdırsa, `scripts/gen-icons.mjs`-dəki siyahıya əlavə edib `node scripts/gen-icons.mjs` işə salın —
`src/ui/iconPaths.ts` (tətbiq), `website/icons.svg` (sayt) və loqo yenilənir. Tətbiq ikonları (PNG):
`node scripts/render-app-icons.cjs assets/logo.svg assets`.

## Yoxlama

```bash
npm run typecheck
npx expo export --platform web   # bundle yoxlaması
```

## Mağazaya çıxarış (EAS)

**iOS üçün ətraflı təlimat, App Store tələbləri və yoxlama siyahısı: [`docs/IOS.md`](docs/IOS.md).**

```bash
npx eas-cli@latest build --platform ios --profile production       # App Store / TestFlight
npx eas-cli@latest build --platform android --profile preview      # test üçün .apk
npx eas-cli@latest build --platform android --profile production   # Google Play üçün .aab
```

Paket adı: `az.suru.app` (`app.json`). İlk build-dən əvvəl `npx eas-cli@latest init` ilə layihəni bağlayın.
Build profilləri (`eas.json`) Supabase açarlarını özündə saxlayır, çünki `.env` faylı build-ə göndərilmir.
