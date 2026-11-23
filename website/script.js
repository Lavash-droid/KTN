'use strict';

// Mobil menyu
const menuBtn = document.querySelector('.menu-btn');
const menu = document.getElementById('menu');
menuBtn.addEventListener('click', () => {
  const open = menu.classList.toggle('open');
  menuBtn.setAttribute('aria-expanded', String(open));
});
menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => {
  menu.classList.remove('open');
  menuBtn.setAttribute('aria-expanded', 'false');
}));

// Aylıq / illik qiymət
document.querySelectorAll('.price-toggle button').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.price-toggle button').forEach((b) => b.classList.toggle('on', b === btn));
    const p = btn.dataset.period;
    document.querySelectorAll('[data-m]').forEach((el) => { el.textContent = el.dataset[p]; });
  });
});

// Paket düyməsi formada paketi seçir
document.querySelectorAll('[data-plan]').forEach((a) => a.addEventListener('click', () => {
  document.querySelector('#contactForm select[name=plan]').value = a.dataset.plan;
}));

// Əlaqə forması → müraciətlər cədvəli. config.js-də apiUrl varsa — daxili server (POST /leads),
// yoxsa Supabase "leads" cədvəli (yalnız əlavə etmək olar, oxumaq olmaz — RLS).
document.getElementById('contactForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button');
  const ok = document.getElementById('formOk');
  const err = document.getElementById('formErr');
  const f = Object.fromEntries(new FormData(form));
  err.hidden = true;
  if (f.website) { ok.hidden = false; form.reset(); return; } // bot
  btn.disabled = true;
  try {
    const cfg = window.SURU_CONFIG || {};
    const body = JSON.stringify({
      name: String(f.name || '').trim().slice(0, 120),
      phone: String(f.phone || '').trim().slice(0, 40),
      region: String(f.region || '').trim().slice(0, 120),
      herd_size: String(f.size || ''),
      plan: String(f.plan || ''),
      message: String(f.msg || '').trim().slice(0, 2000),
    });
    const res = cfg.apiUrl
      ? await fetch(`${cfg.apiUrl.replace(/\/+$/, '')}/leads`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
      : await fetch(`${cfg.supabaseUrl}/rest/v1/leads`, {
          method: 'POST',
          headers: { apikey: cfg.supabaseKey, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body,
        });
    if (!res.ok) throw new Error(String(res.status));
    ok.hidden = false;
    form.reset();
  } catch (_) {
    err.hidden = false;
    btn.disabled = false;
  }
});

// Sürüşdürəndə menyunun alt xətti görünür
const nav = document.querySelector('.nav');
const onScroll = () => { nav.style.borderBottomColor = window.scrollY > 8 ? 'var(--line)' : 'transparent'; };
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

document.getElementById('year').textContent = new Date().getFullYear();
