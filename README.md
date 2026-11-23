# Sürü — Azərbaycan fermerləri üçün ferma idarəetmə platforması

Herdwatch (İrlandiya) modelindən ilhamlanan, Azərbaycan bazarı üçün yerli heyvandarlıq uçotu məhsulu.

## Struktur

| Qovluq | Nədir |
|---|---|
| `docs/biznes-plan.md` | Herdwatch araşdırması (yalnız ictimai mənbələr), Sürü üçün nəticələr, Azərbaycan bazarı, gəlir modeli, şirkətin qurulması, yol xəritəsi |
| `docs/mexfilik-siyaseti.md` | Sürü-nün məxfilik siyasəti və data prinsipləri (qaralama) |
| `mobile/` | **Sürü tətbiqi** (Expo / React Native) — iOS, Android və veb (kompüterdən idarə); məlumat Supabase-də, offline iş, myGov ilə giriş, daxili serverə keçid üçün ayrıca backend qatı. Bax: [`mobile/README.md`](mobile/README.md) |
| `supabase/` | Verilənlər bazası sxemi (cədvəllər, Row Level Security, şəkil bucket-i) və `mygov-auth` Edge Function |
| `server/` | **Daxili (fiziki) server** — Supabase-in əvəzi: PostgreSQL + REST API + şəkillər + HTTPS + ehtiyat nüsxə (Docker). Supabase-dən köçürmə və itkisiz keçid planı. Bax: [`server/README.md`](server/README.md) |
| `app/` | İlkin veb-tətbiq (PWA) — mobil tətbiqə köçürülüb; köhnə ehtiyat faylları mobil tətbiqə idxal oluna bilər |
| `website/` | Tanıtım saytı — imkanlar, qiymətlər (AZN), suallar, əlaqə forması (müraciətlər Supabase-ə yazılır) |
| `scripts/`, `vercel.json` | **Vahid sayt**: `suru.az/` tanıtım + `suru.az/panel` idarəetmə paneli + məxfilik səhifəsi — bir əmrlə yığılır. Bax: [`mobile/docs/WEB.md`](mobile/docs/WEB.md) |

## Tətbiqin imkanları (MVP)
- Heyvan reyestri: inək, camış, qoyun, keçi (bırka, cins, doğum tarixi, ana, qrup, status)
- Müalicə jurnalı və **dərman qalığı** (ət/süd) son tarixinin avtomatik hesablanması
- **Qrup müalicəsi** — bütün sürü, növ və ya qrup üzrə bir dəfəyə
- **Dərman şkafı** — ehtiyat, son istifadə tarixi, az qalma xəbərdarlığı; müalicə yazanda qalıq müddətləri avtomatik dolur və ehtiyatdan çıxılır
- **Heyvan şəkli** — kamera ilə; şəkillər IndexedDB-də saxlanılır və ehtiyat nüsxəyə daxildir
- Mayalanma → **gözlənilən doğum tarixi**; "Doğdu" nəticəsindən balanın avtomatik əlavəsi
- Çəki qeydləri və orta gündəlik artım (q/gün)
- Tapşırıqlar, panelde xatırlatmalar
- CSV (Excel) ixrac: heyvan siyahısı, dərman jurnalı; JSON ehtiyat nüsxə və bərpa
- İnternetsiz iş (service worker), məlumat cihazda saxlanılır

## Lokal işə salmaq

**Telefon tətbiqi** (Expo Go ilə):
```bash
cd mobile && npm install && cp .env.example .env && npx expo start
```

**Vahid sayt** (tanıtım + `/panel` idarəetmə paneli):
```bash
npm install && npm install --prefix mobile
npm run build
npx serve site-dist -s
```

İlkin PWA (`app/`) arxiv kimi saxlanılıb: `python3 -m http.server 8000` → `http://localhost:8000/app/`.

## Növbəti addımlar
1. ~~Backend + istifadəçi hesabları + bulud sinxronizasiyası~~ — `mobile/` (Supabase). Növbəti: fermaya işçi/baytar dəvəti (rollar sxemdə hazırdır)
2. Android/iOS mağaza versiyası — `mobile/` EAS build ilə
3. ~~Daxili serverə keçid~~ — `server/` hazırdır; keçid addımları: [`server/README.md`](server/README.md) → bölmə 4
4. Rus dili
5. Əlaqə formasını CRM/serverə qoşmaq (`website/script.js` — TODO)
6. Elektron bırka oxuyucu, tərəzi, dövlət sistemləri ilə inteqrasiya
