# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Light theme (archival paper) alongside the dark house style. The page follows
  the device setting by default; a moon/sun button in the top-right corner
  switches it and remembers the choice. Canvas figures recolour live.
- Turkish/English toggle: all prose and every figure string in both languages,
  chosen from the saved choice, then the browser, defaulting to English.
- `.editorconfig` (UTF-8, LF, final newline, 2-space indent).
- This changelog.

### Changed
- Optimized `assets/hero.gif` (2.46 MB → ~1.0 MB) and `assets/venn.gif`
  (0.96 MB → ~0.4 MB) with an ffmpeg palette pass, scaled to their README
  display sizes — visually equivalent, much faster first paint.
- CI now runs the test suite across a Node 20 and Node 22 matrix (matching the
  documented `Node ≥ 20` floor) and syntax-checks every module with `node --check`.
- Renamed the CI test step to honestly describe its coverage
  ("thousands of seeded random corruptions") instead of an inflated count.
- Palette aligned to cleoanka.com: cool near-black/near-white neutrals and the
  site's rust/heal/gold accents, in the CSS tokens and the canvas palettes.

### Fixed
- Chapter 7, silent mode: a block that miscorrected while another block failed
  was shown as healed; miscorrection is now checked per block.
- Heal animation now draws every byte the decoder changed, not only the
  scratched ones, so a miscorrection is shown as the decoder output it is.
- Chapter 6: the view widens to keep the spare points on canvas (and clickable)
  after dragging a message point.
- The `?demo=1` hero loop stops when the figure is torn down.
- Venn repair message says "more than one hit" instead of "two hits".

## [1.0.0] — 2026-07-07

First public release: the complete interactive essay.

### Added
- Eight-chapter interactive essay on error-correcting codes, from parity bits to
  Reed–Solomon, as a single static page with zero dependencies.
- A full Reed–Solomon errors-and-erasures pipeline over GF(2⁸)
  (syndromes → Forney syndromes → Berlekamp–Massey → Chien search → Forney) in
  `js/gf256.js` and `js/rs.js`.
- Block striping + column interleaving in `js/codec.js`, so one contiguous scratch
  is shredded across every block.
- Hamming(7,4) with syndrome decoding drawn as the classic three-circle Venn
  (`js/hamming.js`).
- One canvas widget per chapter on a shared, DPR-aware, reduced-motion-honoring
  chassis (`js/widgets/`).
- Node property-test suite (`node --test`) covering the finite field, Hamming,
  Reed–Solomon, and the block codec.
- GitHub Actions test workflow, MIT license, citation metadata, and a design note
  (`docs/DESIGN.md`).
- `?demo=1` scripted scratch-and-heal loop on the hero, hero/Venn animated GIFs,
  and a social preview image.

[Unreleased]: https://github.com/cleoanka/unscratchable/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/cleoanka/unscratchable/releases/tag/v1.0.0
