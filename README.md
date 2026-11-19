# Sürü — Azərbaycan fermerləri üçün ferma idarəetmə platforması

Herdwatch (İrlandiya) modelindən ilhamlanan, Azərbaycan bazarı üçün yerli heyvandarlıq uçotu məhsulu.

## Struktur

| Qovluq | Nədir |
|---|---|
| `docs/biznes-plan.md` | Herdwatch araşdırması (yalnız ictimai mənbələr), Sürü üçün nəticələr, Azərbaycan bazarı, gəlir modeli, şirkətin qurulması, yol xəritəsi |
| `docs/mexfilik-siyaseti.md` | Sürü-nün məxfilik siyasəti və data prinsipləri (qaralama) |
| `app/` | **Sürü tətbiqi** — telefona quraşdırıla bilən, internetsiz işləyən veb-tətbiq (PWA) |
| `website/` | Tanıtım saytı — imkanlar, qiymətlər (AZN), suallar, əlaqə forması |

## Tətbiqin imkanları (MVP)
- Heyvan reyestri: inək, camış, qoyun, keçi (bırka, cins, doğum tarixi, ana, qrup, status)
- Müalicə jurnalı və **dərman qalığı** (ət/süd) son tarixinin avtomatik hesablanması
- **Qrup müalicəsi** — bütün sürü, növ və ya qrup üzrə bir dəfəyə
- Mayalanma → **gözlənilən doğum tarixi**; "Doğdu" nəticəsindən balanın avtomatik əlavəsi
- Çəki qeydləri və orta gündəlik artım (q/gün)
- Tapşırıqlar, panelde xatırlatmalar
- CSV (Excel) ixrac: heyvan siyahısı, dərman jurnalı; JSON ehtiyat nüsxə və bərpa
- İnternetsiz iş (service worker), məlumat cihazda saxlanılır

## Lokal işə salmaq

```bash
python3 -m http.server 8000
```

Sonra brauzerdə: `http://localhost:8000/website/` (sayt) və `http://localhost:8000/app/` (tətbiq).
Telefonda tətbiqi açıb "Ana ekrana əlavə et" seçin.

## Növbəti addımlar
1. Backend + istifadəçi hesabları + bulud sinxronizasiyası (çox cihaz, çox istifadəçi)
2. Android/iOS mağaza versiyası — eyni kod Capacitor ilə
3. Rus dili
4. Əlaqə formasını CRM/serverə qoşmaq (`website/script.js` — TODO)
5. Elektron bırka oxuyucu, tərəzi, dövlət sistemləri ilə inteqrasiya
