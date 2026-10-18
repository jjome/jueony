# N001 general-layout storage evidence (Rust126)

Source `04cb5482deee38fb`,126 ordered patches, one501/501 workflow invocation
(the previous492 plus9 actual app TAC checks), TypeScript1036, extra legacy14,
typed dates14, actual creation12, fixed columns24, Windows11 and bundle7.
Counts are separate overlapping invocations, not independent coverage totals.
The44 fixed Native/XML inputs are tracked under apps/editor/tests/fixtures/
n001-general125-own. Native and XML input baselines are independent: the original
generator conversion discrepancies are retained and NOT claimed corrected.

Dedicated fixed corpus improved51/88 to75/88, retaining13 failures. The public
56-case edit matrix improved32 to34 passes, retaining22 failures. The full29-case
actual app matrix is included with its remaining failures, not marked PASS.
One earlier125 candidate introduced2 repeat-format/password regressions; that
failure and the exact128 representation correction are retained. Full-tail and
current prefix binding remain exact; no guard tolerance was loosened.

Production app source is the unchanged354-file bc0b6c3c archive. Unrelated
save-clock lifecycle/Agent-recents working changes are excluded and preserved.
Native fixtures and test wrappers are isolated; no user files/windows, real
provider calls or Hancom GUI comparisons were used. This is not whole N001 or
Hancom parity completion. Read summary.json and all failures before reuse.

Run python verify.py to check every evidence byte against SHA256-MANIFEST.json.
