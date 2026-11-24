// docs/mexfilik-siyaseti.md → site-dist/mexfilik.html (App Store və Google Play məxfilik siyasəti ünvanı tələb edir).
import { readFileSync, writeFileSync } from 'node:fs';
import { marked } from 'marked';

const [, , src, dest] = process.argv;
const body = marked.parse(readFileSync(src, 'utf8'));
writeFileSync(dest, `<!doctype html>
<html lang="az">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Məxfilik siyasəti — Sürü</title>
  <meta name="theme-color" content="#f2f3f7">
  <link rel="icon" href="/icon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <header class="nav">
    <div class="wrap nav-in">
      <a class="logo" href="/"><img src="/icon.svg" alt="" width="32" height="32">Sürü</a>
      <nav id="menu" class="open-static"><a class="btn sm" href="/panel/">Daxil ol</a></nav>
    </div>
  </header>
  <main class="doc">
${body}
  </main>
</body>
</html>
`);
console.log('məxfilik səhifəsi:', dest);
