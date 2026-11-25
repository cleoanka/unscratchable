import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shield, unshield } from '../js/codec.js';
import { blocksDiffering } from '../js/widgets/surface.js';
import { mulberry32, randInt, sampleDistinct } from '../js/prng.js';

function randBytes(rng, len) {
  return Uint8Array.from({ length: len }, () => randInt(rng, 256));
}

// Chapter 7 in silent mode at its lowest parity: two blocks, errors past the
// half-budget in both. Returns the first trial where one block miscorrects
// (ok, but wrong data) while the other fails outright.
function findMixedOutcome() {
  const rng = mulberry32(77);
  const data = randBytes(rng, 420);
  const { payload: clean, meta } = shield(data, { nsym: 8 });
  const B = meta.blockCount;
  assert.equal(B, 2);
  for (let trial = 0; trial < 4000; trial++) {
    const stored = Uint8Array.from(clean);
    for (const p of sampleDistinct(rng, clean.length, 12)) stored[p] ^= 1 + randInt(rng, 255);
    const res = unshield(stored, meta);
    if (res.ok) continue;
    const healed = shield(res.data, { nsym: 8 }).payload;
    const failed = new Set(res.perBlock.map((b, i) => (b.ok ? -1 : i)).filter((i) => i >= 0));
    const lying = [...blocksDiffering(healed, clean, B)].filter((b) => !failed.has(b));
    if (lying.length > 0) return { clean, meta, stored, res, healed, failed, lying };
  }
  return null;
}

test('blocksDiffering maps payload positions to blocks p mod B', () => {
  const a = new Uint8Array(30);
  const b = Uint8Array.from(a);
  assert.deepEqual([...blocksDiffering(a, b, 3)], []);
  b[4] = 1; // block 1
  b[9] = 1; // block 0
  assert.deepEqual([...blocksDiffering(a, b, 3)].sort(), [0, 1]);
});

test('a miscorrected block is caught even when another block fails', () => {
  const hit = findMixedOutcome();
  assert.ok(hit, 'expected at least one mixed miscorrect/fail outcome');
  const { res, healed, clean, failed, lying, meta } = hit;
  assert.equal(res.ok, false); // the old whole-payload check gave up here
  assert.equal(failed.size, 1);
  assert.equal(lying.length, 1);
  const b = lying[0];
  assert.equal(res.perBlock[b].ok, true);
  let differs = false;
  for (let p = b; p < clean.length; p += meta.blockCount) if (healed[p] !== clean[p]) differs = true;
  assert.ok(differs, 'the ok block really carries wrong bytes');
});
