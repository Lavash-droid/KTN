# Dövlət hesabatları — EKTİS və AQTA

Fermer tətbiqdən (Digər → **Dövlət hesabatları**) qurumlara bildirilməli qeydləri görür və hesabatı ya
**birbaşa göndərir**, ya da **fayl kimi ixrac edib** qurumun portalına yükləyir. Göndərilmiş qeydlər yadda
saxlanılır və növbəti hesabata təkrar düşmür.

| Qurum | Nə bildirilir |
|---|---|
| **EKTİS** — Elektron Kənd Təsərrüfatı İnformasiya Sistemi (Kənd Təsərrüfatı Nazirliyi) | Heyvanların qeydiyyatı (doğum / ilkin qeydiyyat), alış, satış, köçürmə, kəsim, ölüm; sürünün növ və cins üzrə tərkibi |
| **AQTA** — Azərbaycan Qida Təhlükəsizliyi Agentliyi | Baytarlıq dərmanlarının istifadəsi (dərman, doza, səbəb, ət/süd qalığının son tarixi); satış, kəsim, ölüm halları |

## Vəziyyət

| Hissə | Vəziyyət |
|---|---|
| Tətbiq: ekran, bildirilməmiş qeydlər, yoxlamalar, CSV ixracı, göndəriş tarixçəsi | ✅ hazırdır |
| Verilənlər bazası (`gov_reports`, `farms.ektis_no`, `farms.voen`) | ✅ miqrasiya yazılıb — `20261124000000_gov_reports.sql` **tətbiq olunmalıdır** |
| Server (Edge Function `gov-report`) | ✅ yazılıb və test olunub — **yerləşdirilməlidir**; açarlar olmadan `not_configured` qaytarır |
| **Qurumların API ünvanı, açarı və texniki sənədi** | ⏳ Kənd Təsərrüfatı Nazirliyi (EKTİS) və AQTA ilə razılaşmadan sonra |

İnteqrasiya qoşulanadək tətbiq hesabatı **CSV (Excel)** faylı kimi ixrac edir; fermer faylı portala yükləyib
"Bildirilib kimi qeyd et" ilə təsdiqləyir (portalın verdiyi nömrə yazıla bilər).

## Yoxlamalar (göndərməzdən əvvəl göstərilir)
- **Qalıq müddəti bitməmiş kəsim** — kəsim tarixində heyvanın ət qalığı müddəti davam edirdisə, qırmızı xəbərdarlıq.
  Satışda da eyni yoxlama aparılır (sarı).
- Bırka nömrəsi olmayan heyvan, doğum tarixi yazılmayan qeydiyyat, alıcısı / köçürüldüyü yeri göstərilməyən hərəkət,
  səbəbi yazılmayan ölüm (AQTA).
- Hesabat səviyyəsində: EKTİS qeydiyyat nömrəsi, sahibin adı, VÖEN formatı (10 rəqəm).

Qeydlər xəbərdarlıqla birlikdə olduğu kimi göndərilir — tətbiq faktları gizlətmir.

## Birbaşa göndəriş: necə işləyir

```
Tətbiq ──► POST /functions/v1/gov-report/submit   { agency, farmId, payload: suru-gov-report v1 }
             │  JWT yoxlanılır → istifadəçi fermaya yaza bilirmi (viewer yox)
             │  myGov ilə təsdiqlənmiş hesabdır? (GOV_REQUIRE_MYGOV, standart: bəli)
             │  qurumun açarı təyin olunub? (yoxdursa 503 not_configured)
             ▼
        EKTİS / AQTA API  (açar yalnız serverdə; Idempotency-Key — təkrar göndərişdə dublikat olmur)
             │
Tətbiq ◄── { status: 'accepted' | 'sent', reference }  →  gov_reports cədvəlinə yazılır
```

Qurum hesabatı rədd edərsə (4xx), mesajı istifadəçiyə göstərilir və qeydlər "bildirilməmiş" siyahısında qalır.

**Niyə myGov?** Dövlət qurumu hesabatı kimin göndərdiyini bilməlidir. myGov (SİMA / ASAN İmza) ilə daxil olan
istifadəçinin şəxsiyyəti dövlət tərəfindən təsdiqlənib; e-poçt hesabı isə təsdiqlənməyib. Qurum tələb etməzsə,
`GOV_REQUIRE_MYGOV=false` ilə söndürülə bilər. Bax: [`MYGOV.md`](MYGOV.md).

## Açarları təyin etmək

Supabase → Edge Functions → Secrets (və ya `supabase secrets set ...`):

| Açar | Təsvir |
|---|---|
| `EKTIS_API_URL`, `EKTIS_API_KEY` | EKTİS hesabat endpoint-i (yalnız `https://`) və açarı |
| `AQTA_API_URL`, `AQTA_API_KEY` | AQTA hesabat endpoint-i və açarı |
| `EKTIS_AUTH_HEADER`, `AQTA_AUTH_HEADER` | Açarın başlığı — standart `Authorization` (məs. `X-Api-Key`) |
| `EKTIS_AUTH_SCHEME`, `AQTA_AUTH_SCHEME` | Açarın önündəki söz — standart `Bearer`; boş = yalnız açar |
| `GOV_REQUIRE_MYGOV` | `false` — e-poçt hesablarından da birbaşa göndərişə icazə |
| `GOV_TIMEOUT_MS` | Qurumun cavab gözləmə müddəti (standart 20000) |

Yerləşdirmə:
```bash
supabase db push                       # və ya miqrasiyanı SQL Editor-da işə salın
supabase functions deploy gov-report
supabase functions deploy mygov-auth   # /status endpoint-i üçün
```

Qurumun API sxemi neytral formatdan fərqlənərsə, yalnız `supabase/functions/gov-report/handler.ts`-dəki
`toAgencyBody` (göndərilən gövdə) və `parseAgencyResponse` (cavabdan nömrə və status) dəyişdirilir —
tətbiq və verilənlər bazası toxunulmaz qalır.

## Hesabat formatı (`suru-gov-report` v1)

```jsonc
{
  "format": "suru-gov-report", "version": 1, "agency": "ektis", "generatedAt": "2026-11-24T10:00:00Z",
  "farm": { "name": "…", "owner": "…", "region": "…", "ektisNo": "…", "voen": null },
  "herd": [{ "species": "inek", "female": 12, "male": 3 }],
  "items": [
    { "key": "reg:<id>", "type": "reg", "date": "2026-11-19",
      "animal": { "tag": "AZ002", "species": "inek", "breed": "Holşteyn", "sex": "male", "dob": "2026-11-19", "damTag": "AZ001" } },
    { "key": "mv:<id>", "type": "slaughter", "date": "2026-11-21", "animal": { … },
      "counterparty": "Kəsimxana", "weightKg": 45, "meatWithdrawalUntil": "2026-12-16", "warning": "Ət qalığı müddəti …" },
    { "key": "tr:<id>", "type": "treatment", "date": "2026-11-18", "animal": { … }, "medicine": "Oksitetrasiklin",
      "dose": "5 ml", "reason": "Pnevmoniya", "meatWithdrawalDays": 28, "meatWithdrawalUntil": "2026-12-16",
      "milkWithdrawalDays": 7, "milkWithdrawalUntil": "2026-11-25" }
  ]
}
```

Server göndərərkən `submitter: { name, verifiedBy: "mygov" }` və `source: "suru"` əlavə edir.
`key` sabitdir — qurum onu dublikatların qarşısını almaq üçün istifadə edə bilər.

## Testlər

`handler.ts` saxta qurum serveri ilə yoxlanılıb: icazəsiz / etibarsız token, viewer rolu, myGov tələbi,
qoşulmamış qurum, format və qurum uyğunsuzluğu, uğurlu göndəriş (başlıqlar, açar, Idempotency-Key sabitliyi),
qurumun rəddi (mesaj ötürülür), 5xx və şəbəkə xətası, xüsusi açar başlığı. Domen məntiqi (`src/domain/gov.ts`):
qeydlərin seçilməsi, dövr filtri, göndərilmiş / rədd edilmiş hesabatlar, qalıq müddəti yoxlaması, JSON və CSV.
