// Chapter 0 — the unscratchable message. A StorageSurface wearing 64 bytes
// of parity per block, with auto-heal and a scripted demo mode used to
// record the README GIF (?demo=1).

import { StorageSurface } from './surface.js';
import { uiBar, button, slider, note, spacer } from './figure.js';

export class Hero extends StorageSurface {
  constructor(mount, { demo = false } = {}) {
    super(mount, {
      cols: 128, rows: 40, nsym: 64, message: 'UNSCRATCHABLE',
      autoHeal: true, aspect: 0.5, minH: 320, maxH: 470,
    });
    this.demo = demo;

    const bar = uiBar(mount);
    this.meter = note(bar, 'drag across the message to scratch it');
    spacer(bar);
    this.brushCtl = slider(bar, {
      label: 'brush', min: 1, max: 4, value: 2,
      format: (v) => ['fine', 'thin', 'wide', 'brutal'][v - 1],
      onInput: (v) => { this.brushCells = v; },
    });
    button(bar, 'heal now', () => this.heal(), 'primary');
    button(bar, 'reset', () => this.reset());

    if (demo) {
      this.touched = true; // suppress the hint
      this.#runDemo();
    }
  }

  onDamageChange() {
    if (!this.meter) return;
    if (this.erased.size === 0) {
      this.meter.set('drag across the message to scratch it');
      return;
    }
    const load = this.perBlockLoad();
    const worst = Math.max(...load);
    const over = worst > this.budget();
    const msg = `${this.erased.size} bytes gouged · worst block ${worst}/${this.budget()}`;
    this.meter.set(over ? `${msg} — beyond repair` : `${msg} — still healable`, over ? 'rust' : 'heal');
  }

  onHealed(ok, n, miscorrected) {
    if (miscorrected) {
      this.meter.set('the decoder converged on a DIFFERENT valid codeword — silent miscorruption; damage was beyond the guarantee', 'rust');
    } else if (ok) {
      this.meter.set(`healed ${this.erased.size === 0 ? n : n - this.erased.size} bytes across ${this.meta.blockCount} blocks in ${this.decodeMs.toFixed(1)} ms`, 'heal');
    } else {
      this.meter.set(`${this.failedBlocks.size} of ${this.meta.blockCount} blocks over their ${this.budget()}-byte budget — their bytes are gone · reset to start over`, 'rust');
    }
  }

  async #runDemo() {
    const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));
    await sleep(1.4);
    for (;;) {
      const L = this.layout(this.w, this.h);
      const y0 = L.gy + this.rows * L.cs * 0.5;
      const amp = this.rows * L.cs * 0.4;
      const steps = 85;
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const x = L.gx + L.gw * (0.05 + 0.9 * u);
        const y = y0 + Math.sin(u * Math.PI * 5.2) * amp * (0.5 + 0.5 * Math.sin(u * Math.PI));
        this.scratch(x, y);
        await sleep(0.016);
      }
      await sleep(0.9);
      this.heal();
      await sleep(3.4);
      this.reset();
      await sleep(1.8);
    }
  }
}
