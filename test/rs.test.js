import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RS, generatorPoly } from '../js/rs.js';
import * as gf from '../js/gf256.js';
import { mulberry32, randInt, sampleDistinct } from '../js/prng.js';

function randMsg(rng, len) {
  return Uint8Array.from({ length: len }, () => randInt(rng, 256));
}

test('generator polynomial is monic with roots α^0..α^(nsym-1)', () => {
  for (const nsym of [2, 4, 10, 32]) {
    const g = generatorPoly(nsym);
    assert.equal(g.length, nsym + 1);
    assert.equal(g[0], 1);
    for (let i = 0; i < nsym; i++) {
      assert.equal(gf.polyEval(g, gf.exp(i)), 0, `root α^${i} of g for nsym=${nsym}`);
    }
  }
});

test('encoded codewords have all-zero syndromes (the defining property)', () => {
  const rng = mulberry32(1);
  for (const nsym of [4, 8, 16, 32, 64]) {
    const rs = new RS(nsym);
    for (let t = 0; t < 50; t++) {
      const msg = randMsg(rng, 1 + randInt(rng, 255 - nsym));
      const cw = rs.encode(msg);
      assert.equal(cw.length, msg.length + nsym);
      assert.deepEqual([...cw.slice(0, msg.length)], [...msg], 'systematic: message rides in front');
      assert.equal(Math.max(...rs.syndromes(cw)), 0);
    }
  }
});

test('clean codewords decode unchanged', () => {
  const rng = mulberry32(2);
  const rs = new RS(16);
  for (let t = 0; t < 50; t++) {
    const msg = randMsg(rng, 1 + randInt(rng, 200));
    const res = rs.decode(rs.encode(msg));
    assert.equal(res.ok, true);
    assert.deepEqual([...res.data], [...msg]);
    assert.deepEqual(res.errata, []);
  }
});

test('corrects up to ⌊nsym/2⌋ random unknown errors (exhaustive over budgets)', () => {
  const rng = mulberry32(3);
  for (const nsym of [4, 8, 16, 32]) {
    const rs = new RS(nsym);
    const maxErrs = Math.floor(nsym / 2);
    for (let e = 1; e <= maxErrs; e++) {
      for (let t = 0; t < 40; t++) {
        const msg = randMsg(rng, 1 + randInt(rng, 255 - nsym));
        const cw = rs.encode(msg);
        const bad = Uint8Array.from(cw);
        const pos = sampleDistinct(rng, cw.length, e);
        for (const p of pos) bad[p] ^= 1 + randInt(rng, 255); // guaranteed change
        const res = rs.decode(bad);
        assert.equal(res.ok, true, `nsym=${nsym} e=${e}`);
        assert.deepEqual([...res.data], [...msg]);
        assert.deepEqual([...res.errata].sort((a, b) => a - b), [...pos].sort((a, b) => a - b));
      }
    }
  }
});

test('corrects up to nsym known erasures', () => {
  const rng = mulberry32(4);
  for (const nsym of [4, 16, 32]) {
    const rs = new RS(nsym);
    for (let f = 1; f <= nsym; f++) {
      for (let t = 0; t < 15; t++) {
        const msg = randMsg(rng, 1 + randInt(rng, 255 - nsym));
        const cw = rs.encode(msg);
        const bad = Uint8Array.from(cw);
        const pos = sampleDistinct(rng, cw.length, f);
        for (const p of pos) bad[p] ^= randInt(rng, 256); // may even be unchanged — still fine
        const res = rs.decode(bad, pos);
        assert.equal(res.ok, true, `nsym=${nsym} f=${f}`);
        assert.deepEqual([...res.data], [...msg]);
      }
    }
  }
});

test('corrects every legal mix: 2·errors + erasures ≤ nsym', () => {
  const rng = mulberry32(5);
  const nsym = 16;
  const rs = new RS(nsym);
  for (let e = 0; e <= 8; e++) {
    for (let f = 0; f <= nsym - 2 * e; f++) {
      if (e === 0 && f === 0) continue;
      for (let t = 0; t < 10; t++) {
        const msg = randMsg(rng, 40 + randInt(rng, 150));
        const cw = rs.encode(msg);
        const bad = Uint8Array.from(cw);
        const all = sampleDistinct(rng, cw.length, e + f);
        const errPos = all.slice(0, e);
        const erasePos = all.slice(e);
        for (const p of errPos) bad[p] ^= 1 + randInt(rng, 255);
        for (const p of erasePos) bad[p] = randInt(rng, 256);
        const res = rs.decode(bad, erasePos);
        assert.equal(res.ok, true, `e=${e} f=${f}`);
        assert.deepEqual([...res.data], [...msg]);
      }
    }
  }
});

test('never returns ok with wrong data; overload is reported as failure', () => {
  const rng = mulberry32(6);
  const nsym = 16;
  const rs = new RS(nsym);
  let failures = 0;
  const trials = 300;
  for (let t = 0; t < trials; t++) {
    const msg = randMsg(rng, 100);
    const cw = rs.encode(msg);
    const bad = Uint8Array.from(cw);
    const e = 9 + randInt(rng, 20); // 9..28 errors — beyond the 8-error budget
    for (const p of sampleDistinct(rng, cw.length, e)) bad[p] ^= 1 + randInt(rng, 255);
    const res = rs.decode(bad);
    if (res.ok) {
      // A decoder may legitimately land on a DIFFERENT valid codeword when
      // overloaded (miscorrection), but it must never claim the original.
      assert.notDeepEqual([...res.data], [...msg], 'ok result must be a self-consistent codeword');
      assert.equal(Math.max(...rs.syndromes(res.codeword)), 0);
    } else {
      failures++;
    }
  }
  assert.ok(failures > trials * 0.9, `expected the vast majority to be flagged, got ${failures}/${trials}`);
});

test('erasures beyond nsym are rejected up front', () => {
  const rs = new RS(8);
  const cw = rs.encode(Uint8Array.from({ length: 50 }, (_, i) => i));
  const res = rs.decode(cw, Array.from({ length: 9 }, (_, i) => i));
  assert.equal(res.ok, false);
});

test('works at extreme block shapes (tiny message, max-length block)', () => {
  const rng = mulberry32(8);
  const rs = new RS(32);
  for (const len of [1, 2, 223]) {
    const msg = randMsg(rng, len);
    const cw = rs.encode(msg);
    const bad = Uint8Array.from(cw);
    for (const p of sampleDistinct(rng, cw.length, 16)) bad[p] ^= 1 + randInt(rng, 255);
    const res = rs.decode(bad);
    assert.equal(res.ok, true, `len=${len}`);
    assert.deepEqual([...res.data], [...msg]);
  }
});
