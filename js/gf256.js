// GF(2⁸) — the 256-element finite field, with primitive polynomial
// x⁸ + x⁴ + x³ + x² + 1 (0x11D) and generator α = 2.
//
// Every byte is a field element. Addition is XOR (each bit is arithmetic
// mod 2), so addition and subtraction are the same operation and nothing
// ever overflows. Multiplication is defined via log/antilog tables:
// a·b = α^(log a + log b).
//
// Polynomials over the field are plain arrays with index 0 holding the
// HIGHEST-degree coefficient, matching long-division order.

const EXP = new Uint8Array(512); // α^i, doubled so products need no reduction
const LOG = new Uint8Array(256); // log_α(x), defined for x ≠ 0

{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}

export const add = (a, b) => a ^ b;
export const sub = add; // in characteristic 2, −x = x

export function mul(a, b) {
  return a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]];
}

export function div(a, b) {
  if (b === 0) throw new RangeError('GF(256): division by zero');
  if (a === 0) return 0;
  return EXP[(LOG[a] + 255 - LOG[b]) % 255];
}

export function inv(a) {
  if (a === 0) throw new RangeError('GF(256): zero has no inverse');
  return EXP[255 - LOG[a]];
}

// α^i for any integer i (negative allowed).
export function exp(i) {
  return EXP[((i % 255) + 255) % 255];
}

export function log(a) {
  if (a === 0) throw new RangeError('GF(256): log of zero');
  return LOG[a];
}

// a^n for any integer n (negative allowed, a ≠ 0 when n < 0).
export function pow(a, n) {
  if (n === 0) return 1;
  if (a === 0) {
    if (n < 0) throw new RangeError('GF(256): zero to a negative power');
    return 0;
  }
  return exp(LOG[a] * n);
}

// ---- polynomials (index 0 = highest degree) ----

export function polyScale(p, x) {
  const out = new Array(p.length);
  for (let i = 0; i < p.length; i++) out[i] = mul(p[i], x);
  return out;
}

export function polyAdd(p, q) {
  const out = new Array(Math.max(p.length, q.length)).fill(0);
  for (let i = 0; i < p.length; i++) out[i + out.length - p.length] = p[i];
  for (let i = 0; i < q.length; i++) out[i + out.length - q.length] ^= q[i];
  return out;
}

export function polyMul(p, q) {
  const out = new Array(p.length + q.length - 1).fill(0);
  for (let i = 0; i < p.length; i++) {
    if (p[i] === 0) continue;
    for (let j = 0; j < q.length; j++) out[i + j] ^= mul(p[i], q[j]);
  }
  return out;
}

// Horner's rule.
export function polyEval(p, x) {
  let y = p[0];
  for (let i = 1; i < p.length; i++) y = mul(y, x) ^ p[i];
  return y;
}

// Synthetic division by a MONIC divisor. Returns [quotient, remainder].
export function polyDivmod(dividend, divisor) {
  const out = Array.from(dividend);
  const shift = dividend.length - (divisor.length - 1);
  for (let i = 0; i < shift; i++) {
    const coef = out[i];
    if (coef === 0) continue;
    for (let j = 1; j < divisor.length; j++) {
      if (divisor[j] !== 0) out[i + j] ^= mul(divisor[j], coef);
    }
  }
  return [out.slice(0, shift), out.slice(shift)];
}
