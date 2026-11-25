import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parabola, yRange } from '../js/widgets/polynomial.js';

const START = [3, 4.5, 5.5];
const XS = [1, 2, 3, 4, 5, 6, 7];

test('parabola passes through the message points and extrapolates by Lagrange', () => {
  for (const ys of [START, [0, 9, -1], [2, 2, 2]]) {
    for (let i = 0; i < 3; i++) assert.equal(parabola(i + 1, ys), ys[i]);
    // y(7) = 10·y1 − 24·y2 + 15·y3
    assert.ok(Math.abs(parabola(7, ys) - (10 * ys[0] - 24 * ys[1] + 15 * ys[2])) < 1e-9);
  }
});

test('the starting message keeps the usual [-2, 10] view', () => {
  assert.deepEqual(yRange(START), [-2, 10]);
});

test('one drag step widens the view instead of losing the spares', () => {
  // y2 + 0.5 sends y(7) from 4.5 to −7.5, below the usual view
  const ys = [3, 5, 5.5];
  assert.equal(parabola(7, ys), -7.5);
  const [lo, hi] = yRange(ys);
  assert.ok(lo <= -7.5 && hi >= 10);
});

test('every reachable message keeps all seven samples inside the view', () => {
  // the drag clamps each message value to [-1.5, 9.5] in half steps
  const vals = [];
  for (let v = -1.5; v <= 9.5; v += 0.5) vals.push(v);
  for (const a of vals) for (const b of vals) for (const c of vals) {
    const ys = [a, b, c];
    const [lo, hi] = yRange(ys);
    for (const x of XS) {
      const y = parabola(x, ys);
      if (y < lo || y > hi) throw new Error(`sample x=${x} off view for ${ys}`);
    }
  }
});
