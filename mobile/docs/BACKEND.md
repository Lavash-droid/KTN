# Backend müqaviləsi — daxili serverə keçid üçün

Tətbiq məlumatla yalnız `src/data/repository.ts`-dəki `FarmRepository` interfeysi vasitəsilə işləyir.
Hazırda üç reallaşdırma var:

| `EXPO_PUBLIC_BACKEND` | Fayl | Nə vaxt |
|---|---|---|
| `supabase` | `src/data/supabase/SupabaseRepository.ts` | **İndi** — Supabase (Postgres + Auth + Storage) |
| `rest` | `src/data/rest/RestRepository.ts` | **Gələcək** — öz (daxili) serveriniz |
| `local` | `src/data/local/LocalRepository.ts` | Server olmadan sınaq / inkişaf |

Daxili server hazır olanda ekranlara, biznes məntiqinə və offline növbəyə toxunmaq lazım deyil:

1. Server aşağıdakı API-ni reallaşdırır (və ya `RestRepository.ts` serverin mövcud API-sinə uyğunlaşdırılır).
2. `.env`: `EXPO_PUBLIC_BACKEND=rest`, `EXPO_PUBLIC_API_URL=https://...`
3. Supabase-dən köçürmə: tətbiqdə **Digər → Ehtiyat nüsxə (JSON)** ixrac edib serverə `PUT /farm/data` ilə yükləmək
   və ya birbaşa Postgres dump (sxem: `/supabase/migrations`). Cədvəllər standart Postgres-dir — Supabase-ə bağlı deyil
   (yalnız `auth.users` və `storage.objects` istinadları əvəz olunmalıdır).

## Ümumi qaydalar

- JSON, sahə adları **camelCase** (bax: `src/domain/types.ts`). Tarixlər `YYYY-MM-DD`, boş tarix — `null`.
- Kimlik: `Authorization: Bearer <token>`. `401` cavabında tətbiq istifadəçini çıxışa yönləndirir.
- **id-ləri cihaz yaradır (UUID v4).** Server onları olduğu kimi saxlamalıdır — bu internetsiz yazmağa imkan verir.
- Yazılar **idempotentdir**: eyni sorğu təkrar gələ bilər (offline növbə). `PUT /records/*` = upsert (id üzrə).
- Xəta: `{ "message": "..." }`. `4xx` — qalıcı (tətbiq əməliyyatı atır və istifadəçiyə göstərir);
  `5xx`, `408`, `429` və şəbəkə xətası — müvəqqəti (növbədə qalır, sonra təkrarlanır).
- Hər istifadəçi öz fermasının məlumatını görür; ferma yoxdursa server ilk sorğuda yaradır.

## Endpoint-lər

| Metod | Yol | Gövdə | Cavab |
|---|---|---|---|
| POST | `/auth/register` | `{ email, password }` | `{ token \| null, user: { id, email } }` — token `null` = e-poçt təsdiqi lazımdır |
| POST | `/auth/login` | `{ email, password }` | `{ token, user: { id, email } }` |
| POST | `/auth/logout` | — | `204` |
| GET | `/auth/mygov/start?redirect_to=` | — | myGov (OIDC) girişinə yönləndirir; sonda `302 → <redirect_to>#token=…&user_id=…&name=…` (xəta: `#error=…`). Supabase versiyası: `supabase/functions/mygov-auth` |
| GET | `/auth/mygov/status` | — | `{ configured: boolean }` — giriş ekranında myGov düyməsini aktiv etmək üçün |
| DELETE | `/auth/account` | — | `204` — hesabı və istifadəçinin yeganə sahibi olduğu fermanın bütün məlumatını (şəkillər daxil) silir. App Store tələbidir |
| GET | `/farm/data` | — | `FarmData` (bax aşağı) |
| PUT | `/farm/data` | `FarmData` | `204` — fermanın bütün məlumatını əvəz edir |
| PUT | `/farm` | `{ name, owner, region, ektisNo, voen }` | `204` |
| PUT | `/records/:table` | `Row[]` | `204` — upsert. `photo` sahəsi gəlməyibsə köhnə dəyər saxlanılır |
| POST | `/records/:table/delete` | `{ ids: string[] }` | `204`. `animals` silinəndə ona aid `treatments`, `weights`, `breedings` də silinir |
| POST | `/photos/:animalId` | `multipart/form-data`, sahə `file` (JPEG) | `{ ref }` — saxlanılan şəklin istinadı |
| GET | `/photos/url?ref=` | — | `{ url }` — göstərmək üçün (müddətli) URL |
| DELETE | `/photos?ref=` | — | `204` |
| GET | `/gov/status` | — | `{ agencies: { ektis: boolean, aqta: boolean }, mygovRequired: boolean }` — dövlət qurumlarına birbaşa göndəriş qoşulubmu |
| POST | `/gov/reports/:agency` | `suru-gov-report` v1 (bax [`GOV-REPORTS.md`](GOV-REPORTS.md)) | `{ status: 'sent'\|'accepted', reference }`. Xəta: `{ error: 'not_configured'\|'mygov_required'\|'forbidden'\|'rejected'\|'agency_unavailable', message? }` |

`:table` ∈ `animals`, `treatments`, `weights`, `breedings`, `tasks`, `meds`, `pregChecks`, `heats`, `movements`, `feeds`, `purchases`, `milkRecords`, `govReports`.

```ts
interface FarmData {
  farm: { name: string; owner: string; region: string; ektisNo: string; voen: string };
  animals:    { id; tag; name; species: 'inek'|'camis'|'qoyun'|'keci'; breed; sex: 'd'|'e'; dob: string|null;
                damTag; group; status: 'aktiv'|'satilib'|'olub'|'kesilib'; notes; photo: string|null; createdAt }[];
  treatments: { id; animalId; batchId: string|null; date; medicine; dose; reason; meatWd: number; milkWd: number }[];
  weights:    { id; animalId; date; kg: number }[];
  breedings:  { id; animalId; date; method: 'suni'|'tebii'; sire; expected; outcome }[];
  tasks:      { id; title; due: string|null; done: boolean }[];
  meds:       { id; name; qty: number; unit; minQty: number; expiry: string|null; meatWd: number; milkWd: number; notes }[];
  pregChecks: { id; animalId; breedingId: string|null; date; result: 'positive'|'negative'|'uncertain'; fetuses: number; method: 'scan'|'manual'; notes }[];
  heats:      { id; animalId; date; notes }[];
  movements:  { id; animalId; date; type: 'purchase'|'sale'|'move_out'|'slaughter'|'death'; counterparty; price: number; weight: number; notes }[];
  feeds:      { id; name; qty: number; unit; minQty: number; notes }[];
  purchases:  { id; kind: 'med'|'feed'; itemId: string|null; itemName; date; qty: number; unit; price: number; supplier; batch; expiry: string|null; notes }[];
  milkRecords:{ id; date; liters: number; fat: number; protein: number; scc: number; buyer; price: number; notes }[];
  govReports: { id; agency: 'ektis'|'aqta'; date; status: 'sent'|'accepted'|'rejected'; method: 'api'|'file'; reference; itemKeys: string[]; notes }[];
}
```

Verilənlər bazası sxemi, məhdudiyyətlər (məs. fermada bırka nömrəsi unikaldır) və icazə qaydaları üçün
istinad: `/supabase/migrations/20261123000000_suru_init.sql`.
