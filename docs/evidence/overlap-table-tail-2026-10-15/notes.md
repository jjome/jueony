# N001 overlap table storage slice

2026-10-15. This evidence covers 52 actual WASM checks, not complete Hancom parity.

The immutable combined engine is `source-58f40208d1f280ed/pkg`; its metadata includes both the overlap snapshot patch and the separate conversion storage patch. Every current patch SHA matches the compiled manifest. Base source-424 remains unchanged.

The old HWP source and edited session used different host origins: the live session discarded saved origins after an edit, while export retained the old root LINE_SEG. Simply disabling overlap placement would damage legitimate source overlap. The new private export helper writes pagination-owned host origins only in a narrow edited, single-page/column whole-table tail. It also writes precise, unique root blank TextRun origins from the existing render tree, so empty successors cannot disappear inside the saved table band. These writes occur only in the disposable save snapshot, never in the live model.

The previous 242 -> 178.7 and long-table 499.6 -> 178.7 cases now retain identical whole control/text layout, all model evidence, repeated saves, snapshot restore and reapply. A positive object offset also matches. The source allowOverlap flag, signed offset and absolute positioning contracts remain intact. HWPX geometry is unchanged; the separate conversion patch correctly exposes common allowOverlap instead of the stale table.attr mirror, so old incorrect HWPX query values are not used as a compatibility oracle.

18 mode checks passed: four supported HWP roundtrips, four HWPX roundtrips, guarded native-HWP exclusions and HWPX references. Related regression checks: following tables 6, memo tail 5, default padding 9, outer margins 4 and cell padding/host 10; all 34 passed. Baseline-mode PASS only means the source observation/immutability checks passed; `baseline-result.json.layoutMismatches` explicitly records the six old geometry counterexamples.

N001 remains PARTIAL. A visible paragraph after the table and a positive saved LINE_SEG gap intentionally retain the two recorded mismatches. Multi-page/column frames, ambiguous or multi-line blank successors, negative and absolute positions and split tables are excluded. Original unedited source overlap is untouched. The helper preserves the actual current editable placement when saving; it does not certify that every intended source overlap/gap already survives the edit itself. HWP Agent geometry gates remain closed. Browser checks, Hancom comparison and Native Rust unit suite were not run by this subagent.

The HWP/HWPX files here are generated fixtures, not public/user documents. Their roles and byte hashes are in verification-summary.json. They can be opened later in Hancom 2024 alongside the live/reopened layout evidence. Do not interpret exclusion fixture files as a successful general compatibility result.
