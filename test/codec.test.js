import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shield, unshield } from '../js/codec.js';
import { mulberry32, randInt, sampleDistinct } from '../js/prng.js';

function randBytes(rng, len) {
  return Uint8Array.from({ length: len }, () => randInt(rng, 256));
}

test('round-trip at many payload sizes, no damage', () => {
  const rng = mulberry32(10);
  for (const len of [1, 3, 100, 223, 224, 1000, 5000]) {
    const data = randBytes(rng, len);
    const { payload, meta } = shield(data, { nsym: 32 });
    assert.equal(payload.length, meta.blockCount * meta.blockLen);
    const res = unshield(payload, meta);
    assert.equal(res.ok, true, `len=${len}`);
    assert.deepEqual([...res.data], [...data]);
  }
});

test('payload is systematic in the strongest sense: payload[i] === data[i]', () => {
  // striped block assignment + column interleaving compose to the identity
  // on the data region — the data rides in front, untouched, in order
  const rng = mulberry32(15);
  const data = randBytes(rng, 2500);
  const { payload, meta } = shield(data, { nsym: 32 });
  for (let i = 0; i < data.length; i++) {
    if (payload[i] !== data[i]) throw new Error(`payload diverges at ${i}`);
  }
  assert.equal(meta.blockCount * meta.blockDataLen >= data.length, true);
});

test('heals any contiguous burst up to the advertised burstCapacity', () => {
  const rng = mulberry32(11);
  const data = randBytes(rng, 3000);
  const { payload, meta } = shield(data, { nsym: 32 });
  assert.ok(meta.blockCount >= 2, 'payload should interleave across blocks');
  for (let t = 0; t < 25; t++) {
    const L = 1 + randInt(rng, meta.burstCapacity);
    const start = randInt(rng, payload.length - L);
    const damaged = Uint8Array.from(payload);
    const erasures = [];
    for (let i = start; i < start + L; i++) {
      damaged[i] = randInt(rng, 256);
      erasures.push(i);
    }
    const res = unshield(damaged, meta, erasures);
    assert.equal(res.ok, true, `burst L=${L} at ${start} (capacity ${meta.burstCapacity})`);
    assert.deepEqual([...res.data], [...data]);
  }
});

test('the exact maximal burst heals; nudging past a block budget fails honestly', () => {
  const rng = mulberry32(12);
  const data = randBytes(rng, 2000);
  const { payload, meta } = shield(data, { nsym: 16 });
  const L = meta.burstCapacity;
  const damaged = Uint8Array.from(payload);
  const erasures = [];
  for (let i = 0; i < L; i++) {
    damaged[i] = randInt(rng, 256);
    erasures.push(i);
  }
  const good = unshield(damaged, meta, erasures);
  assert.equal(good.ok, true, 'burst exactly at capacity must heal');
  assert.deepEqual([...good.data], [...data]);

  // one more column of damage pushes block 0 over its budget
  const worse = Uint8Array.from(damaged);
  const moreErasures = [...erasures];
  for (let i = L; i < L + meta.blockCount; i++) {
    worse[i] = randInt(rng, 256);
    moreErasures.push(i);
  }
  const bad = unshield(worse, meta, moreErasures);
  assert.equal(bad.ok, false, 'past capacity must be reported, never silently wrong');
  assert.ok(bad.perBlock.some((b) => !b.ok));
});

test('random scatter heals while every block stays within budget', () => {
  const rng = mulberry32(13);
  const data = randBytes(rng, 4000);
  const { payload, meta } = shield(data, { nsym: 32 });
  // erase exactly nsym symbols in every block — the theoretical maximum
  const erasures = [];
  for (let b = 0; b < meta.blockCount; b++) {
    for (const j of sampleDistinct(rng, meta.blockLen, meta.nsym)) {
      erasures.push(j * meta.blockCount + b);
    }
  }
  const damaged = Uint8Array.from(payload);
  for (const p of erasures) damaged[p] ^= 1 + randInt(rng, 255);
  const res = unshield(damaged, meta, erasures);
  assert.equal(res.ok, true);
  assert.deepEqual([...res.data], [...data]);
  assert.equal(res.bytesHealed <= erasures.length, true);
});

test('unknown damage (no erasure info) still heals at half rate', () => {
  const rng = mulberry32(14);
  const data = randBytes(rng, 1500);
  const { payload, meta } = shield(data, { nsym: 32 });
  const damaged = Uint8Array.from(payload);
  // corrupt ⌊nsym/2⌋ symbols per block, telling the decoder nothing
  for (let b = 0; b < meta.blockCount; b++) {
    for (const j of sampleDistinct(rng, meta.blockLen, meta.nsym / 2)) {
      damaged[j * meta.blockCount + b] ^= 1 + randInt(rng, 255);
    }
  }
  const res = unshield(damaged, meta, []);
  assert.equal(res.ok, true);
  assert.deepEqual([...res.data], [...data]);
});
