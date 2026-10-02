// Shared chassis for every interactive figure: canvas with correct DPR
// scaling, unified mouse/touch pointer events, a RAF loop that pauses when
// the figure scrolls out of view, and DOM-based controls (buttons, sliders,
// segmented toggles) so keyboards and screen readers get real elements.

// Canvas palette. Dark is the house style; LIGHT mirrors the paper theme in
// essay.css. C is mutated in place on theme changes, and every widget reads it
// at draw time, so figures recolour on the next frame.
const DARK = {
  ink: '#0f1115',
  panel: '#16191f',
  panel2: '#1c2026',
  edge: '#2d333b',
  edgeSoft: '#242930',
  text: '#d1d5db',
  bright: '#f3f4f6',
  dim: '#9aa1ab',
  faint: '#818892', // quiet, but still ≥4.5:1 on the ink background
  rust: '#fb7185',
  heal: '#34d399',
  gold: '#d4af37',
  shade: '#000000',
  blocks: ['#6b7f99', '#7d8f6b', '#a17860', '#8b6b8f', '#997f6b', '#6b9990'],
};
const LIGHT = {
  ink: '#fcfcfc',
  panel: '#f4f5f7',
  panel2: '#ebeef2',
  edge: '#d6dae1',
  edgeSoft: '#e7e9ee',
  text: '#374151',
  bright: '#111827',
  dim: '#5b6170',
  faint: '#696e76',
  rust: '#be123c',
  heal: '#017e58',
  gold: '#846836',
  shade: '#374151',
  blocks: ['#4f6480', '#5d7148', '#8a5a40', '#71507a', '#80624b', '#437a70'],
};
export const C = { ...DARK };

const lightQuery = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: light)') : null;
export function isLight() {
  const t = typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') : null;
  if (t) return t === 'light';
  return lightQuery ? lightQuery.matches : false;
}
export function applyTheme() {
  Object.assign(C, isLight() ? LIGHT : DARK);
  if (typeof document !== 'undefined') document.documentElement.classList.toggle('is-dark', !isLight());
}
applyTheme();
if (lightQuery) (lightQuery.addEventListener ? lightQuery.addEventListener('change', applyTheme) : lightQuery.addListener(applyTheme));

export const MONO = "ui-monospace, 'SF Mono', 'Cascadia Code', Menlo, Consolas, monospace";
export const SERIF = "'Iowan Old Style', 'Palatino Linotype', Palatino, Charter, Georgia, serif";

export function mono(px) { return `${px}px ${MONO}`; }

// ---------- i18n ----------
// Every reader-facing string drawn on a canvas or placed on a DOM control
// lives here, in both languages. Widgets call t(key, ...args); figures are
// re-instantiated on a language switch (see main.js), so a fresh build simply
// reads the active language. Template strings are stored as functions.
let LANG = 'en';
export function getLang() { return LANG; }
export function setLang(l) { LANG = l === 'tr' ? 'tr' : 'en'; }
(function initLang() {
  try {
    const s = localStorage.getItem('lang');
    if (s === 'tr' || s === 'en') { LANG = s; return; }
  } catch (e) { /* storage blocked */ }
  if (typeof document !== 'undefined') {
    const d = document.documentElement.getAttribute('data-lang');
    if (d) LANG = d === 'tr' ? 'tr' : 'en';
  }
})();

const STR = {
  en: {
    // shared control labels
    noise: 'noise', sendAgain: 'send again', copies: 'copies', brush: 'brush',
    reset: 'reset', brushLevels: ['fine', 'thin', 'wide', 'brutal'],
    // channel
    c_sent: 'SENT', c_recv: 'RECEIVED',
    c_perbit: (p) => `p = ${p}% PER BIT`,
    c_stat: (hits, n, prob) => `${hits} of ${n} bits flipped · a clean arrival has probability (1−p)^${n} ≈ ${prob}%`,
    // repetition
    r_eachbit: (R) => `EACH BIT × ${R}, AS RECEIVED`,
    r_majority: 'MAJORITY VOTE', r_decoded: 'DECODED',
    r_clean: 'clean', r_lost: (n) => `${n} bit${n > 1 ? 's' : ''} lost`,
    r_stat: (total, n, pct, tail) => `${total} bits sent for ${n} bits of meaning · message survives ${pct}% of sends · this send: ${tail}`,
    // cube
    cube_aria: 'cube of 3-bit strings — arrow keys rotate, Enter steps through corners',
    cube_click: 'click any corner to decode it',
    cube_showSpheres: 'show decoding spheres', cube_hideSpheres: 'hide decoding spheres',
    cube_isCodeword: (v) => `${v} is a codeword — it decodes as itself`,
    cube_decodesTo: (v, c, d) => `d(${v}, ${c}) = ${d} → decodes to ${c}`,
    cube_legend: 'CODE {000, 111} · EDGES = SINGLE BIT FLIPS · DRAG TO ROTATE',
    // venn
    v_click: 'click any bit to flip it in transit',
    v_newMsg: 'new message', v_flipRandom: 'flip random bit', v_repair: 'repair',
    v_nothingRepair: 'nothing to repair — all three circles agree',
    v_repaired: (s) => `repaired position ${s} — message intact`,
    v_twoHits: 'two hits: the syndrome pointed at an innocent bit — silent corruption',
    v_pristine: 'pristine — all three circles agree',
    v_undetectable: (f) => `${f} flips that cancel every parity — undetectable!`,
    v_flipped: (f, s) => `${f} bit${f > 1 ? 's' : ''} flipped · broken circles point at position ${s}${f > 1 ? ' (wrongly — one flip is the limit)' : ''}`,
    v_parityChecks: 'PARITY CHECKS', v_broken: 'BROKEN', v_holds: 'holds',
    v_syndromeHdr: 'SYNDROME  (p₄ p₂ p₁)',
    v_allclear: '= 0 · all clear',
    v_position: (s) => `= ${s} · position ${s}`,
    v_sentLine: (sent) => `sent  d₁d₂d₃d₄ = ${sent}`,
    v_readsLine: (dec, ok) => `reads          ${dec} ${ok ? '✓' : '✗'}`,
    v_narrowSyndrome: (sBits, s) => `SYNDROME p₄p₂p₁ = ${sBits}  ${s === 0 ? '· all clear' : `= ${s} → position ${s}`}`,
    v_narrowReads: (sent, dec, ok) => `sent ${sent} · reads ${dec} ${ok ? '✓' : '✗'}`,
    // interleave
    i_aria: 'scratch position — arrow keys slide the burst across both layouts',
    i_scratchWidth: 'scratch width',
    i_seqLoses: (n) => `same scratch: sequential loses ${n} block${n > 1 ? 's' : ''} · interleaved heals everything`,
    i_bothSurvive: 'this scratch is small enough for both layouts — widen it',
    i_bothDrown: (len, B, nsym) => `even interleaving drowns: ${len} bytes over ${B} blocks exceeds ${nsym}/block`,
    i_seqLabel: 'SEQUENTIAL — BLOCK AFTER BLOCK',
    i_ilLabel: 'INTERLEAVED — COLUMN BY COLUMN',
    i_blk: (b, load, nsym, mark) => `■ blk${b} ${load}/${nsym}${mark}`,
    i_lost: ' ✕', i_ok: ' ✓',
    i_scratch: '⟵ SCRATCH · drag ⟶',
    // polynomial
    p_restore: 'restore all points',
    p_gf256: (cw) => `same trick in GF(256): “Hi” = [72 105] → sent as [${cw}] — any 2 of these 7 bytes rebuild the message`,
    p_recovered: (dead, alive) => `7 sent · ${dead} destroyed · ${alive} remain ≥ 3 — the curve is fully recovered`,
    p_gone: (alive) => `only ${alive} point${alive === 1 ? '' : 's'} left — infinitely many parabolas fit · the message is gone`,
    p_legendShort1: '● GOLD = THE MESSAGE (DRAG UP/DOWN) · ○ WHITE = SPARES',
    p_legendShort2: 'CLICK ANY POINT TO DESTROY / REVIVE',
    p_legendWide: '● GOLD = THE MESSAGE (DRAG UP/DOWN) · ○ WHITE = SPARES · CLICK ANY POINT TO DESTROY / REVIVE',
    // surface (shared by hero + finale)
    s_data: (n) => `DATA — ${n} BYTES (1 CELL = 1 BIT)`,
    s_parity: (n) => `PARITY — ${n} BYTES OF ARMOR (1 CELL = 1 BYTE)`,
    s_dragHint: '⟋ drag to scratch',
    // hero
    h_message: 'UNSCRATCHABLE',
    h_dragMsg: 'drag across the message to scratch it',
    h_healNow: 'heal now',
    h_gouged: (size, worst, budget) => `${size} bytes gouged · worst block ${worst}/${budget}`,
    h_beyond: ' — beyond repair', h_healable: ' — still healable',
    h_miscorrupt: 'the decoder converged on a DIFFERENT valid codeword — silent miscorruption; damage was beyond the guarantee',
    h_healed: (n, blocks, ms) => `healed ${n} bytes across ${blocks} blocks in ${ms} ms`,
    h_blocksLost: (failed, blocks, budget) => `${failed} of ${blocks} blocks over their ${budget}-byte budget — their bytes are gone · reset to start over`,
    // finale
    f_message: 'ATOMS DECAY. THIS WON’T.',
    f_msgAria: 'message to protect', f_saySomething: 'SAY SOMETHING',
    f_parity: 'parity', f_parityFmt: (v) => `${v}B/blk`,
    f_damage: 'damage', f_scratchesKnown: 'scratches (known)', f_silentCorruption: 'silent corruption',
    f_scratchLever: 'scratch, then pull the lever',
    f_silentMode: (budget) => `silent mode: the decoder is told NOTHING about where you strike — budget halves to ${budget}/block`,
    f_damaged: (size, worst, budget, known, over) => `${size} bytes damaged · worst block ${worst}/${budget} ${known ? '' : '(unknown to the decoder!)'} — ${over ? 'past the guarantee' : 'within the guarantee'}`,
    f_miscorrupt: 'the decoder converged on a DIFFERENT valid codeword — silent miscorruption; this is what beyond-budget damage can do',
    f_healedBy: (n, how, ms) => `healed ${n} bytes by ${how} in ${ms} ms`,
    f_erasureDecoding: 'erasure decoding',
    f_errorHunting: 'error hunting (Berlekamp–Massey found every location)',
    f_blocksLost: (failed, blocks, known) => `${failed} of ${blocks} blocks lost — past ${known ? 'the erasure budget' : 'the half-budget for unknown damage'} · reset to start over`,
    f_perBlock: (budget, known) => `PER-BLOCK LOAD vs BUDGET (${budget} bytes ${known ? 'known' : 'unknown'} damage)`,
    f_heal: '⟲ heal',
    f_lost: (load, budget, dead) => `${load}/${budget}${dead ? ' ✕ lost' : ''}`,
  },
  tr: {
    // shared control labels
    noise: 'gürültü', sendAgain: 'yeniden gönder', copies: 'kopya', brush: 'fırça',
    reset: 'sıfırla', brushLevels: ['ince', 'narin', 'geniş', 'acımasız'],
    // channel
    c_sent: 'GÖNDERİLEN', c_recv: 'ALINAN',
    c_perbit: (p) => `p = %${p} BİT BAŞINA`,
    c_stat: (hits, n, prob) => `${n} bitin ${hits} tanesi değişti · temiz varışın olasılığı (1−p)^${n} ≈ %${prob}`,
    // repetition
    r_eachbit: (R) => `HER BİT × ${R}, ALINDIĞI GİBİ`,
    r_majority: 'ÇOĞUNLUK OYU', r_decoded: 'ÇÖZÜLEN',
    r_clean: 'temiz', r_lost: (n) => `${n} bit kayıp`,
    r_stat: (total, n, pct, tail) => `${n} bit anlam için ${total} bit gönderildi · mesaj gönderimlerin %${pct} kadarında sağ kalır · bu gönderim: ${tail}`,
    // cube
    cube_aria: 'üç bitlik dizilerin küpü — ok tuşları döndürür, Enter köşeleri gezer',
    cube_click: 'çözmek için herhangi bir köşeye tıkla',
    cube_showSpheres: 'çözme kürelerini göster', cube_hideSpheres: 'çözme kürelerini gizle',
    cube_isCodeword: (v) => `${v} bir kod sözcüğü — kendisi olarak çözülür`,
    cube_decodesTo: (v, c, d) => `d(${v}, ${c}) = ${d} → ${c} olarak çözülür`,
    cube_legend: 'KOD {000, 111} · KENARLAR = TEK BİT ÇEVİRME · DÖNDÜRMEK İÇİN SÜRÜKLE',
    // venn
    v_click: 'aktarımda çevirmek için herhangi bir bite tıkla',
    v_newMsg: 'yeni mesaj', v_flipRandom: 'rastgele bit çevir', v_repair: 'onar',
    v_nothingRepair: 'onaracak bir şey yok — üç daire de uyumlu',
    v_repaired: (s) => `${s}. konum onarıldı — mesaj sağlam`,
    v_twoHits: 'iki darbe: sendrom masum bir biti işaret etti — sessiz bozulma',
    v_pristine: 'tertemiz — üç daire de uyumlu',
    v_undetectable: (f) => `${f} çevirme her pariteyi götürüyor — tespit edilemez!`,
    v_flipped: (f, s) => `${f} bit çevrildi · kırık daireler ${s}. konumu işaret ediyor${f > 1 ? ' (yanlış — sınır tek çevirmedir)' : ''}`,
    v_parityChecks: 'PARİTE KONTROLLERİ', v_broken: 'KIRIK', v_holds: 'tutuyor',
    v_syndromeHdr: 'SENDROM  (p₄ p₂ p₁)',
    v_allclear: '= 0 · her şey yolunda',
    v_position: (s) => `= ${s} · ${s}. konum`,
    v_sentLine: (sent) => `giden  d₁d₂d₃d₄ = ${sent}`,
    v_readsLine: (dec, ok) => `okunan        ${dec} ${ok ? '✓' : '✗'}`,
    v_narrowSyndrome: (sBits, s) => `SENDROM p₄p₂p₁ = ${sBits}  ${s === 0 ? '· her şey yolunda' : `= ${s} → ${s}. konum`}`,
    v_narrowReads: (sent, dec, ok) => `giden ${sent} · okunan ${dec} ${ok ? '✓' : '✗'}`,
    // interleave
    i_aria: 'çizik konumu — ok tuşları darbeyi iki yerleşimde kaydırır',
    i_scratchWidth: 'çizik genişliği',
    i_seqLoses: (n) => `aynı çizik: sıralı yerleşim ${n} blok kaybeder · harmanlanmış hepsini iyileştirir`,
    i_bothSurvive: 'bu çizik iki yerleşim için de yeterince küçük — genişlet',
    i_bothDrown: (len, B, nsym) => `harmanlama bile boğuluyor: ${B} bloğa yayılan ${len} bayt ${nsym}/blok sınırını aşıyor`,
    i_seqLabel: 'SIRALI — BLOK BLOK ARDINA',
    i_ilLabel: 'HARMANLANMIŞ — SÜTUN SÜTUN',
    i_blk: (b, load, nsym, mark) => `■ blok${b} ${load}/${nsym}${mark}`,
    i_lost: ' ✕', i_ok: ' ✓',
    i_scratch: '⟵ ÇİZİK · sürükle ⟶',
    // polynomial
    p_restore: 'tüm noktaları geri getir',
    p_gf256: (cw) => `GF(256)’da aynı numara: “Hi” = [72 105] → [${cw}] olarak gönderilir — bu 7 baytın herhangi 2 tanesi mesajı yeniden kurar`,
    p_recovered: (dead, alive) => `7 gönderildi · ${dead} yok edildi · ${alive} kaldı ≥ 3 — eğri tamamen kurtarıldı`,
    p_gone: (alive) => `yalnızca ${alive} nokta kaldı — sonsuz sayıda parabol uyar · mesaj gitti`,
    p_legendShort1: '● ALTIN = MESAJ (YUKARI/AŞAĞI SÜRÜKLE) · ○ BEYAZ = YEDEKLER',
    p_legendShort2: 'YOK ETMEK / DİRİLTMEK İÇİN NOKTAYA TIKLA',
    p_legendWide: '● ALTIN = MESAJ (YUKARI/AŞAĞI SÜRÜKLE) · ○ BEYAZ = YEDEKLER · YOK ETMEK / DİRİLTMEK İÇİN NOKTAYA TIKLA',
    // surface (shared by hero + finale)
    s_data: (n) => `VERİ — ${n} BAYT (1 HÜCRE = 1 BİT)`,
    s_parity: (n) => `PARİTE — ${n} BAYT ZIRH (1 HÜCRE = 1 BAYT)`,
    s_dragHint: '⟋ çizmek için sürükle',
    // hero
    h_message: 'UNSCRATCHABLE',
    h_dragMsg: 'çizmek için mesajın üzerinde sürükle',
    h_healNow: 'şimdi iyileştir',
    h_gouged: (size, worst, budget) => `${size} bayt oyuldu · en kötü blok ${worst}/${budget}`,
    h_beyond: ' — onarılamaz', h_healable: ' — hâlâ iyileştirilebilir',
    h_miscorrupt: 'çözücü FARKLI bir geçerli kod sözcüğüne yakınsadı — sessiz yanlış düzeltme; hasar garantinin ötesindeydi',
    h_healed: (n, blocks, ms) => `${n} bayt ${blocks} blok boyunca ${ms} ms’de iyileştirildi`,
    h_blocksLost: (failed, blocks, budget) => `${blocks} bloğun ${failed} tanesi ${budget} baytlık bütçesini aştı — baytları gitti · baştan başlamak için sıfırla`,
    // finale
    f_message: 'ATOMLAR ÇÜRÜR. BU ÇÜRÜMEZ.',
    f_msgAria: 'korunacak mesaj', f_saySomething: 'BİR ŞEY YAZ',
    f_parity: 'parite', f_parityFmt: (v) => `${v}B/blok`,
    f_damage: 'hasar', f_scratchesKnown: 'çizikler (bilinen)', f_silentCorruption: 'sessiz bozulma',
    f_scratchLever: 'çiz, sonra kolu çek',
    f_silentMode: (budget) => `sessiz mod: çözücüye nereye vurduğun hakkında HİÇBİR ŞEY söylenmez — bütçe ${budget}/blok’a yarılanır`,
    f_damaged: (size, worst, budget, known, over) => `${size} bayt hasarlı · en kötü blok ${worst}/${budget} ${known ? '' : '(çözücü bilmiyor!)'} — ${over ? 'garantinin ötesinde' : 'garanti içinde'}`,
    f_miscorrupt: 'çözücü FARKLI bir geçerli kod sözcüğüne yakınsadı — sessiz yanlış düzeltme; bütçe üstü hasarın yapabileceği budur',
    f_healedBy: (n, how, ms) => `${n} bayt ${how} ile ${ms} ms’de iyileştirildi`,
    f_erasureDecoding: 'silinti çözümü',
    f_errorHunting: 'hata avı (Berlekamp–Massey her konumu buldu)',
    f_blocksLost: (failed, blocks, known) => `${blocks} bloğun ${failed} tanesi kayboldu — ${known ? 'silinti bütçesinin' : 'bilinmeyen hasar için yarı bütçenin'} ötesinde · baştan başlamak için sıfırla`,
    f_perBlock: (budget, known) => `BLOK BAŞI YÜK vs BÜTÇE (${budget} bayt ${known ? 'bilinen' : 'bilinmeyen'} hasar)`,
    f_heal: '⟲ iyileştir',
    f_lost: (load, budget, dead) => `${load}/${budget}${dead ? ' ✕ kayıp' : ''}`,
  },
};

export function t(key, ...args) {
  const table = STR[LANG] || STR.en;
  let v = key in table ? table[key] : STR.en[key];
  if (v === undefined) v = key;
  return typeof v === 'function' ? v(...args) : v;
}

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
    this._io = new IntersectionObserver((entries) => {
      for (const en of entries) {
        this.visible = en.isIntersecting;
        if (this.visible) this.#start();
        else this.#stop();
      }
    }, { rootMargin: '80px' });
    this._io.observe(this.canvas);

    this._ro = new ResizeObserver(() => this.#resize());
    this._ro.observe(mount);
    this.#resize();
  }

  // tear down everything this figure owns, so re-instantiating (e.g. on a
  // language switch) does not leak RAF loops or observers onto detached canvases
  destroy() {
    this.#stop();
    this._io?.disconnect();
    this._ro?.disconnect();
    this.canvas.remove();
    this.destroyed = true;
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
