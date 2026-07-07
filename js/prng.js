// mulberry32 — tiny seeded PRNG so every demo, noise pattern, and recorded
// GIF reproduces exactly. Not cryptographic; doesn't need to be.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randInt(rng, n) {
  return Math.floor(rng() * n);
}

// k distinct integers from [0, n)
export function sampleDistinct(rng, n, k) {
  if (k > n) throw new RangeError('sampleDistinct: k > n');
  const picked = new Set();
  while (picked.size < k) picked.add(randInt(rng, n));
  return [...picked];
}
