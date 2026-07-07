// The armor the hero canvas actually wears: payload → equal-sized RS blocks,
// transmitted column-interleaved so one contiguous scratch is shredded into
// small, per-block-correctable crumbs.
//
// Interleaving happens on BOTH sides of the encoder:
//   · data byte i is assigned to block i mod B (striped, not chunked), so
//     damage that is local in DATA space also spreads across blocks;
//   · block b, symbol j is transmitted at payload[j·B + b], so damage that
//     is local in PAYLOAD space spreads across blocks too.
// A contiguous payload burst of length L touches at most ⌈L/B⌉ symbols of
// any single block — so ANY burst up to nsym·B bytes heals completely.

import { RS } from './rs.js';

export function shield(data, { nsym = 32 } = {}) {
  const bytes = Uint8Array.from(data);
  if (bytes.length === 0) throw new RangeError('shield: empty payload');
  const maxData = 255 - nsym;
  const blockCount = Math.max(1, Math.ceil(bytes.length / maxData));
  const blockDataLen = Math.ceil(bytes.length / blockCount);
  const n = blockDataLen + nsym;
  const rs = new RS(nsym);

  const blocks = [];
  for (let b = 0; b < blockCount; b++) {
    const chunk = new Uint8Array(blockDataLen); // zero-padded tail
    for (let j = 0; j < blockDataLen; j++) {
      const i = j * blockCount + b;
      if (i < bytes.length) chunk[j] = bytes[i];
    }
    blocks.push(rs.encode(chunk));
  }

  const payload = new Uint8Array(blockCount * n);
  for (let b = 0; b < blockCount; b++) {
    for (let j = 0; j < n; j++) payload[j * blockCount + b] = blocks[b][j];
  }

  return {
    payload,
    meta: {
      nsym,
      blockCount,
      blockDataLen,
      blockLen: n,
      dataLen: bytes.length,
      // any contiguous scratch up to this long is guaranteed healable
      burstCapacity: nsym * blockCount,
    },
  };
}

// erasures: iterable of payload indices known to be damaged.
export function unshield(payload, meta, erasures = []) {
  const { nsym, blockCount, blockDataLen, blockLen: n, dataLen } = meta;
  if (payload.length !== blockCount * n) {
    return { ok: false, reason: 'payload length does not match meta', perBlock: [] };
  }
  const rs = new RS(nsym);

  const perBlockErasures = Array.from({ length: blockCount }, () => []);
  for (const p of new Set(erasures)) {
    if (p >= 0 && p < payload.length) perBlockErasures[p % blockCount].push(Math.floor(p / blockCount));
  }

  const data = new Uint8Array(blockCount * blockDataLen);
  const perBlock = [];
  let ok = true;
  let bytesHealed = 0;

  for (let b = 0; b < blockCount; b++) {
    const cw = new Uint8Array(n);
    for (let j = 0; j < n; j++) cw[j] = payload[j * blockCount + b];
    const res = rs.decode(cw, perBlockErasures[b]);
    const source = res.ok ? res.data : cw; // on failure keep the visible wreckage
    for (let j = 0; j < blockDataLen; j++) data[j * blockCount + b] = source[j];
    if (res.ok) {
      bytesHealed += res.errata.length;
      perBlock.push({ ok: true, errata: res.errata.length, budget: nsym });
    } else {
      ok = false;
      perBlock.push({ ok: false, errata: perBlockErasures[b].length, budget: nsym, reason: res.reason });
    }
  }

  return { ok, data: data.slice(0, dataLen), bytesHealed, perBlock };
}
