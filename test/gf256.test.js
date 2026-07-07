import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as gf from '../js/gf256.js';
import { mulberry32, randInt } from '../js/prng.js';

test('exp/log are inverse bijections on the 255 units', () => {
  const seen = new Set();
  for (let i = 0; i < 255; i++) {
    const x = gf.exp(i);
    assert.notEqual(x, 0);
    assert.equal(gf.log(x), i);
    seen.add(x);
  }
  assert.equal(seen.size, 255);
});

test('every nonzero element has a working inverse', () => {
  for (let a = 1; a < 256; a++) {
    assert.equal(gf.mul(a, gf.inv(a)), 1, `a=${a}`);
    assert.equal(gf.div(a, a), 1);
  }
});

test('multiplication: commutative, 1 is identity, 0 annihilates (exhaustive)', () => {
  for (let a = 0; a < 256; a++) {
    assert.equal(gf.mul(a, 1), a);
    assert.equal(gf.mul(a, 0), 0);
    for (let b = a; b < 256; b++) {
      assert.equal(gf.mul(a, b), gf.mul(b, a));
    }
  }
});

test('associativity and distributivity (5000 random triples)', () => {
  const rng = mulberry32(0xdec0de);
  for (let t = 0; t < 5000; t++) {
    const a = randInt(rng, 256), b = randInt(rng, 256), c = randInt(rng, 256);
    assert.equal(gf.mul(gf.mul(a, b), c), gf.mul(a, gf.mul(b, c)));
    assert.equal(gf.mul(a, b ^ c), gf.mul(a, b) ^ gf.mul(a, c));
  }
});

test('pow matches repeated multiplication, handles negatives', () => {
  const rng = mulberry32(7);
  for (let t = 0; t < 500; t++) {
    const a = 1 + randInt(rng, 255);
    const n = randInt(rng, 20);
    let acc = 1;
    for (let i = 0; i < n; i++) acc = gf.mul(acc, a);
    assert.equal(gf.pow(a, n), acc);
    if (n > 0) assert.equal(gf.mul(gf.pow(a, -n), acc), 1);
  }
});

test('polyDivmod reconstructs the dividend (monic divisors)', () => {
  const rng = mulberry32(42);
  for (let t = 0; t < 300; t++) {
    const dividend = Array.from({ length: 5 + randInt(rng, 30) }, () => randInt(rng, 256));
    const divisor = [1, ...Array.from({ length: 1 + randInt(rng, 4) }, () => randInt(rng, 256))];
    if (dividend.length < divisor.length) continue;
    const [q, r] = gf.polyDivmod(dividend, divisor);
    const rebuilt = gf.polyAdd(gf.polyMul(q, divisor), r);
    const want = [...dividend];
    while (want.length > 1 && want[0] === 0) want.shift();
    const got = [...rebuilt];
    while (got.length > 1 && got[0] === 0) got.shift();
    assert.deepEqual(got, want);
  }
});

test('polyEval agrees with naive evaluation', () => {
  const rng = mulberry32(99);
  for (let t = 0; t < 300; t++) {
    const p = Array.from({ length: 1 + randInt(rng, 12) }, () => randInt(rng, 256));
    const x = randInt(rng, 256);
    let naive = 0;
    const deg = p.length - 1;
    for (let i = 0; i < p.length; i++) naive ^= gf.mul(p[i], gf.pow(x, deg - i));
    assert.equal(gf.polyEval(p, x), naive);
  }
});
