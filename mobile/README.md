# Sürü — mobil tətbiq (Expo)

iOS və Android üçün ferma idarəetmə tətbiqi. Köhnə veb-tətbiqin (`/app`, PWA) bütün imkanları
React Native + Expo-ya köçürülüb; məlumat **Supabase**-də saxlanılır, gələcəkdə daxili serverə keçmək
üçün backend qatı ayrıca saxlanılıb.

## İmkanlar
- Heyvan reyestri (inək, camış, qoyun, keçi), şəkil (kamera / qalereya), axtarış və filtrlər
- Müalicə jurnalı, **dərman qalığı** (ət/süd) son tarixləri, **qrup müalicəsi**
- **Dərman şkafı**: ehtiyat, son istifadə tarixi, az qalma xəbərdarlığı, müalicədə avtomatik çıxılma
- Mayalanma → gözlənilən doğum; "Doğdu" → bala formasının avtomatik açılması
- Çəki və orta gündəlik artım; tapşırıqlar; paneldə xatırlatmalar
- CSV (Excel) ixrac, JSON ehtiyat nüsxə; **köhnə PWA-nın ehtiyat faylını idxal** (şəkillər daxil)
- Hesab (e-poçt + şifrə), bir neçə cihaz, **internetsiz iş**: dəyişikliklər cihazda növbəyə düşür
  və bağlantı bərpa olunanda serverə göndərilir

## Quraşdırma

```bash
cd mobile
npm install
cp .env.example .env   # Supabase URL və publishable açarı yazın
npx expo start         # Expo Go ilə QR kodu skan edin
```

`.env` boş qalsa tətbiq **lokal rejimdə** (yalnız cihazda, hesabsız) işləyir — sınaq üçün əlverişlidir.

### Supabase
1. Supabase-də yeni layihə yaradın.
2. Sxemi tətbiq edin: `supabase/migrations/20261123000000_suru_init.sql` (SQL Editor-da işə salın
   və ya `supabase db push`). Bu, cədvəlləri, Row Level Security qaydalarını və `animal-photos` bucket-ini yaradır.
3. Project Settings → API-dən URL və **publishable** (və ya anon) açarı `.env`-ə yazın.
   `service_role` açarını heç vaxt tətbiqə qoymayın.
4. Authentication → Providers → Email: test zamanı "Confirm email"-i söndürmək olar.

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

## Yoxlama

```bash
npm run typecheck
npx expo export --platform web   # bundle yoxlaması
```

## Mağazaya çıxarış (EAS)

```bash
npx eas-cli@latest build --platform android   # .aab / .apk
npx eas-cli@latest build --platform ios
```

Paket adı: `az.suru.app` (`app.json`). İlk build-dən əvvəl `npx eas-cli@latest init` ilə layihəni bağlayın.
