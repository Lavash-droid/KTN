# Sürü — Məxfilik siyasəti və data prinsipləri (qaralama)

> Hüquqşünas tərəfindən yoxlanılmalıdır. "Fərdi məlumatlar haqqında" Azərbaycan Respublikasının
> Qanununa və (Aİ istifadəçiləri olarsa) GDPR-a uyğunlaşdırılmalıdır. `[...]` — şirkət qeydiyyatından
> sonra doldurulacaq yerlər.

## Data prinsiplərimiz (qısa)
1. **Ferma datası fermerə məxsusdur.** Sürü bu data üzərində sahiblik iddia etmir; yalnız xidməti göstərmək üçün lazım olan məhdud istifadə hüququ alır.
2. **Razılıq olmadan paylaşım yoxdur.** Baytar, kooperativ, bank, sığorta və ya dövlət sistemi ilə hər paylaşım fermerin ayrıca, geri götürülə bilən razılığı ilə olur.
3. **Satmırıq.** Fərdi və ferma datası satılmır, reklam şirkətlərinə ötürülmür.
4. **İstənilən vaxt ixrac və silmə.** Fermer bütün datasını Excel/JSON kimi yükləyə və hesabını silə bilər.
5. **Minimal data.** Yalnız xidmət üçün lazım olanı toplayırıq.

## 1. Məlumat nəzarətçisi
"Sürü" MMC, VÖEN: `[...]`, ünvan: `[...]`. Data məsələləri üzrə əlaqə: `[məxfilik@...]`.

## 2. Hansı məlumatları toplayırıq
| Kateqoriya | Nümunə | Məqsəd |
|---|---|---|
| Hesab məlumatı | Ad, telefon, e-poçt (istəyə görə) | Giriş, dəstək, abunə |
| Ferma məlumatı | Ferma adı, rayon/kənd, heyvan sayı | Xidmət, paket qiyməti |
| Heyvan qeydləri | Bırka, cins, doğum, müalicə, çəki, mayalanma, şəkil | Fermerin öz uçotu |
| Texniki məlumat | Cihaz növü, tətbiq versiyası, xəta hesabatları | Xətaların aradan qaldırılması |
| Lokasiya | Yalnız fermer icazə verdikdə | Yaxın baytar/xidmət tapmaq |
| Ödəniş | Ödəniş provayderi vasitəsilə; kart məlumatını saxlamırıq | Abunə |

**Toplamırıq:** dövlət portallarının (məs. EKTİS) şifrələrini. İnteqrasiya yalnız rəsmi API/token ilə və fermerin icazəsi ilə qurulacaq.

## 3. Hüquqi əsaslar
Müqavilənin icrası (xidmətin göstərilməsi), subyektin razılığı (paylaşım, marketinq, lokasiya), qanuni öhdəlik (vergi, mühasibat).

## 4. Kimlərlə paylaşırıq
- **Fermerin seçdiyi tərəflər** (baytar, işçi, kooperativ) — yalnız fermerin dəvəti/razılığı ilə, rol əsaslı giriş.
- **Xidmət təminatçıları** (hostinq, SMS, ödəniş) — müqavilə əsasında, yalnız xidmət üçün.
- **Dövlət orqanları** — yalnız qanunla tələb olunduqda.
- Analitika üçün yalnız **anonimləşdirilmiş və toplu** statistika (məs. "rayon üzrə orta buzovlama intervalı") istifadə oluna bilər; bundan da imtina etmək mümkündür.

### Məlumatın harada saxlanıldığı
Tətbiqin məlumatı (hesab, ferma qeydləri, heyvan şəkilləri) xidmət təminatçısı **Supabase**-in Avropa İttifaqındakı
(Frankfurt, Almaniya) serverlərində saxlanılır. Ötürmə HTTPS ilə şifrələnir; hər istifadəçi yalnız üzv olduğu fermanın
məlumatına çıxış əldə edir. İnternet olmayanda daxil edilən qeydlər bağlantı bərpa olunanadək telefonda saxlanılır.
Gələcəkdə məlumat Sürü-nün öz serverlərinə köçürülə bilər — bu barədə əvvəlcədən xəbər veriləcək.

## 5. Saxlama müddətləri
| Data | Müddət |
|---|---|
| Hesab və ferma datası | Hesab aktiv olduğu müddətdə; silinmə tələbindən sonra 30 gün ərzində silinir |
| Ehtiyat nüsxələr | Ən çoxu 90 gün |
| Texniki loglar | 90 gün |
| Ödəniş və hesab-faktura sənədləri | Vergi qanunvericiliyinin tələb etdiyi müddət `[...]` |

## 6. Hüquqlarınız
**Hesabı silmək:** tətbiqdə *Digər → Hesab və sinxronizasiya → Hesabı sil*. Hesab, yeganə sahibi olduğunuz fermanın
bütün qeydləri və şəkilləri serverdən dərhal silinir. Silməzdən əvvəl *Ehtiyat nüsxə (JSON)* və CSV ilə məlumatı yükləyə bilərsiniz.

Məlumatlarınızla tanış olmaq, düzəltmək, silmək, ixrac etmək, emalı məhdudlaşdırmaq, razılığı istənilən vaxt geri götürmək. Müraciət: `[məxfilik@...]`, cavab müddəti — 30 gün. Şikayət üçün səlahiyyətli dövlət orqanına müraciət hüququnuz var.

## 7. Cookie və analitika (sayt)
Zəruri cookie-lər avtomatik; analitika və reklam cookie-ləri **yalnız razılıqla** (cookie banneri).

## 8. Təhlükəsizlik
Ötürmədə şifrələmə (HTTPS), serverdə şifrələnmiş saxlama, rol əsaslı giriş, giriş jurnalları. Offline rejimdə data fermerin cihazında saxlanılır — cihazın kilidlənməsi tövsiyə olunur.

## 9. Uşaqlar
Hesab sahibi 18 yaşdan yuxarı olmalıdır.

## 10. Dəyişikliklər
Siyasət dəyişdikdə tətbiqdə və SMS ilə xəbər veririk. Son yenilənmə: `[tarix]`.
