# N001 legacy row-cache inputs

These are repository-owned, reproducible fixtures, not user or Hancom sample documents.
`scripts/generate-n001-legacy-row-fixtures.mjs` uses the pinned official generation119
WASM engine and the existing repository-owned single-column table fixture. It inserts
literal text through the public editing API, then saves one ordinary HWP and one HWP
with explicit test timestamps. No descriptor bytes are removed, rewritten or forged.

The original119 resource fingerprint is intentionally stale in newer engines. Tests
must preserve its opaque bytes without restoring it as a current row/layout lease.
The manifest pins both outputs, source input and engine. The two outputs reproduce
the initial observed N001 failures byte for byte.
