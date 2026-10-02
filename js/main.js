import { Hero } from './widgets/hero.js';
import { Channel } from './widgets/channel.js';
import { Repetition } from './widgets/repetition.js';
import { Cube } from './widgets/cube.js';
import { Venn } from './widgets/venn.js';
import { Interleave } from './widgets/interleave.js';
import { Polynomial } from './widgets/polynomial.js';
import { Finale } from './widgets/finale.js';
import { applyTheme, isLight, getLang, setLang } from './widgets/figure.js';

const REGISTRY = {
  hero: Hero,
  channel: Channel,
  repetition: Repetition,
  cube: Cube,
  venn: Venn,
  interleave: Interleave,
  polynomial: Polynomial,
  finale: Finale,
};

const params = new URLSearchParams(location.search);
const demo = params.has('demo');

const CRASH_MSG = { tr: 'bu figür çöktü — lütfen bir issue açın.', en: 'this figure crashed — please file an issue.' };

let instances = [];
function buildFigures() {
  // tear down any previous build so a language switch never leaks RAF loops
  // or observers onto detached canvases
  for (const inst of instances) { try { inst.destroy?.(); } catch (e) { /* ignore */ } }
  instances = [];
  for (const fig of document.querySelectorAll('[data-figure]')) {
    const name = fig.dataset.figure;
    const Widget = REGISTRY[name];
    if (!Widget) continue;
    const body = fig.querySelector('.fig-body');
    body.replaceChildren(); // drop the old canvas + control bars
    try {
      instances.push(new Widget(body, { demo }));
    } catch (err) {
      console.error(`figure "${name}" failed:`, err);
      const msg = document.createElement('p');
      msg.className = 'fig-note rust';
      msg.textContent = CRASH_MSG[getLang()] || CRASH_MSG.en;
      body.replaceChildren(msg);
    }
  }
}
buildFigures();

// demo mode strips the chrome so the GIF is pure hero
if (demo) {
  document.body.classList.add('demo');
  const style = document.createElement('style');
  style.textContent = `
    .demo header.masthead, .demo .chapter:not(#ch0), .demo footer, .demo .rule,
    .demo #ch0 p, .demo #ch0 .chapter-head, .demo figcaption { display: none; }
    .demo main .chapter { margin-top: 1rem; }
  `;
  document.head.appendChild(style);
}

// theme toggle: picking what the device already prefers means "follow the device" again
const themeBtn = document.getElementById('themeBtn');
if (themeBtn) {
  themeBtn.addEventListener('click', () => {
    const next = isLight() ? 'dark' : 'light';
    const device = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    try {
      if (next === device) { document.documentElement.removeAttribute('data-theme'); localStorage.removeItem('theme'); }
      else { document.documentElement.setAttribute('data-theme', next); localStorage.setItem('theme', next); }
    } catch (e) { document.documentElement.setAttribute('data-theme', next); }
    applyTheme();
  });
}

// language toggle: flip TR/EN, persist the choice, and rebuild every figure so
// its canvas text and DOM controls come back in the chosen language
const langBtn = document.getElementById('langBtn');
function paintLangBtn() {
  if (!langBtn) return;
  const next = getLang() === 'tr' ? 'en' : 'tr';
  langBtn.textContent = next.toUpperCase();
  langBtn.setAttribute('aria-label', next === 'tr' ? 'Türkçe sürüm' : 'English version');
}
paintLangBtn();
if (langBtn) {
  langBtn.addEventListener('click', () => {
    const next = getLang() === 'tr' ? 'en' : 'tr';
    setLang(next);
    try { localStorage.setItem('lang', next); } catch (e) { /* storage blocked */ }
    document.documentElement.setAttribute('data-lang', next);
    document.documentElement.lang = next;
    paintLangBtn();
    buildFigures();
  });
}
