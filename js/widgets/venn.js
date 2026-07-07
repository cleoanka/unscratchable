// Chapter 4 — seven bits, one confession. Hamming(7,4) drawn as the classic
// three-circle Venn diagram: three parity bits each witness four positions,
// and when a bit flips, the pattern of broken circles spells out — in
// binary — the exact position of the culprit.

import { Figure, C, mono, fade, uiBar, button, note, spacer, REDUCED } from './figure.js';
import { encode, decode } from '../hamming.js';
import { mulberry32 } from '../prng.js';

const DATA_POS = [3, 5, 6, 7];
const NAMES = { 1: 'p₁', 2: 'p₂', 3: 'd₁', 4: 'p₄', 5: 'd₂', 6: 'd₃', 7: 'd₄' };

export class Venn extends Figure {
  constructor(mount) {
    super(mount, { aspect: 0.58, minH: 340, maxH: 460 });
    this.rng = mulberry32(0xbadb17);
    this.newMessage(0b1011);

    const bar = uiBar(mount);
    this.info = note(bar, 'click any bit to flip it in transit');
    spacer(bar);
    button(bar, 'new message', () => this.newMessage());
    button(bar, 'flip random bit', () => {
      const p = 1 + Math.floor(this.rng() * 7);
      this.word[p - 1] ^= 1;
      this.#report();
    });
    button(bar, 'repair', () => this.repair(), 'primary');
  }

  newMessage(nibble = Math.floor(this.rng() * 16)) {
    this.nibble = nibble;
    this.sent = encode(nibble);
    this.word = [...this.sent];
    this.info?.set('click any bit to flip it in transit');
  }

  repair() {
    const { syndrome, corrected } = decode(this.word);
    if (syndrome === 0) {
      this.info.set('nothing to repair — all three circles agree', 'heal');
      return;
    }
    this.word = corrected;
    const decoded = decode(this.word).nibble;
    if (decoded === this.nibble) {
      this.info.set(`repaired position ${syndrome} — message intact`, 'heal');
    } else {
      this.info.set('two hits: the syndrome pointed at an innocent bit — silent corruption', 'rust');
    }
  }

  // ---------- geometry ----------
  #geom(w, h) {
    const G = { x: w * 0.40, y: h * 0.52 };
    const R = Math.min(w * 0.30, h * 0.31);
    const off = R * 0.52;
    const centers = {
      1: { x: G.x + off * Math.cos(-2.44), y: G.y + off * Math.sin(-2.44) }, // p1 up-left
      2: { x: G.x + off * Math.cos(-0.70), y: G.y + off * Math.sin(-0.70) }, // p2 up-right
      4: { x: G.x + off * Math.cos(1.57), y: G.y + off * Math.sin(1.57) },   // p4 down
    };
    const labelPos = {};
    for (const p of [1, 2, 4]) {
      const c = centers[p];
      labelPos[p] = { x: c.x + (c.x - G.x) * 1.15, y: c.y + (c.y - G.y) * 1.15 };
    }
    const third = { 3: 4, 5: 2, 6: 1 };
    for (const [pStr, other] of Object.entries(third)) {
      const p = +pStr;
      const members = [1, 2, 4].filter((q) => p & q);
      const mx = (centers[members[0]].x + centers[members[1]].x) / 2;
      const my = (centers[members[0]].y + centers[members[1]].y) / 2;
      labelPos[p] = { x: mx + (mx - centers[other].x) * 0.34, y: my + (my - centers[other].y) * 0.34 };
    }
    labelPos[7] = { x: G.x, y: G.y };
    return { G, R, centers, labelPos };
  }

  #violations() {
    const out = {};
    for (const p of [1, 2, 4]) {
      let parity = 0;
      for (let i = 1; i <= 7; i++) if (i & p) parity ^= this.word[i - 1];
      out[p] = parity === 1;
    }
    return out;
  }

  onDown(x, y) {
    const { R, centers } = this.#geom(this.w, this.h);
    let p = 0;
    for (const q of [1, 2, 4]) {
      if ((x - centers[q].x) ** 2 + (y - centers[q].y) ** 2 <= R * R) p |= q;
    }
    if (p >= 1 && p <= 7) {
      this.word[p - 1] ^= 1;
      this.#report();
    }
  }

  #report() {
    const flips = this.word.filter((b, i) => b !== this.sent[i]).length;
    const { syndrome } = decode(this.word);
    if (flips === 0) this.info.set('pristine — all three circles agree', 'heal');
    else if (syndrome === 0) this.info.set(`${flips} flips that cancel every parity — undetectable!`, 'rust');
    else this.info.set(`${flips} bit${flips > 1 ? 's' : ''} flipped · broken circles point at position ${syndrome}${flips > 1 ? ' (wrongly — one flip is the limit)' : ''}`, flips > 1 ? 'rust' : '');
  }

  draw(ctx, w, h) {
    ctx.fillStyle = C.ink;
    ctx.fillRect(0, 0, w, h);
    const { G, R, centers, labelPos } = this.#geom(w, h);
    const viol = this.#violations();
    const { syndrome, nibble: decoded } = decode(this.word);

    // circles
    for (const p of [1, 2, 4]) {
      const c = centers[p];
      ctx.beginPath();
      ctx.arc(c.x, c.y, R, 0, Math.PI * 2);
      if (viol[p]) {
        ctx.setLineDash([6, 5]);
        ctx.strokeStyle = C.rust;
        ctx.lineWidth = 2;
      } else {
        ctx.setLineDash([]);
        ctx.strokeStyle = fade('#8a8371', 0.5);
        ctx.lineWidth = 1.2;
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth = 1;

      // circle name at outer rim
      const nx = c.x + (c.x - G.x) * 2.6;
      const ny = c.y + (c.y - G.y) * 2.6;
      ctx.font = mono(12);
      ctx.textAlign = 'center';
      ctx.fillStyle = viol[p] ? C.rust : C.faint;
      ctx.fillText(`${NAMES[p]} ${viol[p] ? '✗' : '✓'}`, nx, ny);
    }

    // bits
    for (let p = 1; p <= 7; p++) {
      const pos = labelPos[p];
      const isData = DATA_POS.includes(p);
      const flipped = this.word[p - 1] !== this.sent[p - 1];
      ctx.font = `600 26px ${'ui-monospace, Menlo, monospace'}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = flipped ? C.rust : isData ? C.bright : C.gold;
      ctx.fillText(String(this.word[p - 1]), pos.x, pos.y);
      ctx.font = mono(10);
      ctx.fillStyle = flipped ? fade(C.rust, 0.8) : C.faint;
      ctx.fillText(NAMES[p], pos.x, pos.y + 21);
      ctx.textBaseline = 'alphabetic';

      // culprit pulse
      if (syndrome === p) {
        const r = REDUCED ? 24 : 22 + 3 * Math.sin(this.t * 5);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
        ctx.strokeStyle = fade(C.gold, 0.85);
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.lineWidth = 1;
      }
    }

    // syndrome panel
    const px = w * 0.78;
    let py = h * 0.2;
    ctx.textAlign = 'left';
    ctx.font = mono(10);
    ctx.fillStyle = C.faint;
    ctx.fillText('PARITY CHECKS', px, py);
    py += 22;
    for (const p of [4, 2, 1]) {
      ctx.font = mono(13);
      ctx.fillStyle = viol[p] ? C.rust : C.dim;
      ctx.fillText(`${NAMES[p]}  ${viol[p] ? 'BROKEN' : 'holds'}  →  ${viol[p] ? 1 : 0}`, px, py);
      py += 20;
    }
    py += 8;
    ctx.font = mono(10);
    ctx.fillStyle = C.faint;
    ctx.fillText('SYNDROME  (p₄ p₂ p₁)', px, py);
    py += 24;
    ctx.font = `600 22px ui-monospace, Menlo, monospace`;
    ctx.fillStyle = syndrome === 0 ? C.heal : C.gold;
    const sBits = `${(syndrome >> 2) & 1} ${(syndrome >> 1) & 1} ${syndrome & 1}`;
    ctx.fillText(sBits, px, py);
    py += 22;
    ctx.font = mono(12);
    ctx.fillStyle = syndrome === 0 ? C.heal : C.gold;
    ctx.fillText(syndrome === 0 ? '= 0 · all clear' : `= ${syndrome} · position ${syndrome}`, px, py);

    // sent/decoded readout
    py = h - 40;
    const sentStr = DATA_POS.map((p) => this.sent[p - 1]).join('');
    const decStr = decoded.toString(2).padStart(4, '0');
    ctx.font = mono(12);
    ctx.fillStyle = C.faint;
    ctx.fillText(`sent  d₁d₂d₃d₄ = ${sentStr}`, px, py);
    ctx.fillStyle = decStr === sentStr ? C.heal : C.rust;
    ctx.fillText(`reads          ${decStr} ${decStr === sentStr ? '✓' : '✗'}`, px, py + 18);
  }
}
