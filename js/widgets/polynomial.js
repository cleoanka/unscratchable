// Chapter 6 — any k points. Three gold points ARE the message; they pin
// down one parabola. Sampling it at seven places mails four spare points
// along for free. Click transmitted points to destroy them: any three
// survivors rebuild the same curve exactly. Fewer, and the curve dissolves
// into a fan of maybes.

import { Figure, C, mono, fade, uiBar, button, note, spacer } from './figure.js';
import { RS } from '../rs.js';
import { mulberry32 } from '../prng.js';

const XS = [1, 2, 3, 4, 5, 6, 7];
const K = 3;

export class Polynomial extends Figure {
  constructor(mount) {
    super(mount, { aspect: 0.55, minH: 320, maxH: 430 });
    // the message: y-values at x = 1, 2, 3 — chosen so the whole parabola,
    // including the spare samples out to x = 7, stays comfortably on screen
    this.msgY = [3, 4.5, 5.5];
    this.dead = new Set();
    this.dragIdx = -1;
    this.rng = mulberry32(0x900d);

    const bar = uiBar(mount);
    this.info = note(bar, '');
    spacer(bar);
    button(bar, 'restore all points', () => {
      this.dead.clear();
      this.#report();
    });

    // the same trick with real bytes, computed by the same decoder that
    // heals the hero (nsym=5 parity symbols on a 2-byte message)
    const rs = new RS(5);
    const cw = rs.encode([72, 105]); // "Hi"
    const bytesLine = note(uiBar(mount), '');
    bytesLine.set(`same trick in GF(256): “Hi” = [72 105] → sent as [${[...cw].join(' ')}] — any 2 of these 7 bytes rebuild the message`);
    this.#report();
  }

  // polynomial through the three message points (Lagrange), evaluated at x
  #curve(x, ys = this.msgY) {
    const xs = [1, 2, 3];
    let y = 0;
    for (let i = 0; i < 3; i++) {
      let L = 1;
      for (let j = 0; j < 3; j++) {
        if (j !== i) L *= (x - xs[j]) / (xs[i] - xs[j]);
      }
      y += ys[i] * L;
    }
    return y;
  }

  // rebuild from the first three surviving transmitted points
  #survivors() {
    return XS.filter((x) => !this.dead.has(x));
  }

  #fit(x, pts) {
    let y = 0;
    for (let i = 0; i < pts.length; i++) {
      let L = 1;
      for (let j = 0; j < pts.length; j++) {
        if (j !== i) L *= (x - pts[j][0]) / (pts[i][0] - pts[j][0]);
      }
      y += pts[i][1] * L;
    }
    return y;
  }

  #report() {
    const alive = this.#survivors().length;
    if (alive >= K) {
      this.info.set(`7 sent · ${this.dead.size} destroyed · ${alive} remain ≥ 3 — the curve is fully recovered`, this.dead.size ? 'heal' : '');
    } else {
      this.info.set(`only ${alive} point${alive === 1 ? '' : 's'} left — infinitely many parabolas fit · the message is gone`, 'rust');
    }
  }

  // ---------- mapping ----------
  #map(w, h) {
    const x0 = 54, x1 = w - 24, y0 = h - 46, y1 = 26;
    const X = (x) => x0 + ((x - 0) / 8) * (x1 - x0);
    const Y = (y) => y0 - ((y + 2) / 12) * (y0 - y1);
    const Yinv = (py) => ((y0 - py) / (y0 - y1)) * 12 - 2;
    return { X, Y, Yinv, x0, x1, y0, y1 };
  }

  onDown(x, y) {
    const M = this.#map(this.w, this.h);
    this.moved = false;
    this.downAt = { x, y };
    // a message point under the cursor arms BOTH a drag and a click-to-kill;
    // onUp decides which one it was
    for (let i = 0; i < 3; i++) {
      const px = M.X(i + 1), py = M.Y(this.msgY[i]);
      if ((px - x) ** 2 + (py - y) ** 2 < 14 ** 2 && !this.dead.has(i + 1)) {
        this.dragIdx = i;
        return;
      }
    }
    for (const sx of XS) {
      const px = M.X(sx), py = M.Y(this.#curve(sx));
      if ((px - x) ** 2 + (py - y) ** 2 < 13 ** 2) {
        if (this.dead.has(sx)) this.dead.delete(sx);
        else this.dead.add(sx);
        this.#report();
        return;
      }
    }
  }

  onMove(x, y) {
    if (!this.down) return;
    if (Math.hypot(x - this.downAt.x, y - this.downAt.y) > 4) this.moved = true;
    if (this.dragIdx >= 0 && this.moved) {
      const M = this.#map(this.w, this.h);
      this.msgY[this.dragIdx] = Math.max(-1.5, Math.min(9.5, Math.round(M.Yinv(y) * 2) / 2));
    }
  }

  onUp() {
    if (this.dragIdx >= 0 && !this.moved) {
      // it was a click, not a drag: destroy this message point too
      this.dead.add(this.dragIdx + 1);
      this.#report();
    }
    this.dragIdx = -1;
  }

  draw(ctx, w, h) {
    const M = this.#map(w, h);
    ctx.fillStyle = C.ink;
    ctx.fillRect(0, 0, w, h);

    // axes + grid
    ctx.strokeStyle = fade('#8a8371', 0.12);
    ctx.beginPath();
    for (let gx = 0; gx <= 8; gx++) { ctx.moveTo(M.X(gx), M.y1); ctx.lineTo(M.X(gx), M.y0); }
    for (let gy = -2; gy <= 10; gy += 2) { ctx.moveTo(M.x0, M.Y(gy)); ctx.lineTo(M.x1, M.Y(gy)); }
    ctx.stroke();
    ctx.strokeStyle = fade('#8a8371', 0.35);
    ctx.beginPath();
    ctx.moveTo(M.x0, M.Y(0)); ctx.lineTo(M.x1, M.Y(0));
    ctx.stroke();

    const alive = this.#survivors();

    if (alive.length >= K) {
      // recovered curve from the three lowest surviving x's — identical to
      // the original by construction; draw it thick in heal green
      const pts = alive.slice(0, 3).map((x) => [x, this.#curve(x)]);
      ctx.beginPath();
      for (let px = 0; px <= 8; px += 0.08) {
        const py = this.#fit(px, pts);
        if (px === 0) ctx.moveTo(M.X(px), M.Y(py));
        else ctx.lineTo(M.X(px), M.Y(py));
      }
      ctx.strokeStyle = this.dead.size ? fade(C.heal, 0.9) : fade(C.gold, 0.75);
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.lineWidth = 1;
    } else {
      // ambiguity fan: many parabolas through the survivors
      const survivors = alive.map((x) => [x, this.#curve(x)]);
      for (let t = 0; t < 24; t++) {
        const fake = [...survivors];
        while (fake.length < 3) {
          fake.push([this.rng() * 8, this.rng() * 11 - 1.5]);
        }
        ctx.beginPath();
        for (let px = 0; px <= 8; px += 0.12) {
          const py = this.#fit(px, fake);
          if (px === 0) ctx.moveTo(M.X(px), M.Y(py));
          else ctx.lineTo(M.X(px), M.Y(py));
        }
        ctx.strokeStyle = fade(C.rust, 0.12);
        ctx.stroke();
      }
    }

    // transmitted points
    for (const sx of XS) {
      const px = M.X(sx), py = M.Y(this.#curve(sx));
      const dead = this.dead.has(sx);
      const isMsg = sx <= 3;
      if (dead) {
        ctx.strokeStyle = fade(C.rust, 0.8);
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(px - 6, py - 6); ctx.lineTo(px + 6, py + 6);
        ctx.moveTo(px + 6, py - 6); ctx.lineTo(px - 6, py + 6);
        ctx.stroke();
        ctx.lineWidth = 1;
      } else {
        ctx.beginPath();
        ctx.arc(px, py, isMsg ? 8 : 6, 0, Math.PI * 2);
        ctx.fillStyle = isMsg ? C.gold : fade(C.text, 0.9);
        ctx.fill();
        if (isMsg) {
          ctx.strokeStyle = fade(C.gold, 0.5);
          ctx.beginPath();
          ctx.arc(px, py, 12, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.font = mono(10);
      ctx.textAlign = 'center';
      ctx.fillStyle = dead ? C.rust : C.faint;
      ctx.fillText(`x=${sx}`, px, M.y0 + 16);
    }

    ctx.font = mono(10);
    ctx.textAlign = 'left';
    ctx.fillStyle = C.faint;
    ctx.fillText('● GOLD = THE MESSAGE (DRAG UP/DOWN) · ○ WHITE = SPARES · CLICK ANY POINT TO DESTROY / REVIVE', M.x0, 16);
  }
}
