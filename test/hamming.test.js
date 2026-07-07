import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encode, decode, coverage } from '../js/hamming.js';

test('clean round-trip for all 16 nibbles', () => {
  for (let n = 0; n < 16; n++) {
    const word = encode(n);
    assert.equal(word.length, 7);
    const res = decode(word);
    assert.equal(res.nibble, n);
    assert.equal(res.syndrome, 0);
  }
});

test('every single-bit flip of every codeword is located and corrected', () => {
  for (let n = 0; n < 16; n++) {
    const word = encode(n);
    for (let bit = 0; bit < 7; bit++) {
      const damaged = [...word];
      damaged[bit] ^= 1;
      const res = decode(damaged);
      assert.equal(res.syndrome, bit + 1, `syndrome must name position ${bit + 1}`);
      assert.equal(res.nibble, n, `nibble recovered after flipping bit ${bit + 1}`);
      assert.deepEqual(res.corrected, word);
    }
  }
});

test('minimum distance of the code is 3', () => {
  const words = [];
  for (let n = 0; n < 16; n++) words.push(encode(n));
  let min = 7;
  for (let i = 0; i < 16; i++) {
    for (let j = i + 1; j < 16; j++) {
      const d = words[i].reduce((acc, b, k) => acc + (b ^ words[j][k]), 0);
      min = Math.min(min, d);
    }
  }
  assert.equal(min, 3);
});

test('parity coverage matches the classic Venn layout', () => {
  assert.deepEqual(coverage(1), [1, 3, 5, 7]);
  assert.deepEqual(coverage(2), [2, 3, 6, 7]);
  assert.deepEqual(coverage(4), [4, 5, 6, 7]);
});
