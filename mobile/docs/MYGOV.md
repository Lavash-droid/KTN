# myGov ilə giriş (dövlət vahid girişi)

İstifadəçi "myGov ilə daxil ol" düyməsini basır, dövlət giriş səhifəsində SİMA, ASAN İmza və ya
dövlət hesabı ilə təsdiqlənir və tətbiqə qayıdır. Qeydiyyat və şifrə tələb olunmur. Telefonda, planşetdə
və vebdə eyni işləyir.

## Vəziyyət

| Hissə | Vəziyyət |
|---|---|
| Server (Supabase Edge Function `mygov-auth`) | ✅ yazılıb, test olunub, "suru" layihəsinə **yerləşdirilib** — açarlar təyin olunanadək `503` qaytarır |
| Daxili server (`/server`, `/auth/mygov/*`) | ✅ eyni kod (`handler.ts`); qayıdış ünvanı `https://<API_DOMAIN>/auth/mygov/callback`, açarlar `server/.env`-də. `MYGOV_ID_SECRET` Supabase-dəki ilə eyni olmalıdır |
| Verilənlər bazası (`private.external_identities`) | ✅ tətbiq olunub |
| Tətbiq (düymə, qayıdış səhifəsi `/mygov`) | ✅ hazırdır, `EXPO_PUBLIC_MYGOV_ENABLED=true` olanda görünür |
| **Provayderin açarları və texniki sənədi** | ⏳ **İRİA ilə müqavilədən sonra** |

## Provayder: kimə müraciət etmək lazımdır

Dövlət girişinin texniki sənədləri açıq dərc olunmur — inteqrasiya müqavilə əsasında verilir.

- **digital.login** — İnnovasiya və Rəqəmsal İnkişaf Agentliyi (İRİA). Vahid giriş platforması, SİMA və ASAN İmza
  ilə giriş; özəl şirkətlər də qoşula bilir. Tövsiyə olunan seçim.
- **ASAN Login** (asanlogin.my.gov.az) — E-GOV İnkişaf Mərkəzi; myGov portalının istifadə etdiyi giriş.

Müraciətdə bunları istəyin:
1. OAuth 2.0 / OpenID Connect ilə inteqrasiya (Authorization Code axını) və texniki sənəd
2. `client_id` və `client_secret`
3. Qayıdış (redirect) ünvanının qeydiyyatı:
   `https://rutlmhwzintycizfpgyv.supabase.co/functions/v1/mygov-auth/callback`
4. Hansı məlumatların (claim) veriləcəyi: unikal identifikator (FİN və ya `sub`), ad, soyad
5. Test (sandbox) mühiti

## Açarları təyin etmək

Supabase → Edge Functions → Secrets (və ya `supabase secrets set ...`):

| Açar | Məcburi | Təsvir |
|---|---|---|
| `MYGOV_CLIENT_ID` | ✅ | Provayderin verdiyi client ID |
| `MYGOV_CLIENT_SECRET` | ✅ | Provayderin verdiyi secret (yalnız serverdə qalır) |
| `MYGOV_ISSUER` | ✅* | OIDC issuer — endpoint-lər `/.well-known/openid-configuration`-dan götürülür |
| `MYGOV_AUTHORIZE_URL`, `MYGOV_TOKEN_URL`, `MYGOV_USERINFO_URL` | ✅* | Discovery yoxdursa — birbaşa ünvanlar (*`MYGOV_ISSUER` və ya bu ikisi) |
| `MYGOV_STATE_SECRET` | ✅ | ≥ 32 simvol təsadüfi sətir (`openssl rand -base64 48`) |
| `MYGOV_ID_SECRET` | ✅ | ≥ 32 simvol təsadüfi sətir. **Sonradan dəyişdirməyin** — istifadəçilər hesablarına bağlılığı itirər |
| `MYGOV_ALLOWED_REDIRECTS` | ✅ | Vergüllə: `suru://,https://app.suru.az,http://localhost:8081` (inkişaf zamanı Expo Go üçün `exp://` də) |
| `MYGOV_SUBJECT_CLAIM` | | İstifadəçini təyin edən claim — standart `sub`; provayder FİN verirsə məs. `fin` |
| `MYGOV_NAME_CLAIM` | | Ad üçün claim (standart: `name` və ya `given_name` + `family_name`) |
| `MYGOV_SCOPE` | | Standart `openid profile` |
| `MYGOV_TOKEN_AUTH` | | `client_secret_basic` (standart) və ya `client_secret_post` |
| `MYGOV_PKCE` | | `false` — provayder PKCE dəstəkləmirsə |
| `MYGOV_EXTRA_AUTHORIZE_PARAMS` | | Əlavə parametrlər, JSON: `{"acr_values":"sima"}` |

Sonra tətbiqdə `EXPO_PUBLIC_MYGOV_ENABLED=true` edin (`.env`, `eas.json`, veb hostinqin env dəyişənləri).

Provayderin protokolu standart OIDC-dən fərqlənərsə, yalnız `supabase/functions/mygov-auth/handler.ts`
dəyişdirilir — tətbiq və verilənlər bazası toxunulmaz qalır.

## Necə işləyir

```
Tətbiq ──► /mygov-auth/start?redirect_to=suru://mygov
             │  state (AES-GCM ilə şifrələnmiş: qayıdış ünvanı, PKCE, nonce, 10 dəq.)
             ▼
        myGov / digital.login giriş səhifəsi  (SİMA, ASAN İmza…)
             │  ?code=…&state=…
             ▼
        /mygov-auth/callback
             │  code → token (client_secret serverdə), id_token yoxlaması (aud, exp, iss, nonce)
             │  FİN → HMAC-SHA256 → hesab tapılır və ya yaradılır
             │  birdəfəlik giriş tokeni
             ▼
Tətbiq ◄── suru://mygov#token_hash=…   →  supabase.auth.verifyOtp(...)  →  sessiya
```

**Məxfilik və təhlükəsizlik**
- FİN və ya digər şəxsiyyət identifikatoru **saxlanılmır** — yalnız gizli açarla hesablanmış HMAC dəyəri.
  Saxlanılan yeganə şəxsi məlumat ad-soyaddır (ferma sahibi kimi göstərmək üçün).
- `client_secret` tətbiqə düşmür; kod-token mübadiləsi yalnız serverdə gedir.
- Qayıdış ünvanı icazəli siyahı ilə yoxlanılır (başqa sayta token göndərilə bilməz).
- state şifrələnib və imzalanıb; saxtalaşdırılmış və ya müddəti keçmiş sorğular rədd edilir.
- Token URL-in `#` hissəsində qaytarılır (server loglarına düşmür) və vebdə dərhal ünvan sətrindən silinir.
- myGov ilə yaradılan hesabın texniki e-poçtu (`mygov-…@mygov.suru.az`) heç yerdə göstərilmir və ona e-poçt göndərilmir.

## Testlər

`handler.ts` saxta OIDC provayderi ilə yoxlanılıb: PKCE, nonce, şifrələnmiş state, icazəsiz qayıdış ünvanı,
oxşar domen hücumu, saxtalaşdırılmış/müddəti keçmiş state, imtina, token xətası, eyni FİN → eyni hesab,
fərqli FİN → yeni hesab, FİN-in açıq saxlanmaması. Tətbiq tərəfi vebdə uçdan-uca sınanıb.
