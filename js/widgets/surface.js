// StorageSurface — the shared chassis of chapter 0 (hero) and chapter 7
// (finale). The canvas is a literal view of storage: the message lives as a
// 1-bit bitmap packed into bytes, those bytes plus Reed–Solomon parity form
// the `stored` payload, and every cell on screen is drawn FROM stored bytes.
// The brush overwrites real payload bytes with garbage; healing runs the
// real interleaved RS decoder. Nothing is faked.

import { Figure, C, mono, fade, textBitmap, REDUCED } from './figure.js';
import { shield, unshield } from '../codec.js';
import { mulberry32 } from '../prng.js';

export class StorageSurface extends Figure {
  constructor(mount, {
    cols = 128, rows = 40, nsym = 64, message = 'UNSCRATCHABLE',
    autoHeal = true, aspect = 0.5, minH = 320, maxH = 470,
  } = {}) {
    super(mount, { aspect, minH, maxH });
    this.cols = cols;
    this.rows = rows;
    this.rng = mulberry32(0xc0ffee);
    this.autoHeal = autoHeal;
    this.brushCells = 2;
    this.knownDamage = true; // erasure mode; finale can flip to silent errors
    this.touched = false;
    this.rebuild(message, nsym);
  }

  // (re)encode a message into the surface
  rebuild(message, nsym) {
    this.message = message;
    this.nsym = nsym;
    const bits = textBitmap(message, this.cols, this.rows);
    const data = new Uint8Array((this.cols * this.rows) / 8);
    for (let i = 0; i < bits.length; i++) {
      if (bits[i]) data[i >> 3] |= 0x80 >> (i & 7);
    }
    const { payload, meta } = shield(data, { nsym });
    this.clean = payload;
    this.meta = meta;
    this.dataBytes = meta.blockCount * meta.blockDataLen;
    this.parityBytes = payload.length - this.dataBytes;

    this.stored = Uint8Array.from(payload);
    this.erased = new Set();   // brush-tracked damage (payload indices)
    this.flash = new Map();
    this.failedBlocks = new Set();
    this.healing = null;
    this.autoHealAt = null;
    this.decodeMs = null;
    this.lastStatic = 0;
    this.lastResult = null;
    this.onDamageChange?.();
  }

  // per-block budget: full nsym when damage locations are known (erasures),
  // half when the decoder must find them too (errors)
  budget() { return this.knownDamage ? this.nsym : Math.floor(this.nsym / 2); }

  // ---------- geometry ----------
  layout(w, h) {
    const pad = 16;
    const labelH = 18;
    const gap = 26;
    const parityRows = Math.ceil(this.parityBytes / this.cols);
    const extra = this.extraCanvasH?.() ?? 0;
    const cs = Math.max(2, Math.min(
      (w - pad * 2) / this.cols,
      (h - pad * 2 - gap - labelH * 2 - extra) / (this.rows + parityRows),
    ));
    const gw = cs * this.cols;
    const gx = (w - gw) / 2;
    const contentH = labelH * 2 + this.rows * cs + gap + parityRows * cs + extra;
    const gy = pad + labelH + Math.max(0, (h - pad * 2 - contentH) / 2);
    const py = gy + this.rows * cs + gap;
    return { cs, gx, gy, py, parityRows, gw };
  }

  cellToPayload(x, y, L) {
    const cx = Math.floor((x - L.gx) / L.cs);
    if (cx < 0 || cx >= this.cols) return -1;
    const dy = Math.floor((y - L.gy) / L.cs);
    if (dy >= 0 && dy < this.rows) return (dy * this.cols + cx) >> 3;
    const pr = Math.floor((y - L.py) / L.cs);
    if (pr >= 0 && pr < L.parityRows) {
      const p = this.dataBytes + pr * this.cols + cx;
      return p < this.stored.length ? p : -1;
    }
    return -1;
  }

  // ---------- damage ----------
  scratch(x, y) {
    const L = this.layout(this.w, this.h);
    const r = this.brushCells * L.cs;
    let changed = false;
    for (let dx = -r; dx <= r; dx += L.cs / 1.5) {
      for (let dy = -r; dy <= r; dy += L.cs / 1.5) {
        if (dx * dx + dy * dy > r * r) continue;
        const p = this.cellToPayload(x + dx, y + dy, L);
        if (p >= 0 && !this.erased.has(p)) {
          this.erased.add(p);
          this.stored[p] = Math.floor(this.rng() * 256);
          changed = true;
        }
      }
    }
    if (changed) {
      this.failedBlocks.clear();
      this.lastResult = null;
      this.onDamageChange?.();
    }
  }

  perBlockLoad() {
    const B = this.meta.blockCount;
    const load = new Array(B).fill(0);
    for (const p of this.erased) load[p % B]++;
    return load;
  }

  // ---------- healing ----------
  heal() {
    if (this.erased.size === 0 || this.healing) return;
    this.autoHealAt = null;
    const erasures = this.knownDamage ? [...this.erased] : [];
    const t0 = performance.now();
    const res = unshield(this.stored, this.meta, erasures);
    this.decodeMs = performance.now() - t0;
    this.lastResult = res;

    this.failedBlocks = new Set(res.perBlock.map((b, i) => (b.ok ? -1 : i)).filter((i) => i >= 0));
    const healed = res.ok ? this.clean : this.#partial();

    const L = this.layout(this.w, this.h);
    const order = [...this.erased].sort((a, b) => this.#byteX(a, L) - this.#byteX(b, L));
    this.healing = { start: this.t, order, healed, ok: res.ok, done: 0, doneSet: new Set() };
  }

  #partial() {
    const out = Uint8Array.from(this.stored);
    for (let p = 0; p < out.length; p++) {
      if (!this.failedBlocks.has(p % this.meta.blockCount)) out[p] = this.clean[p];
    }
    return out;
  }

  #byteX(p, L) {
    if (p < this.dataBytes) return ((p * 8) % this.cols) * L.cs;
    return ((p - this.dataBytes) % this.cols) * L.cs;
  }

  reset() {
    this.stored = Uint8Array.from(this.clean);
    this.erased.clear();
    this.flash.clear();
    this.failedBlocks.clear();
    this.healing = null;
    this.decodeMs = null;
    this.lastResult = null;
    this.onDamageChange?.();
  }

  // ---------- interaction ----------
  onDown(x, y) {
    this.touched = true;
    this.healing = null;
    this.scratch(x, y);
  }
  onMove(x, y) {
    if (this.down) {
      this.scratch(x, y);
      this.autoHealAt = null;
    }
  }
  onUp() {
    if (this.autoHeal && this.erased.size > 0) this.autoHealAt = this.t + 1.4;
  }

  // ---------- animation ----------
  update() {
    if (this.autoHealAt !== null && this.t >= this.autoHealAt) {
      this.autoHealAt = null;
      this.heal();
    }
    if (!REDUCED && this.t - this.lastStatic > 0.12) {
      this.lastStatic = this.t;
      for (const p of this.erased) {
        if (!this.healing?.doneSet.has(p)) this.stored[p] = Math.floor(this.rng() * 256);
      }
    }
    if (this.healing) {
      const hz = this.healing;
      const T = REDUCED ? 0 : 0.9;
      const frac = T === 0 ? 1 : Math.min(1, (this.t - hz.start) / T);
      const target = Math.floor(frac * hz.order.length);
      while (hz.done < target) {
        const p = hz.order[hz.done++];
        this.stored[p] = hz.healed[p];
        hz.doneSet.add(p);
        if (!this.failedBlocks.has(p % this.meta.blockCount)) this.flash.set(p, this.t);
        this.erased.delete(p);
      }
      if (frac >= 1) {
        // flush any remainder (guards against float edge at frac→1)
        while (hz.done < hz.order.length) {
          const p = hz.order[hz.done++];
          this.stored[p] = hz.healed[p];
          this.erased.delete(p);
        }
        this.healing = null;
        this.onHealed?.(hz.ok, hz.order.length);
      }
    }
    for (const [p, t0] of this.flash) if (this.t - t0 > 0.6) this.flash.delete(p);
  }

  // ---------- drawing ----------
  draw(ctx, w, h) {
    const L = this.layout(w, h);
    ctx.fillStyle = C.ink;
    ctx.fillRect(0, 0, w, h);

    ctx.font = mono(10);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = C.faint;
    ctx.fillText(`DATA — ${this.dataBytes} BYTES (1 CELL = 1 BIT)`, L.gx, L.gy - 7);
    ctx.fillText(`PARITY — ${this.parityBytes} BYTES OF ARMOR (1 CELL = 1 BYTE)`, L.gx, L.py - 7);

    const cs = L.cs;
    for (let cy = 0; cy < this.rows; cy++) {
      for (let cx = 0; cx < this.cols; cx++) {
        const bitIdx = cy * this.cols + cx;
        const p = bitIdx >> 3;
        const bit = (this.stored[p] >> (7 - (bitIdx & 7))) & 1;
        const x = L.gx + cx * cs;
        const y = L.gy + cy * cs;
        if (this.erased.has(p)) {
          ctx.fillStyle = bit ? fade(C.rust, 0.85) : fade(C.rust, 0.16);
          ctx.fillRect(x, y, cs - 0.5, cs - 0.5);
        } else {
          const wrecked = this.failedBlocks.has(p % this.meta.blockCount) && this.stored[p] !== this.clean[p];
          if (bit) {
            ctx.fillStyle = wrecked ? fade(C.rust, 0.6) : C.bright;
            ctx.fillRect(x, y, cs - 0.5, cs - 0.5);
          } else if (wrecked) {
            ctx.fillStyle = fade(C.rust, 0.08);
            ctx.fillRect(x, y, cs - 0.5, cs - 0.5);
          }
        }
        const f = this.flash.get(p);
        if (f !== undefined) {
          ctx.fillStyle = fade(C.heal, 0.55 * (1 - (this.t - f) / 0.6));
          ctx.fillRect(x, y, cs - 0.5, cs - 0.5);
        }
      }
    }

    for (let i = 0; i < this.parityBytes; i++) {
      const p = this.dataBytes + i;
      const x = L.gx + (i % this.cols) * cs;
      const y = L.py + Math.floor(i / this.cols) * cs;
      ctx.fillStyle = this.erased.has(p)
        ? fade(C.rust, 0.55)
        : fade(C.gold, 0.10 + (this.stored[p] / 255) * 0.38);
      ctx.fillRect(x, y, cs - 0.5, cs - 0.5);
      const f = this.flash.get(p);
      if (f !== undefined) {
        ctx.fillStyle = fade(C.heal, 0.55 * (1 - (this.t - f) / 0.6));
        ctx.fillRect(x, y, cs - 0.5, cs - 0.5);
      }
    }

    this.drawExtra?.(ctx, w, h, L);

    if (!this.touched) {
      const pulse = REDUCED ? 0.75 : 0.55 + 0.3 * Math.sin(this.t * 2.2);
      ctx.font = mono(11);
      ctx.textAlign = 'right';
      ctx.fillStyle = fade(C.gold, pulse);
      ctx.fillText('⟋ drag to scratch', w - 18, 20);
    }
  }
}
