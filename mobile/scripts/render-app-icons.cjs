// Tətbiq ikonlarını (assets/*.png) loqodan yaradır: node scripts/render-app-icons.cjs assets/logo.svg assets
// Playwright (Chromium) tələb edir. Loqonun özü scripts/gen-icons.mjs ilə yaradılır.
const { chromium } = require('playwright');
const fs = require('fs');
const svg = fs.readFileSync(process.argv[2], 'utf8');
const out = process.argv[3];
// Inner artwork without rounded background (for Android foreground / monochrome)
const inner = svg.replace(/<rect width="512" height="512" rx="112" fill="#163f30"\/>/, '');
const mono = inner.replace(/fill="#[0-9a-fA-F]{6}"/g, 'fill="#fff"').replace(/stroke="#[0-9a-fA-F]{6}"/g, 'stroke="#fff"');
const full = svg.replace('rx="112"', 'rx="0"');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ deviceScaleFactor: 1 });
  const shot = async (name, size, body, bg = 'transparent') => {
    await p.setViewportSize({ width: size, height: size });
    await p.setContent(`<html><body style="margin:0;background:${bg}">${body}</body></html>`);
    await p.screenshot({ path: `${out}/${name}`, omitBackground: bg === 'transparent' });
  };
  const img = (s, scale = 1) => `<div style="width:100vw;height:100vh;display:flex;align-items:center;justify-content:center"><div style="width:${scale*100}vw;height:${scale*100}vh">${s.replace('<svg ', '<svg width="100%" height="100%" ')}</div></div>`;
  await shot('icon.png', 1024, img(full));
  await shot('android-icon-foreground.png', 1024, img(inner, 1.0));
  await shot('android-icon-monochrome.png', 1024, img(mono, 1.0));
  await shot('splash-icon.png', 1024, img(svg, 0.5));
  await shot('favicon.png', 48, img(svg));
  await b.close();
})();
