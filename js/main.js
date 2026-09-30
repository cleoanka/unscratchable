import { Hero } from './widgets/hero.js';
import { Channel } from './widgets/channel.js';
import { Repetition } from './widgets/repetition.js';
import { Cube } from './widgets/cube.js';
import { Venn } from './widgets/venn.js';
import { Interleave } from './widgets/interleave.js';
import { Polynomial } from './widgets/polynomial.js';
import { Finale } from './widgets/finale.js';
import { applyTheme, isLight } from './widgets/figure.js';

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

for (const fig of document.querySelectorAll('[data-figure]')) {
  const name = fig.dataset.figure;
  const Widget = REGISTRY[name];
  if (!Widget) continue;
  const body = fig.querySelector('.fig-body');
  try {
    new Widget(body, { demo });
  } catch (err) {
    console.error(`figure "${name}" failed:`, err);
    const msg = document.createElement('p');
    msg.className = 'fig-note rust';
    msg.textContent = 'this figure crashed — please file an issue.';
    body.replaceChildren(msg);
  }
}

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
