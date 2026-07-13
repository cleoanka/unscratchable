# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Optimized `assets/hero.gif` (2.46 MB → ~1.0 MB) and `assets/venn.gif`
  (0.96 MB → ~0.4 MB) with an ffmpeg palette pass, scaled to their README
  display sizes — visually equivalent, much faster first paint.
- CI now runs the test suite across a Node 20 and Node 22 matrix (matching the
  documented `Node ≥ 20` floor) and syntax-checks every module with `node --check`.
- Renamed the CI test step to honestly describe its coverage
  ("thousands of seeded random corruptions") instead of an inflated count.

### Added
- `.editorconfig` (UTF-8, LF, final newline, 2-space indent).
- This changelog.

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
