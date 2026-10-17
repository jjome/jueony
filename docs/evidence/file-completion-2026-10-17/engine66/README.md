# G073 단일 표 바깥 여백 — 영구 증거 후보

이 묶음은 저장소에서 직접 만든 합성 문서 17개(원본 회귀 자료 15개와 부모 작업자가 실제 한글 2024로 저장한 outer 사본 2개), 부모의 실제 열기/저장 화면 4개를 포함합니다. 공개·사용자 문서, 글꼴 프로그램, WASM/EXE, 전체 문서 snapshot은 포함하지 않습니다. fixtures/manifest.json은 전체 17개 입력의 SHA와 역할을 기록합니다.

최종 private 후보는 Native 10/10, Node 31/31 통과했습니다. 실제 한글 HWP·HWPX 사본과 의미 및 전체 공개 배치 필드의 차이는 각각 0이며, 수치 허용 범위는 기존 0.2px입니다. 첫 후보의 28 PASS/3 FAIL과 최종 결과는 validation-summary.json에 함께 보존했습니다. 원본 4개 SHA, 전체 압축 해제 native BodyText SHA, 변경 Rust 파일과 패치 SHA도 포함합니다. 공식65 source 대상 git apply --check는 읽기 전용으로 통과했습니다.

현재 기록은 private 후보 검수 결과입니다. root의 정식 승격/합본 검수 결과와 구별해야 합니다. 부모가 기존에 실제 GUI로 만든 사본을 독립적으로 다시 읽어 비교했으며, 이 작업자가 새 GUI 조작이나 화면/인쇄 전체 동등성 판정을 한 것은 아닙니다.

## 공식 검수 재현

저장소 루트에서 Node22 이상과 기록된 해시가 일치하는 pkg를 사용합니다. WASM은 별도 제공하지 않습니다. 실제 출력 폴더는 매번 비어 있는 새 경로를 지정합니다. 이 명령은 원본을 읽고 별도 출력에만 저장합니다.

```powershell
$env:JUEONY_OUTER_FIXTURES = '<이 묶음의 절대경로>/fixtures'
$env:JUEONY_ENGINE_PACKAGE = '<검수 대상 정식 또는 private pkg 절대경로>'
$env:JUEONY_BASELINE_ENGINE_PACKAGE = '<공식63 source-8deeb52a09ba2b75/pkg 절대경로>'
$env:JUEONY_TEST_OUTPUT = '<새 검수 출력 절대경로>'
node --experimental-strip-types apps/editor/scripts/verify-table-outer-hancom.mjs
```

검수 대상은 JS/WASM 파일의 실제 SHA를 package metadata와 확인한 뒤 실행합니다. production 공식 검수기는 root 소유이며 reproduction/formal-verifier-at-review.mjs는 검토 당시 사본과 SHA를 보존합니다. 원래 private 검수기는 reproduction/original-verifier.mjs이고, verify-permanent.mjs는 원래 기대값을 유지하며 import와 입력 경로만 외부 경로로 받을 수 있게 만든 보조 사본입니다.

Native10 재현은 patch 적용 private source에서 reproduction/run-focused-rust.sh의 g048_ 필터와 expected10으로 실행합니다. JUEONY_OUTER_FIXTURES는 fixtures를 가리켜야 합니다. 이 묶음의 패치는 당시 formal63 기준이며 공식65에는 apply --check를 수행했습니다. 빌드·승격은 부모 작업자가 관리하며 이 묶음 생성 중 Cargo/Git/production 소스는 변경하지 않았습니다.
