#!/usr/bin/env bash
# Vahid sayt: tanıtım səhifəsi (/) + idarəetmə paneli (/panel) + məxfilik siyasəti (/mexfilik.html)
# Nəticə: site-dist/ — istənilən statik hostinqə yüklənə bilər (Vercel konfiqurasiyası: vercel.json).
# Panelin Supabase ayarları mühit dəyişənlərindən və ya mobile/.env-dən götürülür.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/site-dist"

rm -rf "$OUT"
mkdir -p "$OUT"

echo "→ Tanıtım saytı"
cp -r "$ROOT/website/." "$OUT/"

echo "→ Məxfilik siyasəti"
node "$ROOT/scripts/privacy-page.mjs" "$ROOT/docs/mexfilik-siyaseti.md" "$OUT/mexfilik.html"

echo "→ İdarəetmə paneli (/panel)"
cd "$ROOT/mobile"
[ -d node_modules ] || npm ci
EXPO_WEB_BASE_URL=/panel CI=1 npx expo export --platform web --output-dir "$OUT/panel"

echo "✓ Hazırdır: $OUT"
