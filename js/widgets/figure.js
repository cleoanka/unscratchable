// Shared chassis for every interactive figure: canvas with correct DPR
// scaling, unified mouse/touch pointer events, a RAF loop that pauses when
// the figure scrolls out of view, and DOM-based controls (buttons, sliders,
// segmented toggles) so keyboards and screen readers get real elements.

export const C = {
  ink: '#100f0d',
  panel: '#171613',
  panel2: '#1c1a16',
  edge: '#2a2823',
  edgeSoft: '#221f1a',
  text: '#e8e2d3',
  bright: '#fdf8ea',
  dim: '#9b9483',
  faint: '#847d69', // quiet, but still ≥4.5:1 on the ink background
  rust: '#e0533d',
  heal: '#3ddc84',
  gold: '#c8a24b',
  blocks: ['#6b7f99', '#7d8f6b', '#a17860', '#8b6b8f', '#997f6b', '#6b9990'],
};

export const MONO = "ui-monospace, 'SF Mono', 'Cascadia Code', Menlo, Consolas, monospace";
export const SERIF = "'Iowan Old Style', 'Palatino Linotype', Palatino, Charter, Georgia, serif";

export function mono(px) { return `${px}px ${MONO}`; }

const motionQuery = typeof matchMedia !== 'undefined'
  ? matchMedia('(prefers-reduced-motion: reduce)')
  : null;
// live query — respects the OS setting changing mid-session
export function reducedMotion() {
  return motionQuery ? motionQuery.matches : false;
}

export class Figure {
  // touch: 'drag' figures own the gesture (touch-action none);
  //        'tap' figures let vertical pans scroll the page
  constructor(mount, { aspect = 0.6, minH = 220, maxH = 560, touch = 'drag' } = {}) {
    this.mount = mount;
    this.aspect = aspect;
    this.minH = minH;
    this.maxH = maxH;

    this.canvas = document.createElement('canvas');
    this.canvas.style.touchAction = touch === 'tap' ? 'pan-y' : 'none';
    this.ctx = this.canvas.getContext('2d');
    mount.appendChild(this.canvas);

    this.w = 0;
    this.h = 0;
    this.t = 0;
    this.hover = null;
    this.down = false;
    this.#pointerId = null;

    this.canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return; // left button only
      if (this.#pointerId !== null) return; // one finger owns the gesture
      this.#pointerId = e.pointerId;
      this.canvas.setPointerCapture(e.pointerId);
      this.down = true;
      const p = this.#xy(e);
      this.hover = p;
      this.onDown?.(p.x, p.y, e);
      e.preventDefault();
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (this.#pointerId !== null && e.pointerId !== this.#pointerId) return;
      const p = this.#xy(e);
      this.hover = p;
      this.onMove?.(p.x, p.y, e);
    });
    const up = (e) => {
      if (!this.down || e.pointerId !== this.#pointerId) return;
      this.down = false;
      this.#pointerId = null;
      const p = this.#xy(e);
      this.onUp?.(p.x, p.y, e);
    };
    this.canvas.addEventListener('pointerup', up);
    this.canvas.addEventListener('pointercancel', up);
    this.canvas.addEventListener('lostpointercapture', () => {
      this.down = false;
      this.#pointerId = null;
    });
    this.canvas.addEventListener('pointerleave', () => {
      this.hover = null;
      this.onLeave?.();
    });

    this.visible = false;
    this.#last = 0;
    new IntersectionObserver((entries) => {
      for (const en of entries) {
        this.visible = en.isIntersecting;
        if (this.visible) this.#start();
        else this.#stop();
      }
    }, { rootMargin: '80px' }).observe(this.canvas);

    new ResizeObserver(() => this.#resize()).observe(mount);
    this.#resize();
  }

  #xy(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  #resize() {
    const w = this.mount.clientWidth;
    if (w === 0) return;
    const h = Math.max(this.minH, Math.min(this.maxH, Math.round(w * this.aspect)));
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = w;
    this.h = h;
    this.onResize?.(w, h);
  }

  #pointerId = null;
  #raf = null;
  #last;
  #start() {
    if (this.#raf != null) return;
    this.#last = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.05, (now - this.#last) / 1000);
      this.#last = now;
      this.t += dt;
      this.update?.(dt);
      this.draw(this.ctx, this.w, this.h);
      this.#raf = requestAnimationFrame(tick);
    };
    this.#raf = requestAnimationFrame(tick);
  }
  #stop() {
    if (this.#raf != null) cancelAnimationFrame(this.#raf);
    this.#raf = null;
  }

  draw() {} // subclass responsibility
}

// ---------- DOM controls ----------

export function uiBar(parent) {
  const bar = document.createElement('div');
  bar.className = 'fig-ui';
  parent.appendChild(bar);
  return bar;
}

export function button(bar, label, onClick, kind = '') {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `fig-btn ${kind}`.trim();
  b.textContent = label;
  b.addEventListener('click', onClick);
  bar.appendChild(b);
  return b;
}

export function slider(bar, { label, min, max, step = 1, value, format = String, onInput }) {
  const wrap = document.createElement('label');
  wrap.className = 'fig-field';
  const lbl = document.createElement('span');
  lbl.className = 'lbl';
  lbl.textContent = label;
  const input = document.createElement('input');
  input.type = 'range';
  input.min = min;
  input.max = max;
  input.step = step;
  input.value = value;
  const val = document.createElement('span');
  val.className = 'val';
  val.textContent = format(value);
  input.addEventListener('input', () => {
    val.textContent = format(input.valueAsNumber);
    onInput(input.valueAsNumber);
  });
  wrap.append(lbl, input, val);
  bar.appendChild(wrap);
  return {
    get value() { return input.valueAsNumber; },
    set(v) { input.value = v; val.textContent = format(v); },
    input,
  };
}

export function segmented(bar, { options, value, onChange, label }) {
  if (label) {
    const lbl = document.createElement('span');
    lbl.className = 'lbl';
    lbl.textContent = label;
    bar.appendChild(lbl);
  }
  const seg = document.createElement('div');
  seg.className = 'seg';
  seg.setAttribute('role', 'group');
  if (label) seg.setAttribute('aria-label', label);
  const buttons = options.map((opt) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = opt.label;
    b.setAttribute('aria-pressed', String(opt.value === value));
    if (opt.value === value) b.classList.add('on');
    b.addEventListener('click', () => {
      for (const other of buttons) {
        other.classList.remove('on');
        other.setAttribute('aria-pressed', 'false');
      }
      b.classList.add('on');
      b.setAttribute('aria-pressed', 'true');
      onChange(opt.value);
    });
    seg.appendChild(b);
    return b;
  });
  bar.appendChild(seg);
  return seg;
}

// live: announce changes to screen readers — reserve for user-triggered
// results, never for timer-driven or per-pointermove churn
export function note(bar, initial = '', { live = false } = {}) {
  const n = document.createElement('span');
  n.className = 'fig-note';
  if (live) n.setAttribute('aria-live', 'polite');
  n.textContent = initial;
  bar.appendChild(n);
  return {
    el: n,
    set(text, tone = '') {
      n.textContent = text;
      n.className = `fig-note ${tone}`.trim();
    },
  };
}

export function spacer(bar) {
  const s = document.createElement('span');
  s.className = 'spacer';
  bar.appendChild(s);
  return s;
}

// ---------- small drawing helpers ----------

export function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function ease(x) { return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2; }

export function mix(a, b, t) { return a + (b - a) * t; }

// hex color with alpha
export function fade(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

// Render a short string to a 1-bit W×H cell bitmap using an offscreen canvas.
export function textBitmap(text, cols, rows, { font = 'bold %px ' + MONO } = {}) {
  const off = document.createElement('canvas');
  off.width = cols;
  off.height = rows;
  const octx = off.getContext('2d', { willReadFrequently: true });
  octx.fillStyle = '#000';
  octx.fillRect(0, 0, cols, rows);
  octx.fillStyle = '#fff';
  octx.textAlign = 'center';
  octx.textBaseline = 'middle';
  // binary-search the largest font size that fits
  let lo = 4, hi = rows * 1.4;
  const fits = (px) => {
    octx.font = font.replace('%', px);
    return octx.measureText(text).width <= cols * 0.92;
  };
  while (hi - lo > 0.5) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid; else hi = mid;
  }
  octx.font = font.replace('%', lo);
  octx.fillText(text, cols / 2, rows / 2 + rows * 0.04);
  const img = octx.getImageData(0, 0, cols, rows).data;
  const bits = new Uint8Array(cols * rows);
  for (let i = 0; i < bits.length; i++) bits[i] = img[i * 4] > 127 ? 1 : 0;
  return bits;
}
