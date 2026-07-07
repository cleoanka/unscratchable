// Chapter 1 — a world that flips bits. A five-letter word crosses a noisy
// channel; every bit survives only with probability 1−p. Click any bit to
// flip it yourself, or let the channel keep rolling.

import { Figure, C, mono, fade, uiBar, slider, button, note, spacer, reducedMotion } from './figure.js';
import { mulberry32 } from '../prng.js';

const WORD = 'HELLO';

export class Channel extends Figure {
  constructor(mount) {
    super(mount, { aspect: 0.42, minH: 260, maxH: 330, touch: 'tap' });
    this.bytes = [...WORD].map((c) => c.charCodeAt(0));
    this.nBits = this.bytes.length * 8;
    this.flips = new Array(this.nBits).fill(false);
    this.flipAge = new Array(this.nBits).fill(-9);
    this.p = 0.04;
    this.seed = 1;
    this.lastRoll = 0;

    const bar = uiBar(mount);
    this.stat = note(bar, '');
    spacer(bar);
    slider(bar, {
      label: 'noise', min: 0, max: 20, step: 0.5, value: 4,
      format: (v) => `${v}%`,
      onInput: (v) => { this.p = v / 100; this.roll(); },
    });
    button(bar, 'send again', () => this.roll());
    this.roll();
  }

  roll() {
    const rng = mulberry32(this.seed++);
    for (let i = 0; i < this.nBits; i++) {
      const was = this.flips[i];
      this.flips[i] = rng() < this.p;
      if (this.flips[i] !== was) this.flipAge[i] = this.t;
    }
    this.#stat();
  }

  #stat() {
    const intact = Math.pow(1 - this.p, this.nBits);
    const hits = this.flips.filter(Boolean).length;
    this.stat.set(
      `${hits} of ${this.nBits} bits flipped · a clean arrival has probability (1−p)^${this.nBits} ≈ ${(intact * 100).toFixed(intact > 0.1 ? 0 : 1)}%`,
      hits === 0 ? 'heal' : '',
    );
  }

  #layout(w, h) {
    const cw = Math.min(86, (w - 40) / this.bytes.length);
    const x0 = (w - cw * this.bytes.length) / 2;
    const cell = Math.min(15, cw * 0.2);
    const bitsTop = 74;
    const bitsGap = Math.min(19, (h - bitsTop - 84) / 8);
    return { cw, x0, cell, bitsTop, bitsGap };
  }

  onDown(x, y) {
    const L = this.#layout(this.w, this.h);
    const col = Math.floor((x - L.x0) / L.cw);
    if (col < 0 || col >= this.bytes.length) return;
    const row = Math.floor((y - L.bitsTop) / L.bitsGap);
    if (row < 0 || row > 7) return;
    const i = col * 8 + row;
    this.flips[i] = !this.flips[i];
    this.flipAge[i] = this.t;
    this.#stat();
  }

  update() {
    if (!reducedMotion() && this.t - this.lastRoll > 3.2) {
      this.lastRoll = this.t;
      this.roll();
    }
  }

  draw(ctx, w, h) {
    const L = this.#layout(w, h);
    ctx.fillStyle = C.ink;
    ctx.fillRect(0, 0, w, h);

    ctx.textAlign = 'left';
    ctx.font = mono(10);
    ctx.fillStyle = C.faint;
    ctx.fillText('SENT', L.x0, 24);
    ctx.fillText('RECEIVED', L.x0, h - 34);
    // noise field density hint
    ctx.textAlign = 'right';
    ctx.fillText(`p = ${(this.p * 100).toFixed(1)}% PER BIT`, L.x0 + L.cw * this.bytes.length, 24);

    for (let c = 0; c < this.bytes.length; c++) {
      const cx = L.x0 + c * L.cw + L.cw / 2;
      // sent char
      ctx.font = `500 30px ${'Georgia, serif'}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = C.bright;
      ctx.fillText(WORD[c], cx, 52);

      // bits, MSB at top, shown as-received
      let recv = 0;
      for (let b = 0; b < 8; b++) {
        const i = c * 8 + b;
        const sentBit = (this.bytes[c] >> (7 - b)) & 1;
        const bit = this.flips[i] ? sentBit ^ 1 : sentBit;
        recv = (recv << 1) | bit;
        const y = L.bitsTop + b * L.bitsGap + L.bitsGap / 2;
        const s = L.cell;
        const age = this.t - this.flipAge[i];
        if (this.flips[i]) {
          ctx.fillStyle = age < 0.4 ? fade(C.rust, 0.6 + 0.4 * (1 - age / 0.4)) : fade(C.rust, 0.9);
          ctx.fillRect(cx - s / 2, y - s / 2, s, s);
          ctx.strokeStyle = C.rust;
          ctx.lineWidth = 1;
          const k = s * 0.26;
          ctx.beginPath();
          ctx.moveTo(cx - k, y - k); ctx.lineTo(cx + k, y + k);
          ctx.moveTo(cx + k, y - k); ctx.lineTo(cx - k, y + k);
          ctx.stroke();
        } else if (bit) {
          ctx.fillStyle = C.text;
          ctx.fillRect(cx - s / 2, y - s / 2, s, s);
        } else {
          ctx.strokeStyle = C.edge;
          ctx.lineWidth = 1;
          ctx.strokeRect(cx - s / 2 + 0.5, y - s / 2 + 0.5, s - 1, s - 1);
        }
      }

      // received char
      const changed = recv !== this.bytes[c];
      const glyph = recv >= 32 && recv < 127 ? String.fromCharCode(recv) : '□';
      ctx.font = `500 30px Georgia, serif`;
      ctx.fillStyle = changed ? C.rust : C.bright;
      ctx.fillText(glyph, cx, h - 44 + 34);
    }
  }
}
