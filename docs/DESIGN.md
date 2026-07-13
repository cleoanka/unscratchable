# unscratchable — design

*Scratch this message. It heals.*

An interactive essay on error-correcting codes — from parity bits to Reed–Solomon —
built as a single static page with zero dependencies. The GitHub Pages site **is** the essay.

## Why this shape

Error correction is one of the most consequential ideas in computing and one of the
least *felt*. Everyone's music, QR codes, disks, and deep-space photos survive damage
because of it, yet the standard presentations are either dry library code or passive
video. The essay makes the reader the noise source: they damage data with their own
hand and watch mathematics undo it. Every abstraction is earned by a toy the reader
just played with.

## Structure — eight chapters, one interactive figure each

| # | Chapter | Interactive figure | Concept earned |
|---|---------|--------------------|----------------|
| 0 | The unscratchable message | Hero canvas: damage brush over a rendered message; release → it heals. Live meter: bytes destroyed / limit. | The promise. Redundancy ≠ copies. |
| 1 | A world that flips bits | Noisy channel: message crosses the screen, per-bit flip probability slider corrupts it live. | Why raw data is doomed. |
| 2 | Say everything three times | Repetition code R3 with majority vote; noise slider + storage-cost meter; find the failure (2 of 3 flipped). | First code; why the obvious fix is bad. |
| 3 | Distance is safety | Rotatable 3-bit cube; codewords as corners; decoding spheres of radius 1. | Hamming distance as geometry; minimum distance ⇒ correction radius. |
| 4 | Seven bits, one confession | Hamming(7,4) Venn diagram; click any bit to flip; violated parity circles intersect exactly at the culprit; self-corrects. | Parity as overlapping witnesses; syndrome = address of the error. |
| 5 | The scratch problem | A burst wipes consecutive bytes; interleaving toggle shreds the burst into scattered, correctable crumbs. | Real damage is bursty; interleaving converts burst → random. |
| 6 | Any k points | Draggable polynomial widget: k points determine a degree-(k−1) polynomial; extra points = redundancy; drag any point off — the others still agree on the curve. Then: same game over GF(256). | Reed–Solomon's core intuition. |
| 7 | The healing machine | Finale playground: hero canvas with the hood open — redundancy slider, brush size, erasure vs. error mode, byte-level view of a codeword healing. Closing map: CDs, QR, RAID-6, DSL, Voyager. | Full RS decoder; the boundary of the possible. |

Scope discipline: exactly one widget per chapter, all built on one shared framework.
Hero (ch. 0) and Hamming Venn (ch. 4) get the deepest polish; they are the GIFs.

## Math core (pure, DOM-free, test-first)

- `js/gf256.js` — GF(2⁸), poly 0x11D (the QR/AES-agnostic classic), log/antilog tables,
  add/mul/div/pow/inv, polynomial ops (eval via Horner, mul, scale).
- `js/rs.js` — systematic Reed–Solomon encode (generator-poly division), decode via
  syndromes → Berlekamp–Massey (with erasure initialization) → Chien search → Forney.
  Supports **errors and erasures**: 2·errors + erasures ≤ n − k. The hero uses erasure
  decoding (brush position = known locations), honest to how CDs actually work.
- `js/hamming.js` — Hamming(7,4) encode/decode, syndrome table.
- `js/prng.js` — mulberry32 seeded PRNG so every demo and GIF reproduces exactly.

Verification: `node --test` property suites — field axioms over all 255 units;
thousands of seeded random encode→corrupt→decode round-trips at every legal
error/erasure budget;
beyond-budget corruption must be flagged failed, never silently wrong; Hamming corrects
all 1-bit errors of all 16 messages. Plus an independent-implementation cross-check
during review (a second agent writes RS from scratch; outputs must agree byte-for-byte).

## Widget framework

`js/widgets/figure.js`: owns canvas DPR scaling, pointer events (mouse+touch unified),
RAF loop with IntersectionObserver pause (off-screen figures cost zero CPU),
`prefers-reduced-motion` honored (animations become steps), resize handling.
Each chapter widget subclasses it. No global state; each figure is self-contained.

## Visual identity

Archival-specimen dark: warm near-black ink `#100f0d`, off-white serif text (Iowan Old
Style / Palatino / Charter / Georgia stack — no webfont payload), monospace for data
(SF Mono / Cascadia / consolas stack). Two working colors only: **damage rust**
`#e0533d` and **heal green** `#3ddc84`, with a quiet gold `#c8a24b` for annotations.
Figures sit on slightly-raised panels with hairline borders. Generous measure (~65ch),
big chapter numerals, footnote-style asides. No icon fonts, no CSS framework, no build.

## Repo craft

- `index.html` + `css/essay.css` + `js/**` — served as-is by GitHub Pages (main root).
- `package.json` only for `"type": "module"` and `npm test` → `node --test` (zero deps).
- CI: GitHub Actions — run tests on push; badge in README.
- README: hero GIF (recorded from the live site in demo mode), badges (CI, Pages, MIT,
  zero-deps), chapter map, "how the healing works" section, run-locally one-liner,
  further reading (Hamming 1950, Reed–Solomon 1960, Berlekamp, Massey; 3b1b; Nayuki).
- `?demo=1` attract mode: scripted damage-and-heal loop on the hero — consistent GIFs
  and a living landing page.
- MIT license. `CITATION.cff` for the academically inclined.

## Explicit non-goals

No CRC/LDPC/turbo/polar codes, no QR generation, no WASM, no service worker, no i18n.
One idea, executed deeply.
