Private MCST fit/paint spacing plan v5, based on formal76 source23d2545926a179a5. Native16/16, zero ignored. 24 functional scenarios, 92 full-geometry reopens plus 3 diagnostic file reads.

Only the 3-file final patch is a production candidate; no renderer metrics/parser/serializer changes. Whitespace-only cleanup after Native16 is explicit. The root must rebuild the final formal WASM and run the unchanged full regression and production-preservation verifier.

Public MCST files, fonts, full public snapshots, binaries and WASM are not copied. The external input manifest pins the immutable inputs; tests refer to repo build paths. All owned Hancom11 fixtures are copied.

MCST actual Hancom16-page oracle and strict HWPX own two-cycle preservation are separate from historical converted-vs-actual 21,310 geometry differences. HWP crossing remains unsupported. The formal76 generic production semantic guard currently does not reject its 188/125 geometry damage; the new WASM verifier preserves those failures, pending root correction. No passing cross-format claim is made.

Earlier wide-v2 proof was rejected because source!=IR does not prove failed restoration. v1/v3/v4 serializer experiments remain rejected; compact summaries preserve their real failures. In-page source1000->IR1100 and actual API edit-predecessor full-geometry/model contrasts pass. The API edit synchronously rebuilds lines and need not leave a dirty boolean true; first harness assumption failure is retained.

Reproduction needs the original repo dependency runtime and immutable engine source. Rust tests and shell runners are included. The ignored verifier imports production preservation and hancom-review directly. Do not alter0.2 tolerance, published fields, actual source hashes, or external metadata.
