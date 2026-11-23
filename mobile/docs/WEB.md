# Veb versiya (kompüterdən idarə)

Mobil tətbiq ilə **eyni kod** vebdə də işləyir (React Native Web). Eyni hesabla daxil olan istifadəçi
telefonda və kompüterdə eyni fermanı görür — məlumat Supabase-də sinxronlaşır.

- Kompüter ekranında (≥ 900 px) menyu solda yan panel kimi, telefonda altda göstərilir.
- Bütün funksiyalar vebdə işləyir: heyvanlar, müalicə, dərman şkafı, tapşırıqlar, şəkil yükləmə,
  CSV/JSON ixrac (fayl kimi endirilir), ehtiyat nüsxənin bərpası, myGov ilə giriş.
- Tanıtım saytı (`/website`) ayrıdır; ondan veb tətbiqə link qoymaq olar (məs. `https://app.suru.az`).

## Lokal işə salmaq

```bash
cd mobile
npx expo start --web
```

## Yığmaq (statik fayllar)

```bash
npx expo export --platform web     # nəticə: mobile/dist/
```
`dist/` istənilən statik hostinqdə işləyir. Yeganə şərt: bütün naməlum yollar `index.html`-ə yönləndirilməlidir (SPA).

## Vercel-də yerləşdirmək (hazır konfiqurasiya: `vercel.json`)

1. Vercel-də yeni layihə → GitHub reposunu seçin → **Root Directory: `mobile`**.
2. Environment Variables:
   - `EXPO_PUBLIC_BACKEND=supabase`
   - `EXPO_PUBLIC_SUPABASE_URL=https://rutlmhwzintycizfpgyv.supabase.co`
   - `EXPO_PUBLIC_SUPABASE_KEY=sb_publishable_…` (`.env.example`-dəki dəyər)
   - `EXPO_PUBLIC_MYGOV_ENABLED=false` (myGov aktivləşəndə `true`)
3. Deploy. Öz domeniniz üçün: Settings → Domains → `app.suru.az`.
4. myGov üçün veb ünvanını Edge Function-un `MYGOV_ALLOWED_REDIRECTS` siyahısına əlavə edin.

Netlify, Cloudflare Pages və ya öz serveriniz (nginx) də olar — build əmri və `dist` qovluğu eynidir;
nginx üçün: `try_files $uri /index.html;`.
