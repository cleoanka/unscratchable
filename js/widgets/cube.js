// Chapter 3 — distance is safety. The eight 3-bit strings form a cube whose
// edges are single bit-flips. With codewords 000 and 111, every corner sits
// within distance 1 of exactly one codeword: two decoding spheres tile the
// whole space. Drag to rotate; click a corner to watch it decode.

import { Figure, C, mono, fade, uiBar, button, note, spacer, reducedMotion } from './figure.js';

const CODEWORDS = [0b000, 0b111];

export class Cube extends Figure {
  constructor(mount) {
    super(mount, { aspect: 0.62, minH: 320, maxH: 430 });
    this.yaw = 0.7;
    this.pitch = -0.42;
    this.spheres = false;
    this.selected = null;
    this.dragging = false;
    this.idle = 0;

    // keyboard path: arrows rotate, Enter cycles through the corners
    this.canvas.tabIndex = 0;
    this.canvas.setAttribute('aria-label', 'cube of 3-bit strings — arrow keys rotate, Enter steps through corners');
    this.canvas.addEventListener('keydown', (e) => {
      const step = 0.15;
      if (e.key === 'ArrowLeft') this.yaw -= step;
      else if (e.key === 'ArrowRight') this.yaw += step;
      else if (e.key === 'ArrowUp') this.pitch = Math.max(-1.2, this.pitch - step);
      else if (e.key === 'ArrowDown') this.pitch = Math.min(1.2, this.pitch + step);
      else if (e.key === 'Enter') this.selectCorner(((this.selected ?? -1) + 1) % 8);
      else return;
      this.idle = 0;
      e.preventDefault();
    });

    const bar = uiBar(mount);
    this.info = note(bar, 'click any corner to decode it', { live: true });
    spacer(bar);
    this.sphereBtn = button(bar, 'show decoding spheres', () => {
      this.spheres = !this.spheres;
      this.sphereBtn.textContent = this.spheres ? 'hide decoding spheres' : 'show decoding spheres';
    });
  }

  #project(w, h) {
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const scale = Math.min(w, h) * 0.27;
    const pts = [];
    for (let v = 0; v < 8; v++) {
      const x0 = (v & 1) * 2 - 1;          // bit0 → x
      const y0 = ((v >> 1) & 1) * 2 - 1;   // bit1 → y
      const z0 = ((v >> 2) & 1) * 2 - 1;   // bit2 → z
      let x = x0 * cy + z0 * sy;
      let z = -x0 * sy + z0 * cy;
      let y = y0 * cp - z * sp;
      z = y0 * sp + z * cp;
      const f = 3.6 / (3.6 + z);
      pts.push({ x: w / 2 + x * scale * f, y: h / 2 + y * scale * f, z, f });
    }
    return pts;
  }

  static dist(a, b) {
    let d = a ^ b, n = 0;
    while (d) { n += d & 1; d >>= 1; }
    return n;
  }

  nearest(v) {
    return CODEWORDS.reduce((best, c) => (Cube.dist(v, c) < Cube.dist(v, best) ? c : best));
  }

  selectCorner(v) {
    this.selected = v;
    if (v === null) {
      this.info.set('click any corner to decode it');
      return;
    }
    const c = this.nearest(v);
    const d = Cube.dist(v, c);
    this.info.set(
      d === 0
        ? `${bits(v)} is a codeword — it decodes as itself`
        : `d(${bits(v)}, ${bits(c)}) = ${d} → decodes to ${bits(c)}`,
      d === 0 ? 'heal' : '',
    );
  }

  onDown(x, y) {
    const pts = this.#project(this.w, this.h);
    for (let v = 0; v < 8; v++) {
      if ((pts[v].x - x) ** 2 + (pts[v].y - y) ** 2 < 17 ** 2) {
        this.selectCorner(this.selected === v ? null : v);
        return;
      }
    }
    this.dragging = true;
    this.last = { x, y };
  }

  onMove(x, y) {
    if (this.dragging && this.down) {
      this.yaw += (x - this.last.x) * 0.008;
      this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch + (y - this.last.y) * 0.008));
      this.last = { x, y };
      this.idle = 0;
    }
  }

  onUp() { this.dragging = false; }

  update(dt) {
    this.idle += dt;
    if (!reducedMotion() && !this.down && this.idle > 2.5) this.yaw += dt * 0.12;
  }

  draw(ctx, w, h) {
    ctx.fillStyle = C.ink;
    ctx.fillRect(0, 0, w, h);
    const pts = this.#project(w, h);

    // decoding-sphere hulls: soft blob behind each codeword's family
    if (this.spheres) {
      for (const c of CODEWORDS) {
        const fam = [];
        for (let v = 0; v < 8; v++) if (this.nearest(v) === c) fam.push(pts[v]);
        const gx = fam.reduce((s, p) => s + p.x, 0) / fam.length;
        const gy = fam.reduce((s, p) => s + p.y, 0) / fam.length;
        const tone = c === 0 ? C.rust : C.heal;
        ctx.beginPath();
        const hull = convexHull(fam.map((p) => [p.x, p.y]));
        blobPath(ctx, hull, gx, gy, 30);
        ctx.fillStyle = fade(tone, 0.07);
        ctx.fill();
        ctx.setLineDash([4, 5]);
        ctx.strokeStyle = fade(tone, 0.4);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // edges (single bit flips), painter-sorted
    const edges = [];
    for (let v = 0; v < 8; v++) {
      for (const b of [1, 2, 4]) {
        const u = v ^ b;
        if (u > v) edges.push([v, u]);
      }
    }
    edges.sort((e1, e2) => (pts[e1[0]].z + pts[e1[1]].z) - (pts[e2[0]].z + pts[e2[1]].z));
    for (const [a, b] of edges) {
      ctx.beginPath();
      ctx.moveTo(pts[a].x, pts[a].y);
      ctx.lineTo(pts[b].x, pts[b].y);
      ctx.strokeStyle = fade('#8a8371', 0.16 + 0.12 * ((pts[a].f + pts[b].f) / 2 - 0.8) * 5);
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // path from the selected corner to its codeword
    if (this.selected !== null) {
      let v = this.selected;
      const target = this.nearest(v);
      ctx.lineWidth = 2;
      while (v !== target) {
        // flip the lowest differing bit
        const diff = v ^ target;
        const bit = diff & -diff;
        const u = v ^ bit;
        ctx.beginPath();
        ctx.moveTo(pts[v].x, pts[v].y);
        ctx.lineTo(pts[u].x, pts[u].y);
        ctx.strokeStyle = fade(C.gold, 0.85);
        ctx.stroke();
        v = u;
      }
      ctx.lineWidth = 1;
    }

    // corners, back to front
    const order = [...Array(8).keys()].sort((a, b) => pts[a].z - pts[b].z);
    for (const v of order) {
      const p = pts[v];
      const isCode = CODEWORDS.includes(v);
      const fam = this.nearest(v);
      const tone = fam === 0 ? C.rust : C.heal;
      const r = (isCode ? 9 : 5.5) * p.f;

      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = isCode ? (fam === 0 ? fade(C.rust, 0.9) : fade(C.heal, 0.9)) : fade(tone, 0.22);
      ctx.fill();
      if (isCode) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + 4, 0, Math.PI * 2);
        ctx.strokeStyle = C.gold;
        ctx.stroke();
      }
      if (this.selected === v) {
        const pulse = reducedMotion() ? 6 : 5 + 2 * Math.sin(this.t * 5);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + pulse, 0, Math.PI * 2);
        ctx.strokeStyle = fade(C.gold, 0.8);
        ctx.stroke();
      }

      const lx = p.x + (p.x - w / 2) * 0.14;
      const ly = p.y + (p.y - h / 2) * 0.14;
      ctx.font = mono(isCode ? 13 : 11);
      ctx.textAlign = 'center';
      ctx.fillStyle = isCode ? C.bright : C.dim;
      ctx.fillText(bits(v), lx, ly + (ly > p.y ? 14 : -8));
    }

    ctx.font = mono(10);
    ctx.textAlign = 'left';
    ctx.fillStyle = C.faint;
    ctx.fillText('CODE {000, 111} · EDGES = SINGLE BIT FLIPS · DRAG TO ROTATE', 16, 20);
  }
}

function bits(v) {
  return ((v >> 2) & 1) + '' + ((v >> 1) & 1) + '' + (v & 1);
}

function convexHull(points) {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (const p of [...pts].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

// a rounded, slightly inflated closed path around a hull
function blobPath(ctx, hull, gx, gy, pad) {
  const inflated = hull.map(([x, y]) => {
    const dx = x - gx, dy = y - gy;
    const d = Math.hypot(dx, dy) || 1;
    return [x + (dx / d) * pad, y + (dy / d) * pad];
  });
  const n = inflated.length;
  ctx.moveTo((inflated[0][0] + inflated[n - 1][0]) / 2, (inflated[0][1] + inflated[n - 1][1]) / 2);
  for (let i = 0; i < n; i++) {
    const [x1, y1] = inflated[i];
    const [x2, y2] = inflated[(i + 1) % n];
    ctx.quadraticCurveTo(x1, y1, (x1 + x2) / 2, (y1 + y2) / 2);
  }
  ctx.closePath();
}
