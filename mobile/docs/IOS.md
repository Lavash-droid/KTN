# iOS — test və App Store-a çıxarış

Tətbiqin kodu iOS və Android üçün eynidir. iOS build-i **EAS Build** ilə Expo-nun buludunda yığılır —
Mac və Xcode lazım deyil.

## Hazır olanlar

| | |
|---|---|
| Bundle ID | `az.suru.app` (`app.json` → `ios.bundleIdentifier`) |
| Minimum iOS | 16.4 |
| Cihazlar | iPhone və iPad (`supportsTablet: true`) |
| İcazə mətnləri | Kamera və foto qalereya — azərbaycanca (`expo-image-picker` plugini) |
| Şifrələmə bəyannaməsi | `ITSAppUsesNonExemptEncryption = false` — yalnız standart HTTPS; hər build-də ixrac sualı çıxmır |
| Məxfilik manifesti | `ios.privacyManifests` — toplanan data (e-poçt, şəkillər, ferma qeydləri; izləmə yoxdur) və istifadə olunan API səbəbləri |
| Hesabın silinməsi | Digər → Hesab və sinxronizasiya → **Hesabı sil** (Apple qaydası 5.1.1(v)) |
| Build profilləri | `eas.json`: `simulator`, `preview`, `production`. Supabase açarları profillərdədir (`.env` build-ə düşmür) |
| Versiya nömrələri | EAS idarə edir (`appVersionSource: remote`, `production` → `autoIncrement`) |

## 1. Bir dəfəlik hazırlıq

1. **Apple Developer Program** üzvlüyü (ildə 99 USD): https://developer.apple.com/programs/
   Şirkət adı ilə çıxmaq üçün D-U-N-S nömrəsi lazımdır (MMC qeydiyyatından sonra).
2. **Expo hesabı**: https://expo.dev/signup
3. Layihəni EAS-a bağlayın (`app.json`-a `extra.eas.projectId` yazılacaq — commit edin):
   ```bash
   cd mobile
   npx eas-cli@latest login
   npx eas-cli@latest init
   ```

## 2. Test

**Ən sürətli — Expo Go (build lazım deyil):** iPhone-a App Store-dan *Expo Go* yükləyin, sonra
`npx expo start` edin və QR kodu iPhone kamerası ilə skan edin. İstifadə olunan bütün modullar Expo Go-da var.

**iOS simulyatoru üçün build (Mac-da):**
```bash
npx eas-cli@latest build --platform ios --profile simulator
```

**Real iPhone-lara daxili paylama (ad hoc):** əvvəlcə test cihazlarını qeydiyyata salın, sonra build:
```bash
npx eas-cli@latest device:create
npx eas-cli@latest build --platform ios --profile preview
```

**TestFlight (tövsiyə olunur — 10 000-ə qədər tester):** aşağıdakı production build + submit, sonra
App Store Connect → TestFlight-da testerləri əlavə edin.

## 3. App Store-a göndərmək

```bash
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest submit --platform ios --latest
```
İlk dəfə EAS Apple hesabınıza daxil olmağı, sertifikat və provisioning profile-ı avtomatik yaratmağı
və App Store Connect-də tətbiq qeydi açmağı təklif edəcək.

## 4. App Store Connect-də doldurulmalı olanlar

- **Ad / alt başlıq:** Sürü — Ferma idarəetməsi
- **Kateqoriya:** Productivity (əsas), Business (əlavə)
- **Məxfilik siyasəti URL-i** — məcburidir. `docs/mexfilik-siyaseti.md` saytda dərc olunmalıdır (məs. `https://suru.az/mexfilik`).
- **Dəstək URL-i** — tanıtım saytı (`website/`).
- **App Privacy (məlumat etiketləri)** — manifestlə uyğun cavablar:
  - *Contact Info → Email Address*: toplanır, istifadəçiyə bağlıdır, izləmə üçün deyil, məqsəd — App Functionality
  - *User Content → Photos or Videos* və *Other User Content*: eyni
  - *Tracking*: **No**
- **Ekran görüntüləri:** 6.9" iPhone (1320×2868) mütləqdir; iPad dəstəkləndiyi üçün 13" iPad (2064×2752) də lazımdır.
  iPad-i hələlik istəmirsinizsə, `app.json`-da `supportsTablet: false` edin.
- **App Review üçün demo hesab** — məcburidir. Supabase-də test hesabı yaradın, içində
  "Nümunə məlumat yüklə" ilə data olsun, e-poçt/şifrəni "App Review Information" bölməsinə yazın.
- **Yaş reytinqi:** 4+ (sual vərəqəsində hamısı "None").

## 5. Göndərməzdən əvvəl yoxlama siyahısı

- [ ] Supabase → Authentication → URL Configuration: təsdiq e-poçtundakı link işlək səhifəyə aparır
      (və ya Email provider-də "Confirm email" söndürülüb)
- [ ] Supabase → Authentication → Emails: SMTP qurulub (standart göndərici saatda bir neçə e-poçtla məhdudlaşır)
- [ ] Məxfilik siyasəti dərc olunub, linki App Store Connect-dədir
- [ ] Demo hesab işləyir
- [ ] "Hesabı sil" real hesabla sınanıb
- [ ] Qaranlıq rejim və iPad-də ekranlara baxılıb

## Tez-tez rədd olunma səbəbləri (və bizdə vəziyyət)

| Qayda | Vəziyyət |
|---|---|
| 5.1.1(v) Hesab silmə | ✅ tətbiqdə var |
| 5.1.1 İcazə mətnləri aydın olmalıdır | ✅ kamera/qalereya mətnləri məqsədi izah edir |
| 4.8 Sign in with Apple | Lazım deyil — yalnız e-poçt ilə giriş var (Google/Facebook girişi əlavə olunarsa, Apple ilə giriş də məcburi olacaq) |
| 2.1 Demo hesab | ⚠️ göndərərkən verilməlidir |
| 4.2 Minimum funksionallıq | ✅ tam funksional tətbiq |
