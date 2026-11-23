// İkon generatoru: tətbiq (src/ui/iconPaths.ts) və sayt (website/icons.svg) üçün eyni ikonlar.
// Mənbə: Material Design Icons (@mdi/js, Apache 2.0) + Sürü üçün çəkilmiş keçi və camış (eyni üslubda).
// Yeni ikon əlavə etmək: aşağıdakı MDI siyahısına adı yazın və `node scripts/gen-icons.mjs` işə salın.
import * as mdi from '@mdi/js';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const MDI = {
  home: 'mdiHomeVariantOutline',
  plus: 'mdiPlus',
  tasks: 'mdiClipboardCheckOutline',
  settings: 'mdiCogOutline',
  pill: 'mdiPill',
  'pill-multiple': 'mdiPillMultiple',
  needle: 'mdiNeedle',
  weight: 'mdiWeightKilogram',
  dna: 'mdiDna',
  'baby-bottle': 'mdiBabyBottleOutline',
  'calendar-clock': 'mdiCalendarClock',
  calendar: 'mdiCalendarBlankOutline',
  'medical-bag': 'mdiMedicalBag',
  camera: 'mdiCameraOutline',
  image: 'mdiImageOutline',
  search: 'mdiMagnify',
  'chevron-right': 'mdiChevronRight',
  'arrow-left': 'mdiArrowLeft',
  close: 'mdiClose',
  check: 'mdiCheck',
  'check-circle': 'mdiCheckCircleOutline',
  alert: 'mdiAlertCircleOutline',
  'file-excel': 'mdiFileExcelOutline',
  'clipboard-text': 'mdiClipboardTextOutline',
  download: 'mdiDownloadOutline',
  upload: 'mdiUploadOutline',
  flask: 'mdiFlaskOutline',
  trash: 'mdiTrashCanOutline',
  logout: 'mdiLogout',
  'account-remove': 'mdiAccountRemoveOutline',
  sync: 'mdiSync',
  'cloud-check': 'mdiCloudCheckOutline',
  'cloud-off': 'mdiCloudOffOutline',
  'id-card': 'mdiCardAccountDetailsOutline',
  pencil: 'mdiPencilOutline',
  scan: 'mdiMagnifyScan',
  heat: 'mdiFire',
  'cart-in': 'mdiCartArrowDown',
  'cart-out': 'mdiCashMultiple',
  truck: 'mdiTruckOutline',
  knife: 'mdiKnife',
  cross: 'mdiCrossOutline',
  'scale-group': 'mdiScaleBalance',
  'swap': 'mdiSwapHorizontal',
  sun: 'mdiWeatherSunny',
  moon: 'mdiWeatherNight',
  'theme-auto': 'mdiThemeLightDark',
  // sayt
  menu: 'mdiMenu',
  notebook: 'mdiNotebookOutline',
  'trending-down': 'mdiTrendingDown',
  tag: 'mdiTagOutline',
  chart: 'mdiChartBar',
  laptop: 'mdiLaptop',
  cellphone: 'mdiCellphone',
  'shield-lock': 'mdiShieldLockOutline',
  farmer: 'mdiAccountCowboyHatOutline',
  vet: 'mdiStethoscope',
  handshake: 'mdiHandshakeOutline',
  'wifi-off': 'mdiWifiOff',
};

// --- Sürü üçün çəkilmiş heyvan ikonları (24×24, MDI üslubunda) ---
const circle = (cx, cy, r, cw) => {
  const f = cw ? 1 : 0;
  return `M${cx},${cy - r}A${r},${r} 0 0,${f} ${cx + (cw ? r : -r)},${cy}A${r},${r} 0 0,${f} ${cx},${cy + r}A${r},${r} 0 0,${f} ${cx + (cw ? -r : r)},${cy}A${r},${r} 0 0,${f} ${cx},${cy - r}Z`;
};
const buffalo = mdi.mdiCow
  .replace('C6.79,7.05 7,4 10,3L9.91,3.14V3.14C9.63,3.58 8.91,4.97 9.67,6.47', 'C5.6,7.1 2.6,6.4 1.2,3.2C3.4,4.9 7,4.6 9.67,6.47')
  .replace('C15.09,4.97 14.37,3.58 14.09,3.14L14,3C17,4 17.21,7.05 16.61,8.15', 'C17,4.6 20.6,4.9 22.8,3.2C21.4,6.4 18.4,7.1 16.61,8.15')
  .replace('M14.09,3.14V3.14Z', '');
if (buffalo === mdi.mdiCow) throw new Error('mdiCow path dəyişib — camış ikonunu yeniləyin');
const goat = [
  'M7.6,8.2C7.6,6.2 9.6,5.2 12,5.2C14.4,5.2 16.4,6.2 16.4,8.2C16.4,11.5 15.4,14.8 14.6,17.2C14.1,18.8 13.2,19.6 12,19.6C10.8,19.6 9.9,18.8 9.4,17.2C8.6,14.8 7.6,11.5 7.6,8.2Z',
  'M12,6.9C10.4,6.9 9.3,7.4 9.3,8.4C9.3,10.4 9.7,12.4 10.2,13.9C10.8,14.5 13.2,14.5 13.8,13.9C14.3,12.4 14.7,10.4 14.7,8.4C14.7,7.4 13.6,6.9 12,6.9Z',
  circle(10.8, 10.2, 0.85, true), circle(13.2, 10.2, 0.85, true),
  'M12,16.2A1.25,1 0 0,0 10.75,17.2A1.25,1 0 0,0 12,18.2A1.25,1 0 0,0 13.25,17.2A1.25,1 0 0,0 12,16.2Z',
  circle(11.5, 17.2, 0.3, true), circle(12.5, 17.2, 0.3, true),
  'M2.4,8.9C3.9,7.8 6.2,7.6 7.9,8.3L8,9.9C6.3,10.6 3.9,10.3 2.4,8.9Z',
  'M16.1,8.3C17.8,7.6 20.1,7.8 21.6,8.9C20.1,10.3 17.7,10.6 16,9.9Z',
  'M9.2,5.9C8.1,4.6 7.3,3 6.6,1.2C8.5,2.4 10.2,3.7 10.9,5.3Z',
  'M13.1,5.3C13.8,3.7 15.5,2.4 17.4,1.2C16.7,3 15.9,4.6 14.8,5.9Z',
  'M13,19.2C12.6,20.6 12.3,21.8 12,23C11.7,21.8 11.4,20.6 11,19.2Z',
].join('');

const icons = { cow: mdi.mdiCow, sheep: mdi.mdiSheep, goat, buffalo };
for (const [name, key] of Object.entries(MDI)) {
  if (!mdi[key]) throw new Error(`@mdi/js-də ${key} yoxdur`);
  icons[name] = mdi[key];
}

// 1) Tətbiq
const ts = `// AVTOMATİK YARADILIB — əl ilə dəyişməyin. Mənbə: scripts/gen-icons.mjs
// Material Design Icons (Apache 2.0, pictogrammers.com) + Sürü heyvan ikonları.
export const ICONS = {
${Object.entries(icons).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join('\n')}
} as const;

export type IconName = keyof typeof ICONS;
`;
writeFileSync(join(here, '../src/ui/iconPaths.ts'), ts);

// 2) Sayt — SVG sprite (<svg><use href="/icons.svg#pill"/></svg>)
const sprite = `<svg xmlns="http://www.w3.org/2000/svg">
<!-- AVTOMATİK YARADILIB: mobile/scripts/gen-icons.mjs. Material Design Icons (Apache 2.0) + Sürü heyvan ikonları -->
${Object.entries(icons).map(([k, v]) => `<symbol id="${k}" viewBox="0 0 24 24"><path fill="currentColor" d="${v}"/></symbol>`).join('\n')}
</svg>
`;
writeFileSync(join(here, '../../website/icons.svg'), sprite);

// 3) Loqo — yaşıl fonda ağ inək (sayt favicon-u və tətbiq ikonlarının mənbəyi)
const logo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#1f6f43"/>
  <g transform="translate(96 88) scale(13.33)"><path fill="#fff" d="${mdi.mdiCow}"/></g>
</svg>
`;
writeFileSync(join(here, '../../website/icon.svg'), logo);
writeFileSync(join(here, '../assets/logo.svg'), logo);

console.log(`${Object.keys(icons).length} ikon yazıldı`);
