// Chapter 5 — the scratch problem. Four RS blocks (10 data + 4 parity bytes
// each) written to the medium two ways: block-after-block, or interleaved
// column-by-column. Drag the scratch; watch who survives. Each block heals
// up to 4 erased bytes — the only question is how many the burst lands on it.

import { Figure, C, mono, fade, uiBar, slider, note, spacer } from './figure.js';

const B = 4;        // blocks
const K = 10;       // data bytes per block
const NSYM = 4;     // parity bytes per block
const N = K + NSYM; // codeword length
const TOTAL = B * N;

export class Interleave extends Figure {
  constructor(mount) {
    super(mount, { aspect: 0.5, minH: 300, maxH: 380 });
    this.burstStart = Math.floor(TOTAL * 0.3);
    this.burstLen = 9;
    this.dragging = false;

    // keyboard path for the primary interaction: arrows slide the scratch
    this.canvas.tabIndex = 0;
    this.canvas.setAttribute('aria-label', 'scratch position — arrow keys slide the burst across both layouts');
    this.canvas.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') this.burstStart -= 2;
      else if (e.key === 'ArrowRight') this.burstStart += 2;
      else return;
      this.#clamp();
      this.#judge();
      e.preventDefault();
    });

    const bar = uiBar(mount);
    this.verdict = note(bar, '');
    spacer(bar);
    slider(bar, {
      label: 'scratch width', min: 2, max: 24, value: 9,
      format: (v) => `${v}B`,
      onInput: (v) => {
        this.burstLen = v;
        this.#clamp();
        this.#judge();
      },
    });
    this.#judge();
  }

  #clamp() {
    this.burstStart = Math.max(0, Math.min(TOTAL - this.burstLen, this.burstStart));
  }

  // damage per block for each layout
  #loads() {
    const seq = new Array(B).fill(0);
    const il = new Array(B).fill(0);
    for (let i = this.burstStart; i < this.burstStart + this.burstLen; i++) {
      seq[Math.floor(i / N)]++;
      il[i % B]++;
    }
    return { seq, il };
  }

  #judge() {
    const { seq, il } = this.#loads();
    const seqDead = seq.filter((v) => v > NSYM).length;
    const ilDead = il.filter((v) => v > NSYM).length;
    if (seqDead && !ilDead) {
      this.verdict.set(`same scratch: sequential loses ${seqDead} block${seqDead > 1 ? 's' : ''} · interleaved heals everything`, 'heal');
    } else if (!seqDead && !ilDead) {
      this.verdict.set('this scratch is small enough for both layouts — widen it', '');
    } else if (ilDead) {
      this.verdict.set(`even interleaving drowns: ${this.burstLen} bytes over ${B} blocks exceeds ${NSYM}/block`, 'rust');
    }
  }

  #layout(w, h) {
    const pad = 18;
    const cs = Math.min(16, (w - pad * 2) / TOTAL);
    const gw = cs * TOTAL;
    const x0 = (w - gw) / 2;
    const y1 = h * 0.3;
    const y2 = h * 0.68;
    return { cs, x0, y1, y2, gw };
  }

  onDown(x) {
    this.dragging = true;
    this.#dragTo(x);
  }
  onMove(x) { if (this.down && this.dragging) this.#dragTo(x); }
  onUp() { this.dragging = false; }

  #dragTo(x) {
    const L = this.#layout(this.w, this.h);
    this.burstStart = Math.round((x - L.x0) / L.cs - this.burstLen / 2);
    this.#clamp();
    this.#judge();
  }

  draw(ctx, w, h) {
    const L = this.#layout(w, h);
    ctx.fillStyle = C.ink;
    ctx.fillRect(0, 0, w, h);
    const { seq, il } = this.#loads();
    const inBurst = (i) => i >= this.burstStart && i < this.burstStart + this.burstLen;

    const strip = (y, label, mapBlock, mapIsParity, loads) => {
      ctx.font = mono(10);
      ctx.textAlign = 'left';
      ctx.fillStyle = C.faint;
      ctx.fillText(label, L.x0, y - 10);

      for (let i = 0; i < TOTAL; i++) {
        const b = mapBlock(i);
        const parity = mapIsParity(i);
        const dead = loads[b] > NSYM;
        const x = L.x0 + i * L.cs;
        const hue = C.blocks[b];
        if (inBurst(i)) {
          ctx.fillStyle = dead ? fade(C.rust, 0.9) : fade(C.rust, 0.55);
        } else {
          ctx.fillStyle = fade(hue, dead ? 0.25 : parity ? 0.38 : 0.85);
        }
        ctx.fillRect(x, y, L.cs - 1, L.cs * 1.7);
        if (parity && !inBurst(i)) {
          ctx.fillStyle = fade('#000000', 0.35);
          ctx.fillRect(x, y + L.cs * 1.7 - 4, L.cs - 1, 4);
        }
        if (dead && !inBurst(i)) {
          ctx.strokeStyle = fade(C.rust, 0.5);
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + L.cs - 1, y + L.cs * 1.7);
          ctx.stroke();
        }
      }

    };

    strip(L.y1, 'SEQUENTIAL — BLOCK AFTER BLOCK', (i) => Math.floor(i / N), (i) => i % N >= K, seq);
    strip(L.y2, 'INTERLEAVED — COLUMN BY COLUMN', (i) => i % B, (i) => Math.floor(i / B) >= K, il);

    // tallies under each strip — wrap onto extra rows at narrow widths
    const tally = (y, loads) => {
      ctx.font = mono(11);
      ctx.textAlign = 'left';
      let tx = L.x0;
      let ty = y;
      for (let b = 0; b < B; b++) {
        const over = loads[b] > NSYM;
        const s = `■ blk${b} ${loads[b]}/${NSYM}${over ? ' ✕' : loads[b] > 0 ? ' ✓' : ''}`;
        const sw = ctx.measureText(s).width + 26;
        if (tx > L.x0 && tx + sw > w - 12) {
          tx = L.x0;
          ty += 15;
        }
        ctx.fillStyle = fade(C.blocks[b], 0.9);
        ctx.fillText('■', tx, ty);
        ctx.fillStyle = over ? C.rust : loads[b] > 0 ? C.heal : C.faint;
        ctx.fillText(s.slice(2), tx + 14, ty);
        tx += sw;
      }
    };
    tally(L.y1 + L.cs * 1.7 + 20, seq);
    tally(L.y2 + L.cs * 1.7 + 20, il);

    // the scratch itself, spanning both strips
    const sx = L.x0 + this.burstStart * L.cs;
    const swidth = this.burstLen * L.cs;
    const overlayH = L.y2 - L.y1 + L.cs * 1.7 + 26 + 6;
    ctx.fillStyle = fade(C.rust, 0.09);
    ctx.fillRect(sx, L.y1 - 26, swidth, overlayH);
    ctx.strokeStyle = fade(C.rust, 0.6);
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(sx, L.y1 - 26, swidth, overlayH);
    ctx.setLineDash([]);
    ctx.font = mono(10);
    ctx.textAlign = 'center';
    ctx.fillStyle = C.rust;
    ctx.fillText('⟵ SCRATCH · drag ⟶', sx + swidth / 2, L.y1 - 32);
  }
}
