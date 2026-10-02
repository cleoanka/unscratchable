// Chapter 7 — the healing machine, hood open. The same StorageSurface as
// the hero, but every dial is yours: the message, the redundancy, whether
// the decoder is told where the damage is (erasures) or must hunt for it
// (errors, at half the budget). Healing is manual — you pull the lever.

import { StorageSurface } from './surface.js';
import { C, mono, fade, uiBar, button, slider, segmented, note, spacer, t } from './figure.js';

export class Finale extends StorageSurface {
  constructor(mount) {
    super(mount, {
      cols: 112, rows: 30, nsym: 48, message: t('f_message'),
      autoHeal: false, aspect: 0.56, minH: 360, maxH: 520,
    });

    const barTop = uiBar(mount);
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'fig-text';
    input.maxLength = 26;
    input.value = this.message;
    input.setAttribute('aria-label', t('f_msgAria'));
    input.addEventListener('change', () => this.#reencode(input.value.trim() || t('f_saySomething')));
    barTop.appendChild(input);
    this.redundancy = slider(barTop, {
      label: t('f_parity'), min: 8, max: 96, step: 8, value: this.nsym,
      format: (v) => t('f_parityFmt', v),
      onInput: (v) => this.#reencode(this.message, v),
    });
    segmented(barTop, {
      label: t('f_damage'),
      options: [
        { label: t('f_scratchesKnown'), value: true },
        { label: t('f_silentCorruption'), value: false },
      ],
      value: true,
      onChange: (v) => {
        this.knownDamage = v;
        this.onDamageChange();
      },
    });

    const bar = uiBar(mount);
    this.meter = note(bar, t('f_scratchLever'));
    spacer(bar);
    slider(bar, {
      label: t('brush'), min: 1, max: 4, value: 2,
      format: (v) => t('brushLevels')[v - 1],
      onInput: (v) => { this.brushCells = v; },
    });
    button(bar, t('f_heal'), () => this.heal(), 'primary');
    button(bar, t('reset'), () => this.reset());
  }

  #reencode(message, nsym = this.nsym) {
    this.rebuild(message, nsym);
  }

  extraCanvasH() { return 64; } // room for the per-block budget gauges

  onDamageChange() {
    if (!this.meter) return;
    if (this.erased.size === 0) {
      this.meter.set(this.knownDamage ? t('f_scratchLever') : t('f_silentMode', this.budget()));
      return;
    }
    const worst = Math.max(...this.perBlockLoad());
    const over = worst > this.budget();
    this.meter.set(
      t('f_damaged', this.erased.size, worst, this.budget(), this.knownDamage, over),
      over ? 'rust' : 'heal',
    );
  }

  onHealed(ok, n, miscorrected) {
    if (miscorrected) {
      this.meter.set(t('f_miscorrupt'), 'rust');
    } else if (ok) {
      const how = this.knownDamage ? t('f_erasureDecoding') : t('f_errorHunting');
      this.meter.set(t('f_healedBy', n, how, this.decodeMs.toFixed(1)), 'heal');
    } else {
      this.meter.set(t('f_blocksLost', this.failedBlocks.size, this.meta.blockCount, this.knownDamage), 'rust');
    }
  }

  // per-block budget gauges under the parity strip
  drawExtra(ctx, w, h, L) {
    const B = this.meta.blockCount;
    const load = this.perBlockLoad();
    const budget = this.budget();
    const top = L.py + L.parityRows * L.cs + 22;
    const gap = 10;
    const bw = (L.gw - gap * (B - 1)) / B;

    ctx.font = mono(10);
    ctx.textAlign = 'left';
    ctx.fillStyle = C.faint;
    ctx.fillText(t('f_perBlock', budget, this.knownDamage), L.gx, top - 7);

    for (let b = 0; b < B; b++) {
      const x = L.gx + b * (bw + gap);
      const frac = Math.min(1, load[b] / budget);
      const over = load[b] > budget;
      const dead = this.failedBlocks.has(b);
      ctx.fillStyle = C.panel2;
      ctx.fillRect(x, top, bw, 12);
      ctx.fillStyle = dead || over ? fade(C.rust, 0.9) : fade(C.blocks[b % C.blocks.length], 0.95);
      ctx.fillRect(x, top, bw * frac, 12);
      ctx.strokeStyle = C.edge;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, top + 0.5, bw - 1, 11);
      ctx.fillStyle = dead || over ? C.rust : C.dim;
      ctx.fillText(t('f_lost', load[b], budget, dead), x + 2, top + 24);
    }
  }
}
