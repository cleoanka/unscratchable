// Chapter 2 — say everything three times. The obvious defense: send each
// bit R times, take a majority vote. It works — at a brutal price — and a
// two-hit strike still gets through. Click any copy to flip it by hand.

import { Figure, C, mono, fade, uiBar, slider, segmented, button, note, spacer, reducedMotion } from './figure.js';
import { mulberry32 } from '../prng.js';

const WORD = 'HI';

export class Repetition extends Figure {
  constructor(mount) {
    super(mount, { aspect: 0.42, minH: 280, maxH: 340, touch: 'tap' });
    this.bytes = [...WORD].map((c) => c.charCodeAt(0));
    this.nBits = this.bytes.length * 8;
    this.R = 3;
    this.p = 0.08;
    this.seed = 100;
    this.flips = [];
    this.lastRoll = 0;

    const bar = uiBar(mount);
    this.stat = note(bar, '');
    spacer(bar);
    segmented(bar, {
      label: 'copies',
      options: [{ label: '1×', value: 1 }, { label: '3×', value: 3 }, { label: '5×', value: 5 }],
      value: 3,
      onChange: (v) => { this.R = v; this.roll(); },
    });
    slider(bar, {
      label: 'noise', min: 0, max: 25, step: 0.5, value: 8,
      format: (v) => `${v}%`,
      onInput: (v) => { this.p = v / 100; this.roll(); },
    });
    button(bar, 'send again', () => this.roll());
    this.roll();
  }

  sentBit(i) { return (this.bytes[i >> 3] >> (7 - (i & 7))) & 1; }

  roll() {
    const rng = mulberry32(this.seed++);
    this.flips = Array.from({ length: this.nBits }, () =>
      Array.from({ length: this.R }, () => rng() < this.p));
    this.#stat();
  }

  votedBit(i) {
    const sent = this.sentBit(i);
    let ones = 0;
    for (let r = 0; r < this.R; r++) ones += this.flips[i][r] ? sent ^ 1 : sent;
    return ones > this.R / 2 ? 1 : 0;
  }

  #stat() {
    // analytic: chance a single bit's majority vote fails, then whole message
    const { R, p } = this;
    let q = 0;
    for (let k = Math.floor(R / 2) + 1; k <= R; k++) q += binom(R, k) * p ** k * (1 - p) ** (R - k);
    const survive = Math.pow(1 - q, this.nBits);
    const lost = Array.from({ length: this.nBits }, (_, i) => i).filter((i) => this.votedBit(i) !== this.sentBit(i)).length;
    this.stat.set(
      `${R * this.nBits} bits sent for ${this.nBits} bits of meaning · message survives ${(survive * 100).toFixed(survive > 0.995 ? 1 : 0)}% of sends · this send: ${lost === 0 ? 'clean' : `${lost} bit${lost > 1 ? 's' : ''} lost`}`,
      lost === 0 ? 'heal' : 'rust',
    );
  }

  #layout(w, h) {
    const gw = Math.min(40, (w - 130) / this.nBits);
    const x0 = (w - gw * this.nBits - 76) / 2;
    const cell = Math.min(13, gw * 0.52);
    const gap = Math.min(19, (h - 46 - 110) / 5);
    const contentH = this.R * gap + 26 + gap + 40; // copies + spacer + voted row
    const top = Math.max(46, (h - contentH) / 2);
    const votedY = top + this.R * gap + 26 + gap;
    return { gw, x0, cell, top, gap, votedY };
  }

  onDown(x, y) {
    const L = this.#layout(this.w, this.h);
    const col = Math.floor((x - L.x0) / L.gw);
    if (col < 0 || col >= this.nBits) return;
    const row = Math.floor((y - L.top) / L.gap);
    if (row < 0 || row >= this.R) return;
    this.flips[col][row] = !this.flips[col][row];
    this.#stat();
  }

  update() {
    if (!reducedMotion() && this.t - this.lastRoll > 3.6) {
      this.lastRoll = this.t;
      this.roll();
    }
  }

  draw(ctx, w, h) {
    const L = this.#layout(w, h);
    ctx.fillStyle = C.ink;
    ctx.fillRect(0, 0, w, h);

    ctx.font = mono(10);
    ctx.textAlign = 'left';
    ctx.fillStyle = C.faint;
    ctx.fillText(`EACH BIT × ${this.R}, AS RECEIVED`, L.x0, 26);
    ctx.fillText('MAJORITY VOTE', L.x0, L.votedY - 13);

    for (let i = 0; i < this.nBits; i++) {
      const cx = L.x0 + i * L.gw + L.gw / 2;
      const sent = this.sentBit(i);
      for (let r = 0; r < this.R; r++) {
        const y = L.top + r * L.gap + L.gap / 2;
        const flipped = this.flips[i][r];
        const bit = flipped ? sent ^ 1 : sent;
        const s = L.cell;
        if (flipped) {
          ctx.fillStyle = fade(C.rust, bit ? 0.9 : 0.28);
          ctx.fillRect(cx - s / 2, y - s / 2, s, s);
        } else if (bit) {
          ctx.fillStyle = C.text;
          ctx.fillRect(cx - s / 2, y - s / 2, s, s);
        } else {
          ctx.strokeStyle = C.edge;
          ctx.strokeRect(cx - s / 2 + 0.5, y - s / 2 + 0.5, s - 1, s - 1);
        }
      }
      // voted result
      const v = this.votedBit(i);
      const wrong = v !== sent;
      const s = L.cell + 3;
      const y = L.votedY;
      if (v) {
        ctx.fillStyle = wrong ? C.rust : C.heal;
        ctx.fillRect(cx - s / 2, y - s / 2, s, s);
      } else {
        ctx.strokeStyle = wrong ? C.rust : fade(C.heal, 0.7);
        ctx.lineWidth = wrong ? 2 : 1;
        ctx.strokeRect(cx - s / 2 + 0.5, y - s / 2 + 0.5, s - 1, s - 1);
        ctx.lineWidth = 1;
      }
      if (wrong) {
        ctx.font = mono(11);
        ctx.textAlign = 'center';
        ctx.fillStyle = C.rust;
        ctx.fillText('✕', cx, y + s + 12);
      }
    }

    // decoded word at right
    let out = '';
    for (let c = 0; c < this.bytes.length; c++) {
      let v = 0;
      for (let b = 0; b < 8; b++) v = (v << 1) | this.votedBit(c * 8 + b);
      out += v >= 32 && v < 127 ? String.fromCharCode(v) : '□';
    }
    const ok = out === WORD;
    ctx.font = '500 34px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = ok ? C.bright : C.rust;
    ctx.fillText(out, L.x0 + this.nBits * L.gw + 26, L.votedY + 10);
    ctx.font = mono(10);
    ctx.fillStyle = C.faint;
    ctx.fillText('DECODED', L.x0 + this.nBits * L.gw + 26, L.votedY - 26);
  }
}

function binom(n, k) {
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  return r;
}
