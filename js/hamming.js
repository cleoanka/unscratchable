// Hamming(7,4): 4 data bits protected by 3 parity bits, correcting any
// single-bit error. Positions are numbered 1..7; parity bits sit at the
// powers of two (1, 2, 4) and each parity bit p covers every position whose
// index has p's bit set:
//
//   position  1  2  3  4  5  6  7
//   contents p1 p2 d1 p4 d2 d3 d4
//
// The magic: XOR the syndromes and you get the INDEX of the flipped bit.

const DATA_POS = [3, 5, 6, 7];
const PARITY_POS = [1, 2, 4];

// nibble (0..15, d1 = MSB) → 7-bit word as an array of bits [pos1..pos7]
export function encode(nibble) {
  const bits = new Array(8).fill(0); // 1-indexed
  const d = [(nibble >> 3) & 1, (nibble >> 2) & 1, (nibble >> 1) & 1, nibble & 1];
  DATA_POS.forEach((p, i) => (bits[p] = d[i]));
  for (const p of PARITY_POS) {
    let parity = 0;
    for (let i = 1; i <= 7; i++) {
      if (i !== p && (i & p)) parity ^= bits[i];
    }
    bits[p] = parity;
  }
  return bits.slice(1);
}

// 7-bit word (array [pos1..pos7]) → { nibble, syndrome, corrected }
// syndrome === 0 means the word arrived clean; otherwise syndrome is the
// 1-based position of the (single) flipped bit, which is repaired.
export function decode(word) {
  const bits = [0, ...word];
  let syndrome = 0;
  for (const p of PARITY_POS) {
    let parity = 0;
    for (let i = 1; i <= 7; i++) {
      if (i & p) parity ^= bits[i];
    }
    if (parity) syndrome |= p;
  }
  const corrected = [...bits];
  if (syndrome !== 0) corrected[syndrome] ^= 1;
  const nibble = DATA_POS.reduce((acc, p) => (acc << 1) | corrected[p], 0);
  return { nibble, syndrome, corrected: corrected.slice(1) };
}

// Which positions does each parity bit witness? (For drawing the Venn circles.)
export function coverage(parityPos) {
  const covered = [];
  for (let i = 1; i <= 7; i++) if (i & parityPos) covered.push(i);
  return covered;
}
