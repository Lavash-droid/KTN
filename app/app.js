/* Sürü — ferma idarəetmə tətbiqi (offline PWA). Məlumatlar cihazda saxlanılır. */
'use strict';

const STORAGE_KEY = 'suru-data-v1';

const SPECIES = {
  inek:  { label: 'İnək', plural: 'inəklər',  icon: '🐄', gest: 283, breeds: ['Qafqaz qonuru', 'Holşteyn', 'Simmental', 'Şvis', 'Yerli', 'Digər'] },
  camis: { label: 'Camış', plural: 'camışlar', icon: '🐃', gest: 310, breeds: ['Azərbaycan camışı', 'Digər'] },
  qoyun: { label: 'Qoyun', plural: 'qoyunlar', icon: '🐑', gest: 147, breeds: ['Qarabağ', 'Balbas', 'Bozah', 'Qala', 'Merinos', 'Digər'] },
  keci:  { label: 'Keçi', plural: 'keçilər',  icon: '🐐', gest: 150, breeds: ['Yerli', 'Zaanen', 'Alp', 'Digər'] },
};
const STATUS = { aktiv: 'Aktiv', satilib: 'Satılıb', olub: 'Ölüb', kesilib: 'Kəsilib' };

/* ---------- Məlumat qatı ---------- */
const emptyState = () => ({
  farm: { name: 'Mənim fermam', owner: '', region: '' },
  animals: [], treatments: [], weights: [], breedings: [], tasks: [], meds: [],
});

const MED_UNITS = ['ml', 'doza', 'ədəd', 'tablet', 'q', 'şüşə'];

/** Heyvan şəkilləri localStorage-ı doldurmasın deyə IndexedDB-də saxlanılır (açar = heyvanın id-si). */
const photoDB = (() => {
  let dbp;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open('suru-photos', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('p');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
  const tx = async (mode, fn) => {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction('p', mode);
      const req = fn(t.objectStore('p'));
      t.oncomplete = () => res(req && req.result);
      t.onerror = () => rej(t.error);
    });
  };
  return {
    get: (k) => tx('readonly', (s) => s.get(k)).catch(() => null),
    put: (k, v) => tx('readwrite', (s) => s.put(v, k)),
    del: (k) => tx('readwrite', (s) => s.delete(k)).catch(() => {}),
    clear: () => tx('readwrite', (s) => s.clear()).catch(() => {}),
    all: async () => {
      const out = {};
      try {
        const db = await open();
        await new Promise((res) => {
          const c = db.transaction('p').objectStore('p').openCursor();
          c.onsuccess = () => { const cur = c.result; if (cur) { out[cur.key] = cur.value; cur.continue(); } else res(); };
          c.onerror = () => res();
        });
      } catch (e) { /* IndexedDB əlçatan deyil */ }
      return out;
    },
  };
})();

/** Şəkli kiçildib JPEG data URL-ə çevirir (yaddaşa qənaət üçün). */
function resizeImage(file, max = 640) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      res(c.toDataURL('image/jpeg', 0.75));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('image')); };
    img.src = url;
  });
}

/** Səhifədəki img[data-photo] elementlərinə şəkilləri yükləyir. */
function loadPhotos(root = document) {
  root.querySelectorAll('img[data-photo]').forEach(async (img) => {
    const src = await photoDB.get(img.dataset.photo);
    if (src) img.src = src; else img.replaceWith(document.createTextNode('📷'));
  });
}

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    return Object.assign(emptyState(), JSON.parse(raw));
  } catch (e) {
    return emptyState();
  }
}
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (e) { toast('Yadda saxlamaq alınmadı: yaddaş dolu ola bilər'); }
}

/* ---------- Köməkçi funksiyalar ---------- */
const $ = (s, el = document) => el.querySelector(s);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function todayISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
function parseISO(iso) { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); }
function addDays(iso, n) { return new Date(parseISO(iso) + n * 86400000).toISOString().slice(0, 10); }
function daysBetween(a, b) { return Math.round((parseISO(b) - parseISO(a)) / 86400000); }
function fmt(iso) { if (!iso) return '—'; const [y, m, d] = iso.split('-'); return `${d}.${m}.${y}`; }
function age(dob) {
  if (!dob) return '';
  const days = daysBetween(dob, todayISO());
  if (days < 0) return '';
  if (days < 60) return `${days} gün`;
  const months = Math.floor(days / 30.44);
  if (months < 24) return `${months} ay`;
  const y = Math.floor(months / 12), m = months % 12;
  return m ? `${y} il ${m} ay` : `${y} il`;
}
function inDays(n) {
  if (n === 0) return 'bu gün';
  if (n === 1) return 'sabah';
  if (n > 0) return `${n} gün sonra`;
  if (n === -1) return 'dünən';
  return `${-n} gün əvvəl`;
}

const animalById = (id) => state.animals.find((a) => a.id === id);
const animalLabel = (a) => (a ? `${a.tag}${a.name ? ' · ' + a.name : ''}` : 'Silinmiş heyvan');
const sp = (a) => SPECIES[a.species] || SPECIES.inek;

/** Dərman qalığı: heyvanın aktiv ət/süd məhdudiyyəti varsa son tarixləri qaytarır. */
function withdrawal(animalId) {
  const t = todayISO();
  let meat = null, milk = null;
  for (const tr of state.treatments) {
    if (tr.animalId !== animalId) continue;
    const m = addDays(tr.date, Number(tr.meatWd) || 0);
    const k = addDays(tr.date, Number(tr.milkWd) || 0);
    if (Number(tr.meatWd) > 0 && m >= t && (!meat || m > meat)) meat = m;
    if (Number(tr.milkWd) > 0 && k >= t && (!milk || k > milk)) milk = k;
  }
  return meat || milk ? { meat, milk } : null;
}

/** Çəki statistikası: son çəki və orta gündəlik artım (q/gün). */
function weightStats(animalId) {
  const ws = state.weights.filter((w) => w.animalId === animalId).sort((a, b) => a.date.localeCompare(b.date));
  if (!ws.length) return null;
  const last = ws[ws.length - 1];
  let adg = null;
  if (ws.length > 1) {
    const d = daysBetween(ws[0].date, last.date);
    if (d > 0) adg = Math.round(((last.kg - ws[0].kg) / d) * 1000);
  }
  return { last, adg, count: ws.length };
}

/* ---------- Dərman şkafı ---------- */
const findMed = (name) => {
  const n = (name || '').trim().toLowerCase();
  return n ? state.meds.find((m) => m.name.trim().toLowerCase() === n) : null;
};
const round1 = (x) => Math.round(x * 10) / 10;

/** Dərmanın vəziyyəti: vaxtı keçib / yaxında bitir / az qalıb. */
function medStatus(m) {
  const t = todayISO();
  const s = { expired: false, soon: false, low: false };
  if (m.expiry) {
    if (m.expiry < t) s.expired = true;
    else if (m.expiry <= addDays(t, 30)) s.soon = true;
  }
  if (Number(m.minQty) > 0 && Number(m.qty) <= Number(m.minQty)) s.low = true;
  return s;
}
function medBadges(m) {
  const s = medStatus(m);
  return [
    s.expired ? '<span class="badge danger">Vaxtı keçib</span>' : '',
    s.soon ? '<span class="badge warn">Vaxtı bitir</span>' : '',
    s.low ? '<span class="badge warn">Az qalıb</span>' : '',
  ].join(' ');
}

/** Müalicə formalarında dərman sahəsi: şkafdan seçim, qalıq müddətlərinin avtomatik doldurulması, ehtiyatdan çıxma. */
function medFieldsHtml(perAnimal) {
  return `
    <label for="s-med">Dərman / peyvənd *</label>
    <input id="s-med" name="medicine" required list="medList" autocomplete="off" placeholder="Məs: İvermektin, Şap peyvəndi">
    <datalist id="medList">${state.meds.map((m) => `<option value="${esc(m.name)}">`).join('')}</datalist>
    <p class="small" id="medInfo" hidden></p>
    <div id="useWrap" hidden>
      <label for="s-used">Şkafdan çıxılsın${perAnimal ? ' (hər heyvana)' : ''}, <span id="s-used-unit"></span></label>
      <input id="s-used" type="number" min="0" step="0.1" name="used" value="0" inputmode="decimal">
    </div>`;
}
function wireMedField() {
  const inp = $('#s-med');
  inp.addEventListener('input', () => {
    const m = findMed(inp.value);
    const info = $('#medInfo');
    $('#useWrap').hidden = !m;
    if (!m) { info.hidden = true; return; }
    $('#s-meat').value = m.meatWd || 0;
    $('#s-milk').value = m.milkWd || 0;
    $('#s-used-unit').textContent = m.unit;
    const st = medStatus(m);
    info.hidden = false;
    info.style.color = st.expired ? 'var(--danger)' : 'var(--muted)';
    info.textContent = st.expired
      ? `⚠️ Bu dərmanın son istifadə tarixi keçib (${fmt(m.expiry)})! Ehtiyatda: ${m.qty} ${m.unit}.`
      : `Şkafda: ${m.qty} ${m.unit}${m.expiry ? ' · son istifadə: ' + fmt(m.expiry) : ''}. Qalıq müddətləri şkafdan götürüldü.`;
  });
}
/** Ehtiyatdan çıxır; xəbərdarlıq mətni qaytarır (yoxdursa boş). */
function takeFromStock(name, amount) {
  const m = findMed(name);
  if (!m || !(amount > 0)) return '';
  m.qty = Math.max(0, round1(Number(m.qty) - amount));
  if (m.qty === 0) return ` · ${m.name} şkafda bitdi`;
  if (medStatus(m).low) return ` · ${m.name} az qalıb (${m.qty} ${m.unit})`;
  return '';
}

function pendingBirths() {
  return state.breedings
    .filter((b) => !b.outcome)
    .map((b) => ({ ...b, animal: animalById(b.animalId) }))
    .filter((b) => b.animal && b.animal.status === 'aktiv')
    .sort((a, b) => a.expected.localeCompare(b.expected));
}

/* ---------- UI ---------- */
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2400);
}

function setTitle(text, back) {
  $('#title').textContent = text;
  $('#backBtn').hidden = !back;
  document.title = `${text} — Sürü`;
}

function setTab(name) {
  document.querySelectorAll('.tabbar a').forEach((a) => a.classList.toggle('active', a.dataset.tab === name));
}

/** Modal forma açır. fields: HTML; onSubmit(FormData) true qaytarsa bağlanır. */
function openSheet(title, fieldsHtml, onSubmit) {
  const dlg = $('#sheet');
  $('#sheetTitle').textContent = title;
  $('#sheetBody').innerHTML = fieldsHtml;
  const form = $('#sheetForm');
  form.onsubmit = (e) => {
    e.preventDefault();
    if (onSubmit(new FormData(form)) !== false) dlg.close();
  };
  $('#sheetCancel').onclick = () => dlg.close();
  dlg.showModal();
  const first = form.querySelector('input, select, textarea');
  if (first) first.focus();
}

function options(obj, selected) {
  return Object.entries(obj).map(([k, v]) => `<option value="${k}" ${k === selected ? 'selected' : ''}>${esc(typeof v === 'string' ? v : v.icon + ' ' + v.label)}</option>`).join('');
}

/* ---------- Səhifələr ---------- */
const view = () => $('#view');

function renderHome() {
  setTitle(state.farm.name || 'Sürü');
  setTab('home');
  const active = state.animals.filter((a) => a.status === 'aktiv');

  if (!state.animals.length) {
    view().innerHTML = `
      <div class="card welcome">
        <div class="big">🐄🐑</div>
        <h2>Sürüyə xoş gəlmisiniz!</h2>
        <p>Heyvanlarınızı, müalicələri, mayalanma və çəki qeydlərini bir yerdə aparın. İnternet olmadan da işləyir.</p>
        <a class="btn" href="#/new">＋ İlk heyvanı əlavə et</a>
        <button class="btn ghost" id="demoBtn">Nümunə məlumatla bax</button>
      </div>`;
    $('#demoBtn').onclick = loadDemo;
    return;
  }

  const counts = Object.keys(SPECIES).map((k) => ({ k, n: active.filter((a) => a.species === k).length })).filter((x) => x.n);
  const t = todayISO();

  const wd = active.map((a) => ({ a, w: withdrawal(a.id) })).filter((x) => x.w);
  const births = pendingBirths().filter((b) => daysBetween(t, b.expected) <= 30);
  const tasks = state.tasks.filter((x) => !x.done && x.due && x.due <= addDays(t, 7)).sort((a, b) => a.due.localeCompare(b.due));

  const alerts = [];
  for (const { a, w } of wd) {
    const parts = [];
    if (w.meat) parts.push(`ət: ${fmt(w.meat)}-dək`);
    if (w.milk) parts.push(`süd: ${fmt(w.milk)}-dək`);
    alerts.push(`<a class="alert danger" href="#/animal/${a.id}"><span>💊</span><div><b>${esc(animalLabel(a))}</b> — dərman qalığı<br><small>${parts.join(', ')}</small></div></a>`);
  }
  for (const b of births) {
    const n = daysBetween(t, b.expected);
    alerts.push(`<a class="alert ${n < 0 ? 'warn' : 'info'}" href="#/animal/${b.animal.id}"><span>🍼</span><div><b>${esc(animalLabel(b.animal))}</b> — gözlənilən doğum<br><small>${fmt(b.expected)} (${inDays(n)})</small></div></a>`);
  }
  for (const k of tasks) {
    const n = daysBetween(t, k.due);
    alerts.push(`<a class="alert ${n < 0 ? 'warn' : 'info'}" href="#/tasks"><span>📌</span><div><b>${esc(k.title)}</b><br><small>${fmt(k.due)} (${inDays(n)})</small></div></a>`);
  }
  for (const m of state.meds) {
    const s = medStatus(m);
    if (!s.expired && !s.soon && !s.low) continue;
    const parts = [];
    if (s.expired) parts.push(`son istifadə tarixi keçib (${fmt(m.expiry)})`);
    if (s.soon) parts.push(`son istifadə: ${fmt(m.expiry)} (${inDays(daysBetween(t, m.expiry))})`);
    if (s.low) parts.push(`az qalıb: ${m.qty} ${m.unit}`);
    alerts.push(`<a class="alert ${s.expired ? 'danger' : 'warn'}" href="#/meds"><span>🧴</span><div><b>${esc(m.name)}</b> — dərman şkafı<br><small>${parts.join(' · ')}</small></div></a>`);
  }

  const recent = [
    ...state.treatments.map((x) => ({ ...x, kind: 'tr' })),
    ...state.weights.map((x) => ({ ...x, kind: 'w' })),
    ...state.breedings.map((x) => ({ ...x, kind: 'b' })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  view().innerHTML = `
    <div class="stats">
      <div class="stat primary"><b>${active.length}</b><span>Aktiv heyvan</span></div>
      ${counts.map((c) => `<div class="stat"><b>${c.n}</b><span>${SPECIES[c.k].icon} ${SPECIES[c.k].label}</span></div>`).join('')}
    </div>

    <h2>Diqqət tələb edir</h2>
    ${alerts.length ? alerts.join('') : '<div class="card muted">Hər şey qaydasındadır 👍 Yaxın günlərdə xatırlatma yoxdur.</div>'}

    <h2>Son qeydlər</h2>
    <ul class="list">
      ${recent.length ? recent.map(eventRow).join('') : '<li class="empty">Hələ qeyd yoxdur</li>'}
    </ul>`;
}

function eventRow(e) {
  const a = animalById(e.animalId);
  let ico, text;
  if (e.kind === 'tr') { ico = '💊'; text = `${esc(e.medicine)}${e.dose ? ' · ' + esc(e.dose) : ''}`; }
  else if (e.kind === 'w') { ico = '⚖️'; text = `${e.kg} kq`; }
  else { ico = '🧬'; text = e.method === 'suni' ? 'Süni mayalanma' : 'Təbii cütləşmə'; }
  return `<li><a href="#/animal/${e.animalId}"><span class="ico">${ico}</span><div class="main"><b>${esc(animalLabel(a))}</b><small>${text} · ${fmt(e.date)}</small></div><span class="chev">›</span></a></li>`;
}

let listFilter = { q: '', species: 'all', status: 'aktiv' };

function renderAnimals() {
  setTitle('Heyvanlar');
  setTab('animals');
  const chip = (key, val, label) => `<button class="chip ${listFilter[key] === val ? 'on' : ''}" data-k="${key}" data-v="${val}">${label}</button>`;
  view().innerHTML = `
    <div class="toolbar"><input type="search" id="q" placeholder="Bırka, ad və ya cins ilə axtar…" value="${esc(listFilter.q)}" aria-label="Axtar"><button class="btn sm" id="groupTr" title="Bir neçə heyvanı birdən müalicə et">💊 Qrup</button></div>
    <div class="chips">
      ${chip('species', 'all', 'Hamısı')}
      ${Object.entries(SPECIES).map(([k, v]) => chip('species', k, v.icon + ' ' + v.label)).join('')}
    </div>
    <div class="chips">
      ${chip('status', 'aktiv', 'Aktiv')}
      ${chip('status', 'all', 'Bütün statuslar')}
    </div>
    <p class="muted small" id="count"></p>
    <ul class="list" id="animalList"></ul>`;
  $('#q').oninput = (e) => { listFilter.q = e.target.value; drawAnimalList(); };
  $('#groupTr').onclick = groupTreatmentSheet;
  view().querySelectorAll('.chip').forEach((b) => b.onclick = () => { listFilter[b.dataset.k] = b.dataset.v; renderAnimals(); });
  drawAnimalList();
}

function drawAnimalList() {
  const q = listFilter.q.trim().toLowerCase();
  const items = state.animals
    .filter((a) => listFilter.species === 'all' || a.species === listFilter.species)
    .filter((a) => listFilter.status === 'all' || a.status === listFilter.status)
    .filter((a) => !q || [a.tag, a.name, a.breed, a.group].some((v) => (v || '').toLowerCase().includes(q)))
    .sort((a, b) => a.tag.localeCompare(b.tag, 'az', { numeric: true }));
  $('#count').textContent = `${items.length} heyvan`;
  $('#animalList').innerHTML = items.length ? items.map((a) => {
    const w = withdrawal(a.id);
    const pregnant = state.breedings.some((b) => b.animalId === a.id && !b.outcome);
    const badges = [
      w ? '<span class="badge danger">Dərman qalığı</span>' : '',
      pregnant ? '<span class="badge info">Boğaz</span>' : '',
      a.status !== 'aktiv' ? `<span class="badge warn">${STATUS[a.status]}</span>` : '',
    ].join(' ');
    return `<li><a href="#/animal/${a.id}">
      <span class="ico">${a.hasPhoto ? `<img class="thumb" data-photo="${a.id}" alt="">` : sp(a).icon}</span>
      <div class="main"><b>${esc(animalLabel(a))}</b><small>${esc(a.breed || sp(a).label)} · ${a.sex === 'd' ? 'Dişi' : 'Erkək'}${a.dob ? ' · ' + age(a.dob) : ''}</small></div>
      ${badges}<span class="chev">›</span></a></li>`;
  }).join('') : `<li class="empty">Heyvan tapılmadı. <a href="#/new">Yenisini əlavə edin</a></li>`;
  loadPhotos($('#animalList'));
}

function renderAnimalForm(id) {
  const a = id ? animalById(id) : null;
  if (id && !a) return notFound();
  setTitle(a ? 'Heyvanı redaktə et' : 'Yeni heyvan', true);
  setTab(a ? 'animals' : 'new');
  const v = a || { species: 'inek', sex: 'd', status: 'aktiv' };
  const breedList = (s) => SPECIES[s].breeds.map((b) => `<option value="${esc(b)}">`).join('');
  view().innerHTML = `
    <form class="card" id="animalForm" autocomplete="off">
      <div class="photo-field">
        <div class="photo-box" id="f-photo-box">${a && a.hasPhoto ? `<img data-photo="${a.id}" alt="Heyvanın şəkli">` : '<span>📷</span>'}</div>
        <div>
          <label class="btn ghost sm" style="margin:0">Şəkil çək / seç<input type="file" id="f-photo" accept="image/*" hidden></label>
          <button type="button" class="btn ghost sm" id="f-photo-del" ${a && a.hasPhoto ? '' : 'hidden'}>Şəkli sil</button>
          <p class="muted small" style="margin:6px 0 0">Bırka itəndə heyvanı tanımağa kömək edir.</p>
        </div>
      </div>
      <label for="f-species">Növ</label>
      <select id="f-species" name="species">${options(SPECIES, v.species)}</select>
      <div class="grid2">
        <div><label for="f-tag">Bırka nömrəsi *</label><input id="f-tag" name="tag" required value="${esc(v.tag)}" placeholder="AZ 0001 2345"></div>
        <div><label for="f-name">Ad (istəyə görə)</label><input id="f-name" name="name" value="${esc(v.name)}" placeholder="Maral"></div>
      </div>
      <div class="grid2">
        <div><label for="f-breed">Cins</label><input id="f-breed" name="breed" list="breeds" value="${esc(v.breed)}"><datalist id="breeds">${breedList(v.species)}</datalist></div>
        <div><label for="f-sex">Cinsiyyət</label><select id="f-sex" name="sex"><option value="d" ${v.sex === 'd' ? 'selected' : ''}>Dişi</option><option value="e" ${v.sex === 'e' ? 'selected' : ''}>Erkək</option></select></div>
      </div>
      <div class="grid2">
        <div><label for="f-dob">Doğum tarixi</label><input id="f-dob" type="date" name="dob" max="${todayISO()}" value="${esc(v.dob)}"></div>
        <div><label for="f-dam">Ananın bırkası</label><input id="f-dam" name="damTag" value="${esc(v.damTag)}"></div>
      </div>
      <div class="grid2">
        <div><label for="f-group">Qrup / tövlə</label><input id="f-group" name="group" value="${esc(v.group)}" placeholder="Sağmal, Buzovlar…"></div>
        <div><label for="f-status">Status</label><select id="f-status" name="status">${options(STATUS, v.status)}</select></div>
      </div>
      <label for="f-notes">Qeyd</label>
      <textarea id="f-notes" name="notes" rows="2">${esc(v.notes)}</textarea>
      <div class="row-btns">
        ${a ? '<button type="button" class="btn danger" id="delBtn">Sil</button>' : ''}
        <button class="btn">Yadda saxla</button>
      </div>
    </form>`;
  loadPhotos(view());
  $('#f-species').onchange = (e) => { $('#breeds').innerHTML = breedList(e.target.value); };

  // undefined = dəyişməyib, string = yeni şəkil, null = silinəcək
  let photo;
  $('#f-photo').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      photo = await resizeImage(file);
      $('#f-photo-box').innerHTML = `<img src="${photo}" alt="Heyvanın şəkli">`;
      $('#f-photo-del').hidden = false;
    } catch (err) { toast('Şəkil oxunmadı'); }
  };
  $('#f-photo-del').onclick = () => {
    photo = null;
    $('#f-photo-box').innerHTML = '<span>📷</span>';
    $('#f-photo-del').hidden = true;
  };

  $('#animalForm').onsubmit = async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    d.tag = d.tag.trim();
    if (!d.tag) return toast('Bırka nömrəsi tələb olunur');
    const dup = state.animals.find((x) => x.tag.toLowerCase() === d.tag.toLowerCase() && x.id !== (a && a.id));
    if (dup) return toast('Bu bırka nömrəsi artıq mövcuddur');
    let target = a;
    if (a) Object.assign(a, d);
    else { target = { id: uid(), createdAt: todayISO(), ...d }; state.animals.push(target); }
    if (typeof photo === 'string') {
      try { await photoDB.put(target.id, photo); target.hasPhoto = true; }
      catch (err) { toast('Şəkil yadda saxlanmadı'); }
    } else if (photo === null) {
      await photoDB.del(target.id); target.hasPhoto = false;
    }
    save();
    toast(a ? 'Yeniləndi' : 'Heyvan əlavə olundu');
    location.hash = `#/animal/${target.id}`;
  };
  if (a) $('#delBtn').onclick = () => {
    if (!confirm(`${animalLabel(a)} və bütün qeydləri silinsin?`)) return;
    state.animals = state.animals.filter((x) => x.id !== a.id);
    for (const k of ['treatments', 'weights', 'breedings']) state[k] = state[k].filter((x) => x.animalId !== a.id);
    photoDB.del(a.id);
    save();
    toast('Silindi');
    location.hash = '#/animals';
  };
}

function renderAnimal(id) {
  const a = animalById(id);
  if (!a) return notFound();
  setTitle(animalLabel(a), true);
  setTab('animals');
  const s = sp(a);
  const w = withdrawal(a.id);
  const ws = weightStats(a.id);
  const preg = state.breedings.filter((b) => b.animalId === a.id && !b.outcome).sort((x, y) => y.date.localeCompare(x.date))[0];
  const offspring = state.animals.filter((x) => x.damTag && x.damTag.toLowerCase() === a.tag.toLowerCase());

  const events = [
    ...state.treatments.filter((x) => x.animalId === id).map((x) => ({ ...x, kind: 'tr' })),
    ...state.weights.filter((x) => x.animalId === id).map((x) => ({ ...x, kind: 'w' })),
    ...state.breedings.filter((x) => x.animalId === id).map((x) => ({ ...x, kind: 'b' })),
  ].sort((x, y) => y.date.localeCompare(x.date));

  const evHtml = (e) => {
    let ico, title, sub = '';
    if (e.kind === 'tr') {
      ico = '💊'; title = `${esc(e.medicine)}${e.dose ? ' · ' + esc(e.dose) : ''}`;
      const p = [];
      if (e.reason) p.push(esc(e.reason));
      if (Number(e.meatWd)) p.push(`ət qalığı ${e.meatWd} gün`);
      if (Number(e.milkWd)) p.push(`süd qalığı ${e.milkWd} gün`);
      sub = p.join(' · ');
    } else if (e.kind === 'w') {
      ico = '⚖️'; title = `${e.kg} kq`;
    } else {
      ico = '🧬'; title = e.method === 'suni' ? 'Süni mayalanma' : 'Təbii cütləşmə';
      sub = [e.sire ? `Ata: ${esc(e.sire)}` : '', `Gözlənilən doğum: ${fmt(e.expected)}`, e.outcome ? `Nəticə: ${esc(e.outcome)}` : ''].filter(Boolean).join(' · ');
    }
    const resolve = e.kind === 'b' && !e.outcome ? ` <button class="btn sm ghost" data-resolve="${e.id}">Nəticəni qeyd et</button>` : '';
    return `<li><span class="t-ico">${ico}</span><div class="t-main"><b>${title}</b><br><small class="muted">${fmt(e.date)}${sub ? ' · ' + sub : ''}</small>${resolve}</div><button class="del" title="Sil" aria-label="Qeydi sil" data-del="${e.kind}:${e.id}">✕</button></li>`;
  };

  view().innerHTML = `
    <div class="card">
      ${a.hasPhoto ? `<img class="animal-photo" data-photo="${a.id}" alt="${esc(animalLabel(a))}">` : ''}
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:10px">
        <span style="font-size:2.4rem">${s.icon}</span>
        <div style="flex:1"><b style="font-size:1.15rem">${esc(a.tag)}</b>${a.name ? `<div class="muted">${esc(a.name)}</div>` : ''}</div>
        <a class="btn sm ghost" href="#/edit/${a.id}">Redaktə</a>
      </div>
      ${w ? `<div class="alert danger"><span>💊</span><div><b>Dərman qalığı dövrü</b><br><small>${w.meat ? 'Ət: ' + fmt(w.meat) + '-dək. ' : ''}${w.milk ? 'Süd: ' + fmt(w.milk) + '-dək.' : ''} Bu müddətdə məhsulu satmayın.</small></div></div>` : ''}
      ${preg ? `<div class="alert info"><span>🍼</span><div><b>Gözlənilən doğum: ${fmt(preg.expected)}</b><br><small>${inDays(daysBetween(todayISO(), preg.expected))}</small></div></div>` : ''}
      <dl class="kv">
        <dt>Növ / cins</dt><dd>${s.label}${a.breed ? ' · ' + esc(a.breed) : ''}</dd>
        <dt>Cinsiyyət</dt><dd>${a.sex === 'd' ? 'Dişi' : 'Erkək'}</dd>
        <dt>Doğum tarixi</dt><dd>${fmt(a.dob)}${a.dob ? ` (${age(a.dob)})` : ''}</dd>
        <dt>Ana</dt><dd>${a.damTag ? esc(a.damTag) : '—'}</dd>
        <dt>Qrup</dt><dd>${esc(a.group) || '—'}</dd>
        <dt>Status</dt><dd>${STATUS[a.status] || a.status}</dd>
        <dt>Son çəki</dt><dd>${ws ? `${ws.last.kg} kq (${fmt(ws.last.date)})` : '—'}</dd>
        ${ws && ws.adg !== null ? `<dt>Orta gündəlik artım</dt><dd>${ws.adg} q/gün</dd>` : ''}
        ${offspring.length ? `<dt>Balaları</dt><dd>${offspring.map((o) => `<a href="#/animal/${o.id}">${esc(o.tag)}</a>`).join(', ')}</dd>` : ''}
      </dl>
      ${a.notes ? `<p class="muted small">${esc(a.notes)}</p>` : ''}
    </div>

    <div class="actions">
      <button class="btn" id="addTr"><span>💊</span>Müalicə</button>
      <button class="btn" id="addW"><span>⚖️</span>Çəki</button>
      <button class="btn" id="addB" ${a.sex !== 'd' ? 'disabled style="opacity:.5"' : ''}><span>🧬</span>Mayalanma</button>
    </div>

    <h2>Tarixçə</h2>
    <div class="card">${events.length ? `<ul class="timeline">${events.map(evHtml).join('')}</ul>` : '<p class="muted" style="margin:0">Hələ qeyd yoxdur</p>'}</div>`;

  loadPhotos(view());
  $('#addTr').onclick = () => treatmentSheet(a);
  $('#addW').onclick = () => weightSheet(a);
  if (a.sex === 'd') $('#addB').onclick = () => breedingSheet(a);
  view().querySelectorAll('[data-del]').forEach((b) => b.onclick = () => {
    const [kind, eid] = b.dataset.del.split(':');
    const key = { tr: 'treatments', w: 'weights', b: 'breedings' }[kind];
    if (!confirm('Bu qeyd silinsin?')) return;
    state[key] = state[key].filter((x) => x.id !== eid);
    save(); renderAnimal(id);
  });
  view().querySelectorAll('[data-resolve]').forEach((b) => b.onclick = () => outcomeSheet(a, b.dataset.resolve));
}

function treatmentSheet(a) {
  openSheet(`💊 Müalicə — ${a.tag}`, `
    <label for="s-date">Tarix</label><input id="s-date" type="date" name="date" required value="${todayISO()}" max="${todayISO()}">
    ${medFieldsHtml(false)}
    <div class="grid2">
      <div><label for="s-dose">Doza</label><input id="s-dose" name="dose" placeholder="10 ml"></div>
      <div><label for="s-reason">Səbəb</label><input id="s-reason" name="reason" placeholder="Parazit, mastit…"></div>
    </div>
    <div class="grid2">
      <div><label for="s-meat">Ət qalığı (gün)</label><input id="s-meat" type="number" min="0" name="meatWd" value="0" inputmode="numeric"></div>
      <div><label for="s-milk">Süd qalığı (gün)</label><input id="s-milk" type="number" min="0" name="milkWd" value="0" inputmode="numeric"></div>
    </div>
    <p class="muted small">Qalıq müddətini dərmanın təlimatından və ya baytardan öyrənin. Tətbiq son tarixi avtomatik hesablayacaq.</p>`,
  (fd) => {
    const { used, ...d } = Object.fromEntries(fd);
    state.treatments.push({ id: uid(), animalId: a.id, ...d, meatWd: Number(d.meatWd) || 0, milkWd: Number(d.milkWd) || 0 });
    const note = takeFromStock(d.medicine, parseFloat(used) || 0);
    save(); toast('Müalicə qeyd olundu' + note); renderAnimal(a.id);
  });
  wireMedField();
}

/** Qrup müalicəsi: bütün sürü, bir növ və ya bir qrup üzrə eyni dərmanı bir dəfəyə qeyd edir. */
function groupTreatmentSheet() {
  const active = state.animals.filter((a) => a.status === 'aktiv');
  if (!active.length) return toast('Əvvəlcə heyvan əlavə edin');
  const targets = [['all', `Bütün aktiv heyvanlar (${active.length})`]];
  for (const [k, v] of Object.entries(SPECIES)) {
    const n = active.filter((a) => a.species === k).length;
    if (n) targets.push([`sp:${k}`, `${v.icon} Bütün ${v.plural} (${n})`]);
  }
  const groups = [...new Set(active.map((a) => (a.group || '').trim()).filter(Boolean))].sort((x, y) => x.localeCompare(y, 'az'));
  for (const g of groups) targets.push([`gr:${g}`, `Qrup: ${g} (${active.filter((a) => (a.group || '').trim() === g).length})`]);

  openSheet('💊 Qrup müalicəsi', `
    <label for="s-target">Kimlər müalicə olunur?</label>
    <select id="s-target" name="target">${targets.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('')}</select>
    <label for="s-date">Tarix</label><input id="s-date" type="date" name="date" required value="${todayISO()}" max="${todayISO()}">
    ${medFieldsHtml(true)}
    <div class="grid2">
      <div><label for="s-dose">Doza (hər heyvana)</label><input id="s-dose" name="dose" placeholder="2 ml"></div>
      <div><label for="s-reason">Səbəb</label><input id="s-reason" name="reason" placeholder="Peyvənd, parazit…"></div>
    </div>
    <div class="grid2">
      <div><label for="s-meat">Ət qalığı (gün)</label><input id="s-meat" type="number" min="0" name="meatWd" value="0" inputmode="numeric"></div>
      <div><label for="s-milk">Süd qalığı (gün)</label><input id="s-milk" type="number" min="0" name="milkWd" value="0" inputmode="numeric"></div>
    </div>`,
  (fd) => {
    const d = Object.fromEntries(fd);
    const t = d.target;
    const list = active.filter((a) =>
      t === 'all' ? true : t.startsWith('sp:') ? a.species === t.slice(3) : (a.group || '').trim() === t.slice(3));
    if (!list.length) { toast('Seçilən qrupda heyvan yoxdur'); return false; }
    const batchId = uid();
    for (const a of list) {
      state.treatments.push({
        id: uid(), batchId, animalId: a.id, date: d.date, medicine: d.medicine, dose: d.dose, reason: d.reason,
        meatWd: Number(d.meatWd) || 0, milkWd: Number(d.milkWd) || 0,
      });
    }
    const note = takeFromStock(d.medicine, (parseFloat(d.used) || 0) * list.length);
    save();
    toast(`${list.length} heyvan üçün müalicə qeyd olundu${note}`);
    route();
  });
  wireMedField();
}

function weightSheet(a) {
  openSheet(`⚖️ Çəki — ${a.tag}`, `
    <div class="grid2">
      <div><label for="s-date">Tarix</label><input id="s-date" type="date" name="date" required value="${todayISO()}" max="${todayISO()}"></div>
      <div><label for="s-kg">Çəki (kq) *</label><input id="s-kg" type="number" step="0.1" min="0.1" name="kg" required inputmode="decimal"></div>
    </div>`,
  (fd) => {
    const kg = parseFloat(fd.get('kg'));
    if (!(kg > 0)) { toast('Düzgün çəki daxil edin'); return false; }
    state.weights.push({ id: uid(), animalId: a.id, date: fd.get('date'), kg });
    save(); toast('Çəki qeyd olundu'); renderAnimal(a.id);
  });
}

function breedingSheet(a) {
  const s = sp(a);
  openSheet(`🧬 Mayalanma — ${a.tag}`, `
    <label for="s-date">Tarix</label><input id="s-date" type="date" name="date" required value="${todayISO()}" max="${todayISO()}">
    <label for="s-method">Üsul</label><select id="s-method" name="method"><option value="suni">Süni mayalanma</option><option value="tebii">Təbii cütləşmə</option></select>
    <label for="s-sire">Ata (buğa/qoç, toxum kodu)</label><input id="s-sire" name="sire">
    <p class="muted small">${s.label} üçün boğazlıq müddəti ≈ ${s.gest} gün. Gözlənilən doğum tarixi avtomatik hesablanacaq.</p>`,
  (fd) => {
    const d = Object.fromEntries(fd);
    state.breedings.push({ id: uid(), animalId: a.id, ...d, expected: addDays(d.date, s.gest), outcome: '' });
    save(); toast(`Gözlənilən doğum: ${fmt(addDays(d.date, s.gest))}`); renderAnimal(a.id);
  });
}

function outcomeSheet(a, bid) {
  const b = state.breedings.find((x) => x.id === bid);
  if (!b) return;
  openSheet(`Nəticə — ${a.tag}`, `
    <label for="s-out">Nəticə</label>
    <select id="s-out" name="outcome">
      <option>Doğdu</option><option>Boş çıxdı (təkrar mayalanma)</option><option>Bala saldı (abort)</option>
    </select>
    <label for="s-date">Tarix</label><input id="s-date" type="date" name="date" value="${todayISO()}" max="${todayISO()}">
    <p class="muted small">"Doğdu" seçsəniz, balanı ayrıca heyvan kimi əlavə etmək üçün forma açılacaq.</p>`,
  (fd) => {
    b.outcome = `${fd.get('outcome')} (${fmt(fd.get('date'))})`;
    save();
    if (fd.get('outcome') === 'Doğdu') {
      sessionStorage.setItem('suru-prefill', JSON.stringify({ species: a.species, damTag: a.tag, dob: fd.get('date'), breed: a.breed }));
      location.hash = '#/new';
    } else renderAnimal(a.id);
  });
}

function renderMeds() {
  setTitle('Dərman şkafı', true);
  setTab('more');
  const items = [...state.meds].sort((a, b) => a.name.localeCompare(b.name, 'az'));
  view().innerHTML = `
    <button class="btn block" id="addMed">＋ Dərman əlavə et</button>
    <ul class="list" style="margin-top:12px">
      ${items.length ? items.map((m) => {
        const wd = [Number(m.meatWd) ? `ət ${m.meatWd} gün` : '', Number(m.milkWd) ? `süd ${m.milkWd} gün` : ''].filter(Boolean).join(', ');
        return `<li><a href="#" data-med="${m.id}"><span class="ico">💊</span>
          <div class="main"><b>${esc(m.name)}</b><small>${m.qty} ${esc(m.unit)}${m.expiry ? ' · son istifadə ' + fmt(m.expiry) : ''}${wd ? ' · qalıq: ' + wd : ''}</small></div>
          ${medBadges(m)}<span class="chev">›</span></a></li>`;
      }).join('') : '<li class="empty">Şkaf boşdur. Fermadakı dərman və peyvəndləri əlavə edin — müalicə yazanda qalıq müddətləri avtomatik dolacaq, ehtiyat azalacaq.</li>'}
    </ul>
    <p class="muted small" style="margin-top:14px">Son istifadə tarixi 30 gündən az qalan, vaxtı keçən və minimum miqdardan az qalan dərmanlar paneldə göstərilir.</p>`;
  $('#addMed').onclick = () => medSheet();
  view().querySelectorAll('[data-med]').forEach((el) => el.onclick = (e) => {
    e.preventDefault();
    medSheet(state.meds.find((m) => m.id === el.dataset.med));
  });
}

function medSheet(m) {
  const v = m || { unit: 'ml', qty: 0, minQty: 0, meatWd: 0, milkWd: 0 };
  openSheet(m ? `💊 ${m.name}` : '💊 Yeni dərman', `
    <label for="d-name">Ad *</label><input id="d-name" name="name" required value="${esc(v.name)}" placeholder="Məs: İvermektin 1%">
    <div class="grid2">
      <div><label for="d-qty">Ehtiyat</label><input id="d-qty" type="number" min="0" step="0.1" name="qty" value="${esc(v.qty)}" inputmode="decimal"></div>
      <div><label for="d-unit">Vahid</label><select id="d-unit" name="unit">${MED_UNITS.map((u) => `<option ${u === v.unit ? 'selected' : ''}>${u}</option>`).join('')}</select></div>
    </div>
    <div class="grid2">
      <div><label for="d-min">Minimum (xəbərdarlıq)</label><input id="d-min" type="number" min="0" step="0.1" name="minQty" value="${esc(v.minQty)}" inputmode="decimal"></div>
      <div><label for="d-exp">Son istifadə tarixi</label><input id="d-exp" type="date" name="expiry" value="${esc(v.expiry)}"></div>
    </div>
    <div class="grid2">
      <div><label for="d-meat">Ət qalığı (gün)</label><input id="d-meat" type="number" min="0" name="meatWd" value="${esc(v.meatWd)}" inputmode="numeric"></div>
      <div><label for="d-milk">Süd qalığı (gün)</label><input id="d-milk" type="number" min="0" name="milkWd" value="${esc(v.milkWd)}" inputmode="numeric"></div>
    </div>
    <label for="d-notes">Qeyd</label><input id="d-notes" name="notes" value="${esc(v.notes)}" placeholder="Partiya nömrəsi, saxlama şəraiti…">
    ${m ? '<button type="button" class="btn ghost sm" id="medDel" style="margin-top:14px;color:var(--danger)">Dərmanı sil</button>' : ''}`,
  (fd) => {
    const d = Object.fromEntries(fd);
    d.name = d.name.trim();
    const dup = findMed(d.name);
    if (dup && dup !== m) { toast('Bu adda dərman artıq var'); return false; }
    for (const k of ['qty', 'minQty', 'meatWd', 'milkWd']) d[k] = Number(d[k]) || 0;
    if (m) Object.assign(m, d); else state.meds.push({ id: uid(), ...d });
    save(); toast('Yadda saxlanıldı'); renderMeds();
  });
  if (m) $('#medDel').onclick = () => {
    if (!confirm(`${m.name} şkafdan silinsin? (Keçmiş müalicə qeydləri qalacaq)`)) return;
    state.meds = state.meds.filter((x) => x.id !== m.id);
    save(); $('#sheet').close(); renderMeds();
  };
}

function renderTasks() {
  setTitle('Tapşırıqlar');
  setTab('tasks');
  const t = todayISO();
  const open = state.tasks.filter((x) => !x.done).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
  const done = state.tasks.filter((x) => x.done).slice(-10).reverse();
  const row = (k) => {
    const n = k.due ? daysBetween(t, k.due) : null;
    const badge = k.done ? '' : n === null ? '' : n < 0 ? `<span class="badge danger">${inDays(n)}</span>` : n <= 2 ? `<span class="badge warn">${inDays(n)}</span>` : `<span class="badge ok">${fmt(k.due)}</span>`;
    return `<li class="task ${k.done ? 'done' : ''}"><input type="checkbox" data-id="${k.id}" ${k.done ? 'checked' : ''} aria-label="Tamamlandı"><div class="main"><b>${esc(k.title)}</b></div>${badge}<button class="del" data-del="${k.id}" aria-label="Sil" style="background:none;border:0;color:var(--muted);cursor:pointer">✕</button></li>`;
  };
  view().innerHTML = `
    <form class="card" id="taskForm" style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end">
      <div><label for="t-title" style="margin-top:0">Yeni tapşırıq</label><input id="t-title" name="title" required placeholder="Məs: Şap peyvəndi — bütün sürü"></div>
      <div><label for="t-due" style="margin-top:0">Son tarix</label><input id="t-due" type="date" name="due" value="${t}"></div>
      <button class="btn" style="grid-column:1/-1">＋ Əlavə et</button>
    </form>
    <h2>Gözləyən (${open.length})</h2>
    <ul class="list">${open.length ? open.map(row).join('') : '<li class="empty">Gözləyən tapşırıq yoxdur</li>'}</ul>
    ${done.length ? `<h2>Tamamlanmış</h2><ul class="list">${done.map(row).join('')}</ul>` : ''}`;
  $('#taskForm').onsubmit = (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    state.tasks.push({ id: uid(), title: d.title.trim(), due: d.due, done: false });
    save(); renderTasks();
  };
  view().querySelectorAll('input[type=checkbox]').forEach((c) => c.onchange = () => {
    const k = state.tasks.find((x) => x.id === c.dataset.id);
    k.done = c.checked; save(); renderTasks();
  });
  view().querySelectorAll('[data-del]').forEach((b) => b.onclick = () => {
    state.tasks = state.tasks.filter((x) => x.id !== b.dataset.del); save(); renderTasks();
  });
}

function renderMore() {
  setTitle('Digər');
  setTab('more');
  view().innerHTML = `
    <h2>Ferma</h2>
    <form class="card" id="farmForm">
      <label for="m-name" style="margin-top:0">Fermanın adı</label><input id="m-name" name="name" value="${esc(state.farm.name)}">
      <div class="grid2">
        <div><label for="m-owner">Sahibi</label><input id="m-owner" name="owner" value="${esc(state.farm.owner)}"></div>
        <div><label for="m-region">Rayon / kənd</label><input id="m-region" name="region" value="${esc(state.farm.region)}"></div>
      </div>
      <div class="row-btns"><button class="btn">Yadda saxla</button></div>
    </form>

    <h2>Ferma ehtiyatı</h2>
    <ul class="list">
      <li><a href="#/meds"><span class="ico">🧴</span><div class="main"><b>Dərman şkafı</b><small>${state.meds.length} dərman${state.meds.some((m) => { const s = medStatus(m); return s.expired || s.soon || s.low; }) ? ' · diqqət tələb edənlər var' : ''}</small></div><span class="chev">›</span></a></li>
    </ul>

    <h2>Hesabatlar və ehtiyat nüsxə</h2>
    <ul class="list">
      <li><a href="#" id="csvAnimals"><span class="ico">📄</span><div class="main"><b>Heyvan siyahısı (CSV / Excel)</b><small>Bütün heyvanlar, son çəki, status</small></div></a></li>
      <li><a href="#" id="csvMeds"><span class="ico">💊</span><div class="main"><b>Dərman jurnalı (CSV / Excel)</b><small>Baytar və yoxlama üçün</small></div></a></li>
      <li><a href="#" id="backup"><span class="ico">💾</span><div class="main"><b>Ehtiyat nüsxə yüklə</b><small>Bütün məlumat bir JSON faylında</small></div></a></li>
      <li><label class="item" style="margin:0;font-size:1rem;font-weight:normal;cursor:pointer"><span class="ico">📥</span><div class="main"><b>Ehtiyat nüsxəni bərpa et</b><small>Mövcud məlumatı əvəz edir</small></div><input type="file" id="restore" accept="application/json,.json" hidden></label></li>
    </ul>

    <h2>Digər</h2>
    <ul class="list">
      <li><a href="#" id="demo"><span class="ico">🧪</span><div class="main"><b>Nümunə məlumat yüklə</b><small>Tətbiqi sınamaq üçün</small></div></a></li>
      <li><a href="#" id="wipe"><span class="ico">🗑️</span><div class="main"><b style="color:var(--danger)">Bütün məlumatı sil</b><small>Geri qaytarmaq olmaz</small></div></a></li>
    </ul>
    <p class="muted small" style="text-align:center;margin-top:24px">Sürü v0.2 · Məlumatlar yalnız bu cihazda saxlanılır.<br>Mütəmadi ehtiyat nüsxə götürün.</p>`;

  $('#farmForm').onsubmit = (e) => {
    e.preventDefault();
    Object.assign(state.farm, Object.fromEntries(new FormData(e.target)));
    save(); toast('Yadda saxlanıldı');
  };
  $('#csvAnimals').onclick = (e) => { e.preventDefault(); exportAnimalsCsv(); };
  $('#csvMeds').onclick = (e) => { e.preventDefault(); exportMedsCsv(); };
  $('#backup').onclick = async (e) => {
    e.preventDefault();
    const photos = await photoDB.all();
    download(`suru-ehtiyat-${todayISO()}.json`, JSON.stringify({ ...state, photos }), 'application/json');
  };
  $('#restore').onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!Array.isArray(data.animals)) throw new Error('format');
      if (!confirm('Mövcud məlumat ehtiyat nüsxə ilə əvəz olunsun?')) return;
      const { photos, ...rest } = data;
      state = Object.assign(emptyState(), rest);
      await photoDB.clear();
      for (const [k, v] of Object.entries(photos || {})) {
        if (typeof v === 'string' && v.startsWith('data:image/')) await photoDB.put(k, v);
      }
      save(); toast('Bərpa olundu'); location.hash = '#/';
    } catch (err) { toast('Fayl oxunmadı — düzgün ehtiyat nüsxə deyil'); }
  };
  $('#demo').onclick = (e) => { e.preventDefault(); if (!state.animals.length || confirm('Nümunə məlumat mövcud məlumatı əvəz edəcək. Davam edilsin?')) loadDemo(); };
  $('#wipe').onclick = (e) => {
    e.preventDefault();
    if (!confirm('Bütün məlumat silinsin? Bu əməliyyatı geri qaytarmaq olmaz.')) return;
    state = emptyState(); save(); photoDB.clear(); toast('Məlumat silindi'); location.hash = '#/';
  };
}

function notFound() {
  setTitle('Tapılmadı', true);
  view().innerHTML = '<div class="card empty">Bu səhifə və ya heyvan tapılmadı. <a href="#/animals">Heyvanlara qayıt</a></div>';
}

/* ---------- İxrac ---------- */
function csv(rows) {
  const cell = (v) => {
    const s = String(v ?? '');
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // Excel-in Azərbaycan hərflərini düzgün göstərməsi üçün BOM əlavə olunur.
  return '﻿' + rows.map((r) => r.map(cell).join(';')).join('\n');
}
function download(name, content, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function exportAnimalsCsv() {
  const rows = [['Bırka', 'Ad', 'Növ', 'Cins', 'Cinsiyyət', 'Doğum tarixi', 'Ana', 'Qrup', 'Status', 'Son çəki (kq)', 'Orta artım (q/gün)']];
  for (const a of state.animals) {
    const w = weightStats(a.id);
    rows.push([a.tag, a.name, sp(a).label, a.breed, a.sex === 'd' ? 'Dişi' : 'Erkək', fmt(a.dob), a.damTag, a.group, STATUS[a.status], w ? w.last.kg : '', w && w.adg !== null ? w.adg : '']);
  }
  download(`suru-heyvanlar-${todayISO()}.csv`, csv(rows), 'text/csv;charset=utf-8');
}
function exportMedsCsv() {
  const rows = [['Tarix', 'Bırka', 'Dərman', 'Doza', 'Səbəb', 'Ət qalığı (gün)', 'Ət — son tarix', 'Süd qalığı (gün)', 'Süd — son tarix']];
  for (const t of [...state.treatments].sort((a, b) => a.date.localeCompare(b.date))) {
    const a = animalById(t.animalId);
    rows.push([fmt(t.date), a ? a.tag : '', t.medicine, t.dose, t.reason, t.meatWd, t.meatWd ? fmt(addDays(t.date, t.meatWd)) : '', t.milkWd, t.milkWd ? fmt(addDays(t.date, t.milkWd)) : '']);
  }
  download(`suru-derman-jurnali-${todayISO()}.csv`, csv(rows), 'text/csv;charset=utf-8');
}

/* ---------- Nümunə məlumat ---------- */
function loadDemo() {
  const t = todayISO();
  const d = (n) => addDays(t, n);
  const s = emptyState();
  s.farm = { name: 'Qarabağ Ailə Ferması', owner: 'Nümunə fermer', region: 'Ağcabədi' };
  const mk = (o) => { const a = { id: uid(), createdAt: t, status: 'aktiv', name: '', damTag: '', group: '', notes: '', ...o }; s.animals.push(a); return a; };
  const maral = mk({ tag: 'AZ 1001', name: 'Maral', species: 'inek', breed: 'Qafqaz qonuru', sex: 'd', dob: d(-365 * 5), group: 'Sağmal' });
  const ceyran = mk({ tag: 'AZ 1002', name: 'Ceyran', species: 'inek', breed: 'Simmental', sex: 'd', dob: d(-365 * 4 - 40), group: 'Sağmal' });
  const qaraca = mk({ tag: 'AZ 1003', name: 'Qaraca', species: 'inek', breed: 'Holşteyn', sex: 'd', dob: d(-365 * 3), group: 'Sağmal' });
  const buzov = mk({ tag: 'AZ 1004', name: '', species: 'inek', breed: 'Qafqaz qonuru', sex: 'e', dob: d(-150), damTag: 'AZ 1001', group: 'Buzovlar' });
  mk({ tag: 'AZ 1005', name: 'Polad', species: 'inek', breed: 'Simmental', sex: 'e', dob: d(-365 * 2), group: 'Kökəltmə' });
  mk({ tag: 'AZ 2001', name: '', species: 'camis', breed: 'Azərbaycan camışı', sex: 'd', dob: d(-365 * 6), group: 'Sağmal' });
  for (let i = 1; i <= 6; i++) mk({ tag: `Q-${300 + i}`, species: 'qoyun', breed: i % 2 ? 'Qarabağ' : 'Balbas', sex: i === 6 ? 'e' : 'd', dob: d(-365 * 2 - i * 20), group: 'Sürü 1' });
  mk({ tag: 'K-501', species: 'keci', breed: 'Yerli', sex: 'd', dob: d(-700) });

  s.treatments.push({ id: uid(), animalId: ceyran.id, date: d(-2), medicine: 'Penisilin', dose: '20 ml', reason: 'Mastit', meatWd: 10, milkWd: 4 });
  s.treatments.push({ id: uid(), animalId: maral.id, date: d(-40), medicine: 'Şap peyvəndi', dose: '2 ml', reason: 'Peyvənd', meatWd: 0, milkWd: 0 });
  s.weights.push({ id: uid(), animalId: buzov.id, date: d(-150), kg: 32 });
  s.weights.push({ id: uid(), animalId: buzov.id, date: d(-90), kg: 78 });
  s.weights.push({ id: uid(), animalId: buzov.id, date: d(-5), kg: 141 });
  s.breedings.push({ id: uid(), animalId: maral.id, date: d(-270), method: 'suni', sire: 'SIM-2231', expected: d(13), outcome: '' });
  s.breedings.push({ id: uid(), animalId: qaraca.id, date: d(-60), method: 'tebii', sire: 'AZ 1005', expected: d(223), outcome: '' });
  s.tasks.push({ id: uid(), title: 'Qoyunlara parazit dərmanı', due: d(1), done: false });
  s.tasks.push({ id: uid(), title: 'Baytar çağır — Ceyranın yoxlanışı', due: d(3), done: false });
  s.tasks.push({ id: uid(), title: 'Yem sifarişi (qarğıdalı silosu)', due: d(-1), done: false });
  s.meds.push({ id: uid(), name: 'Penisilin', qty: 80, unit: 'ml', minQty: 50, expiry: d(240), meatWd: 10, milkWd: 4, notes: '' });
  s.meds.push({ id: uid(), name: 'İvermektin 1%', qty: 30, unit: 'ml', minQty: 50, expiry: d(20), meatWd: 28, milkWd: 0, notes: 'Sağmal heyvanlara vurulmur' });
  s.meds.push({ id: uid(), name: 'Şap peyvəndi', qty: 18, unit: 'doza', minQty: 5, expiry: d(150), meatWd: 0, milkWd: 0, notes: 'Soyuducuda saxla' });
  state = s;
  photoDB.clear();
  save();
  toast('Nümunə məlumat yükləndi');
  location.hash = '#/';
  route();
}

/* ---------- Marşrutlaşdırma ---------- */
function route() {
  const parts = (location.hash.replace(/^#\/?/, '') || '').split('/');
  const [page, id] = parts;
  window.scrollTo(0, 0);
  switch (page) {
    case '': case undefined: return renderHome();
    case 'animals': return renderAnimals();
    case 'animal': return renderAnimal(id);
    case 'new': {
      renderAnimalForm();
      const pre = sessionStorage.getItem('suru-prefill');
      if (pre) {
        sessionStorage.removeItem('suru-prefill');
        const p = JSON.parse(pre);
        const f = $('#animalForm');
        for (const [k, v] of Object.entries(p)) if (f.elements[k]) f.elements[k].value = v;
        $('#f-species').dispatchEvent(new Event('change'));
        toast('Balanın məlumatlarını tamamlayın');
      }
      return;
    }
    case 'edit': return renderAnimalForm(id);
    case 'tasks': return renderTasks();
    case 'meds': return renderMeds();
    case 'more': return renderMore();
    default: return notFound();
  }
}

$('#backBtn').onclick = () => (history.length > 1 ? history.back() : (location.hash = '#/'));
window.addEventListener('hashchange', route);

function updateOnline() { $('#offlineBadge').hidden = navigator.onLine; }
window.addEventListener('online', updateOnline);
window.addEventListener('offline', updateOnline);
updateOnline();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

route();
