// Chapter 0 — the unscratchable message. A StorageSurface wearing 64 bytes
// of parity per block, with auto-heal and a scripted demo mode used to
// record the README GIF (?demo=1).

import { StorageSurface } from './surface.js';
import { uiBar, button, slider, note, spacer, t } from './figure.js';

export class Hero extends StorageSurface {
  constructor(mount, { demo = false } = {}) {
    super(mount, {
      cols: 128, rows: 40, nsym: 64, message: t('h_message'),
      autoHeal: true, aspect: 0.5, minH: 320, maxH: 470,
    });
    this.demo = demo;

    const bar = uiBar(mount);
    this.meter = note(bar, t('h_dragMsg'));
    spacer(bar);
    this.brushCtl = slider(bar, {
      label: t('brush'), min: 1, max: 4, value: 2,
      format: (v) => t('brushLevels')[v - 1],
      onInput: (v) => { this.brushCells = v; },
    });
    button(bar, t('h_healNow'), () => this.heal(), 'primary');
    button(bar, t('reset'), () => this.reset());

    if (demo) {
      this.touched = true; // suppress the hint
      this.#runDemo();
    }
  }

  onDamageChange() {
    if (!this.meter) return;
    if (this.erased.size === 0) {
      this.meter.set(t('h_dragMsg'));
      return;
    }
    const load = this.perBlockLoad();
    const worst = Math.max(...load);
    const over = worst > this.budget();
    const msg = t('h_gouged', this.erased.size, worst, this.budget());
    this.meter.set(over ? msg + t('h_beyond') : msg + t('h_healable'), over ? 'rust' : 'heal');
  }

  onHealed(ok, n, miscorrected) {
    if (miscorrected) {
      this.meter.set(t('h_miscorrupt'), 'rust');
    } else if (ok) {
      this.meter.set(t('h_healed', this.erased.size === 0 ? n : n - this.erased.size, this.meta.blockCount, this.decodeMs.toFixed(1)), 'heal');
    } else {
      this.meter.set(t('h_blocksLost', this.failedBlocks.size, this.meta.blockCount, this.budget()), 'rust');
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
