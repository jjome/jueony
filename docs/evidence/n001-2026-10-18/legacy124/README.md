# N001 final storage evidence (Rust124)

The fixed source is `587008f751f4f6dc`. All492 cases in40 suites pass after one
485/492 invocation plus its unchanged7-case observer-prerequisite rerun.
The engine/frontend/verifier were unchanged between attempts. This includes31
new N001 cases. Do not claim a single492-pass invocation. Separate invocations check
legacy14, explicit timestamps14, app creation12, columns24, Windows storage11,
Native10 test functions, selected Rust8 units, TypeScript1036 units and bundle7.
These counts are not one combined invocation and must not be added as independent coverage.

`workflows/` contains actual final WASM and isolated app results. The immutable
application is the Git archive recorded under `source/`, with no unrelated WIP.
`native/` is independently source-matched private Native evidence. `before/`
preserves failures, including real duplicate ZIP acceptance and harness setup
mistakes. The comparison guard, semantic contract and numeric0.2 tolerance are
unchanged. Original unknown cache bytes stay passive, never current row authority.

No Hancom GUI/print comparison or user window/file interaction was performed.
Original public sample documents and generated external-document copies are not
redistributed here; reports pin their existing local source/oracle bytes.

Run `python verify.py` to validate all sealed file hashes.
