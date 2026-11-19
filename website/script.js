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

// Əlaqə forması — backend qoşulana qədər müraciəti brauzerdə göstərir.
// TODO: serverə və ya CRM-ə göndərmək (məs. /api/leads).
document.getElementById('contactForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.target;
  form.querySelector('button').disabled = true;
  document.getElementById('formOk').hidden = false;
  form.reset();
});

document.getElementById('privacyLink').addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('privacy').showModal();
});

document.getElementById('year').textContent = new Date().getFullYear();
