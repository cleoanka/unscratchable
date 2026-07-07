// Reed–Solomon over GF(256), systematic form, with full errors-AND-erasures
// decoding: syndromes → Forney syndromes → Berlekamp–Massey → Chien search →
// Forney algorithm.
//
// A codeword of length n = k + nsym survives any combination of e unknown
// errors and f known erasures as long as 2e + f ≤ nsym.
//
// Beyond that budget, damage is USUALLY detected and reported — but bounded-
// distance decoding cannot promise it: a word pushed past the guarantee can
// land within another codeword's decoding sphere and decode, silently, to
// the wrong message. That is a property of the mathematics, not a bug, and
// chapter 7 of the essay demonstrates it honestly.
//
// Conventions (shared with gf256.js): arrays hold polynomial coefficients
// with index 0 = highest degree; codeword index i corresponds to the
// coefficient of x^(n−1−i), so the message rides in front and parity trails.

import * as gf from './gf256.js';

// g(x) = ∏_{i=0}^{nsym−1} (x − α^(fcr+i)) — the parity generator. Monic.
export function generatorPoly(nsym, fcr = 0) {
  let g = [1];
  for (let i = 0; i < nsym; i++) g = gf.polyMul(g, [1, gf.exp(fcr + i)]);
  return g;
}

export class RS {
  constructor(nsym, fcr = 0) {
    if (!Number.isInteger(nsym) || nsym < 2 || nsym > 254) {
      throw new RangeError('RS: nsym must be an integer in [2, 254]');
    }
    this.nsym = nsym;
    this.fcr = fcr;
    this.gen = generatorPoly(nsym, fcr);
  }

  // message bytes → codeword bytes (message ++ parity)
  encode(msg) {
    if (msg.length === 0) throw new RangeError('RS: empty message');
    if (msg.length + this.nsym > 255) {
      throw new RangeError(`RS: message longer than ${255 - this.nsym} bytes`);
    }
    const padded = [...msg, ...new Array(this.nsym).fill(0)];
    const [, parity] = gf.polyDivmod(padded, this.gen);
    return Uint8Array.from([...msg, ...parity]);
  }

  // S_j = c(α^(fcr+j)). All zero ⇔ c is a valid codeword.
  // A leading 0 is prepended (harmless x⁰ pad that simplifies indexing below).
  syndromes(cw) {
    const s = [0];
    for (let i = 0; i < this.nsym; i++) s.push(gf.polyEval(cw, gf.exp(this.fcr + i)));
    return s;
  }

  // Locator polynomial ∏ (1 + x·α^(c_i)) for coefficient positions c_i = n−1−i.
  #errataLocator(coefPos) {
    let loc = [1];
    for (const p of coefPos) loc = gf.polyMul(loc, gf.polyAdd([1], [gf.exp(p), 0]));
    return loc;
  }

  // Ω(x) = S(x)·Λ(x) mod x^(nsym+1)
  #errorEvaluator(syndRev, errLoc, nsym) {
    const divisor = [1, ...new Array(nsym + 1).fill(0)];
    const [, remainder] = gf.polyDivmod(gf.polyMul(syndRev, errLoc), divisor);
    return remainder;
  }

  // Fold known erasures out of the syndromes so Berlekamp–Massey only has to
  // find the UNKNOWN error positions.
  #forneySyndromes(synd, erasePos, n) {
    const fsynd = synd.slice(1);
    for (const p of erasePos) {
      const x = gf.exp(n - 1 - p);
      for (let j = 0; j < fsynd.length - 1; j++) {
        fsynd[j] = gf.mul(fsynd[j], x) ^ fsynd[j + 1];
      }
    }
    return fsynd;
  }

  // Berlekamp–Massey. Returns the error locator Λ(x), or null when the
  // implied error count exceeds the correction budget.
  #errorLocator(synd, eraseCount) {
    let errLoc = [1];
    let oldLoc = [1];
    const syndShift = synd.length - this.nsym;
    for (let i = 0; i < this.nsym - eraseCount; i++) {
      const K = i + syndShift;
      let delta = synd[K];
      for (let j = 1; j < errLoc.length; j++) {
        delta ^= gf.mul(errLoc[errLoc.length - 1 - j], synd[K - j]);
      }
      oldLoc = [...oldLoc, 0];
      if (delta !== 0) {
        if (oldLoc.length > errLoc.length) {
          const newLoc = gf.polyScale(oldLoc, delta);
          oldLoc = gf.polyScale(errLoc, gf.inv(delta));
          errLoc = newLoc;
        }
        errLoc = gf.polyAdd(errLoc, gf.polyScale(oldLoc, delta));
      }
    }
    while (errLoc.length > 0 && errLoc[0] === 0) errLoc = errLoc.slice(1);
    const errs = errLoc.length - 1;
    if (errs * 2 + eraseCount > this.nsym) return null;
    return errLoc;
  }

  // Chien search: try every position, keep those where Λ vanishes.
  #findErrors(errLocRev, n) {
    const errs = errLocRev.length - 1;
    const pos = [];
    for (let i = 0; i < n; i++) {
      if (gf.polyEval(errLocRev, gf.exp(i)) === 0) pos.push(n - 1 - i);
    }
    return pos.length === errs ? pos : null;
  }

  // Forney algorithm: compute each error magnitude and add it back in
  // (adding IS subtracting in GF(2⁸)).
  #correctErrata(cw, synd, errataPos) {
    const n = cw.length;
    const coefPos = errataPos.map((p) => n - 1 - p);
    const errLoc = this.#errataLocator(coefPos);
    const errEval = this.#errorEvaluator([...synd].reverse(), errLoc, errLoc.length - 1).reverse();

    const X = coefPos.map((c) => gf.pow(2, -(255 - c)));
    const out = Uint8Array.from(cw);
    for (let i = 0; i < X.length; i++) {
      const Xi = X[i];
      const XiInv = gf.inv(Xi);
      let locPrime = 1; // Λ'(Xi⁻¹) via the product formula
      for (let j = 0; j < X.length; j++) {
        if (j !== i) locPrime = gf.mul(locPrime, 1 ^ gf.mul(XiInv, X[j]));
      }
      if (locPrime === 0) return null; // degenerate locator — give up honestly
      let y = gf.polyEval([...errEval].reverse(), XiInv);
      y = gf.mul(gf.pow(Xi, 1 - this.fcr), y);
      out[errataPos[i]] ^= gf.div(y, locPrime);
    }
    return out;
  }

  // codeword (+ known-bad positions) → { ok, data, codeword, errata } |
  //                                     { ok: false, reason }
  decode(cwIn, erasePos = []) {
    const n = cwIn.length;
    if (n > 255) return { ok: false, reason: 'block longer than 255 bytes' };
    if (n <= this.nsym) return { ok: false, reason: 'block shorter than parity' };

    const cw = Uint8Array.from(cwIn);
    // duplicates are collapsed and out-of-range indices dropped — a wrong
    // erasure hint silently becomes an unknown error costing 2 budget units,
    // so callers should pass accurate positions (codec.js derives its own)
    const erasures = [...new Set(erasePos)].filter((p) => p >= 0 && p < n);
    if (erasures.length > this.nsym) {
      return { ok: false, reason: `${erasures.length} erasures exceed the ${this.nsym}-byte parity budget` };
    }
    for (const p of erasures) cw[p] = 0;

    const synd = this.syndromes(cw);
    if (Math.max(...synd) === 0) {
      return { ok: true, data: cw.slice(0, n - this.nsym), codeword: cw, errata: [] };
    }

    const fsynd = this.#forneySyndromes(synd, erasures, n);
    const errLoc = this.#errorLocator(fsynd, erasures.length);
    if (errLoc === null) return { ok: false, reason: 'too many errors for the parity budget' };

    const errPos = errLoc.length - 1 === 0 ? [] : this.#findErrors([...errLoc].reverse(), n);
    if (errPos === null) return { ok: false, reason: 'error locator does not factor — damage exceeds the code' };

    const errata = [...erasures, ...errPos];
    const fixed = this.#correctErrata(cw, synd, errata);
    if (fixed === null) return { ok: false, reason: 'errata magnitudes are unsolvable' };

    if (Math.max(...this.syndromes(fixed)) !== 0) {
      return { ok: false, reason: 'correction failed verification — damage exceeds the code' };
    }
    return { ok: true, data: fixed.slice(0, n - this.nsym), codeword: fixed, errata: errata.sort((a, b) => a - b) };
  }
}
