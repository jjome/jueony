Table content-height and whole-stack storage evidence (self-authored inputs only)

This staging bundle contains private candidate evidence. It is not a completed
formal engine/frontend/browser release. Read scope.json before using the counts.
Core checks: Rust14 + strict command/facade20 + unchanged excluded15 + extended2
+ width12 =63 distinct PASS. Additional actual Canvas-context regression5 PASS
is separate. Reproduction smoke15+2 repeats existing cases; never add it again.

Actual Hancom UI Open and separate SaveAs were performed by parent root for both
output formats. Four screenshots and the source/output artifacts are retained.
Final-v4 output bytes equal those exact v3 UI input bytes. Compact comparisons
retain every published geometry/semantic comparison with tolerance0.2; no full
snapshot or public source document is included. This does not prove every
unparsed binary record, all printing behavior or unrelated features.

The five controlled inputs and actual Hancom copies are in fixtures/controls.
Unprotected common0/9000 becomes5181; true three row minima3000 retain9000.
Protected common1400/9000 becomes1981 with clipped contents in actual Hancom.
Protected clipping is NOT implemented by new47; it is deliberately unsupported.
Independent integer oracle reads actual saved XML and all30 cell declarations.

Reproduction, from the repository root, with Python and Node supporting TS strip:
  python <bundle>/reproduce/reproduce-height-fixtures.py <bundle>/fixtures/controls <temporary-fixtures>
  python <bundle>/reproduce/inspect-height-oracle.py <bundle>/fixtures/controls <temporary-output>/oracle.json

Use a fresh immutable formal/private engine package outside this bundle. No WASM,
font or executable engine is bundled. Set absolute environment values:
  JUEONY_REPO_ROOT = repository root
  JUEONY_ENGINE_PACKAGE = verified candidate/final pkg directory
  JUEONY_TABLE_HEIGHT_CONTROLS = <bundle>/fixtures/controls
  JUEONY_TEST_OUTPUT = a new disposable output directory
Run existing repository verifiers using node --experimental-strip-types:
  apps/editor/scripts/verify-table-content-height-engine.mjs
  apps/editor/scripts/verify-table-height-width-engine.mjs
The exact verifier snapshots used at staging are retained under reproduce as
.original files, with source hashes in the result JSONs and manifest. Do not
silently substitute another source when claiming the historical result.

Portable15 excluded /2 extended reproduction:
  JUEONY_HEIGHT_FIXTURE_ROOT = <temporary-fixtures> from the generator
  JUEONY_HEIGHT_PROOF_MODE = excluded OR extended
For excluded also set JUEONY_BASELINE_ENGINE_PACKAGE to official63
source-8deeb52a09ba2b75/pkg, and JUEONY_SINGLE_OUTER_FIXTURES to
<bundle>/fixtures/single-outer. Run reproduce/reproduce-height-scope.mjs.
It checks all published geometry fields, page counts and semantic evidence.
These scripts write only the requested disposable output directory.

Native14 reproduction: copy a prepared engine source to a NEW temporary checkout;
never modify the immutable prepared source. Copy
reproduce/jueony_table_content_height.rs to its tests directory, add a temporary
Cargo.toml integration target named jueony_table_content_height pointing to that
file (upstream autotests=false), set JUEONY_TABLE_HEIGHT_CONTROLS to the absolute
controls directory (WSL path when running Linux Cargo), and run:
  cargo test --locked -p rhwp --test jueony_table_content_height -j2 -- --nocapture
Check actual14 test names, zero ignored and zero filtered; an empty cached test
binary is not a pass. Original run source/log are included. Shared Cargo builds
must be serialized; no compiled source package is included here.

Canvas counterexample and fixed regression:
  reproduce/check-canvas-app-review.mjs is the exact original historical
  failing reproducer (requires its recorded repository/private paths).
  reproduce/check-canvas-portable-fixed.mjs accepts the absolute environments
  above and tests real Native/WASM Canvas context, both formats, exceptions and
  snapshot rollback. Its valid controlled40px metric is a contract test, not an
  actual browser font measurement or another Hancom oracle. Root fixed the app
  planner and mutation to run in portable context and restore Canvas in finally.

Historical failures are explicit in history/failed-v1-v2-history.json. They were
not erased, reclassified as passing or fixed by loosening checks. Full original
failure files remain immutable in their recorded ignored local paths; compact
counts/failed names/first diagnostics and source hashes are retained here.

Source proof discloses the CRLF official vs LF private difference. Strictly
applied patch files match private runtime text after LF normalization, not raw
source bytes. Final formal build, package hashes and artifact comparisons must
be independently recorded. Seven runtime .rs files stay in build proof only.

filehash-manifest.json records every bundled file except itself using SHA256.
No public input/derivative, full snapshot, font, executable or WASM is bundled.
