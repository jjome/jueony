# XML 원본 캐시의 HWP 저장 대칭 후보 v7

공식81 `source-5fd129829b65b02d`의 Rust1063개 중 document.rs/body_text.rs 두 파일만 바뀝니다. renderer/기존 보호 가드는 동일합니다. 독립68 글꼴 및69 역사적 HWP5 계보 수정은 공식81에 포함된 그대로입니다. strict apply 출력과 실제 컴파일 include 바이트 SHA가 정확히 같습니다.

- 최종 Native11/11 PASS, ignored0: 실제한글이 만든 MCST HWPX16쪽→HWP16쪽 전체 published layout0, 역사적 변환 HWPX15쪽→HWP15쪽0, HWP/HWP/HWPX/HWP/HWPX/HWP 교차6단계0.
- 자체 문서 편집/원본불변/snapshot Undo·Redo, bit24 soft hyphen·bit31 fixed space의 literal/control 출처, 불명확/충돌 marker, unsafe generated cache, dirty/unresolved-tab LINE_SEG 생략을 검수했습니다. 조회된 rawID와 필드를 버려 통과시키지 않았습니다.
- 실제 한글2024가 위 HWP를 다시 HWPX로 저장한 독립 oracle는 **FAIL**: 세 파일 모두16쪽이나 HWP→한글후 published5843차이(원시ID2400/나머지3443)가 남았습니다. 각주/미주의 원시 separator_length/위여백 차이도 남습니다. Hancom후 파일의 후보 HWP/HWPX 자체 저장재열기는0차이입니다.
- 별개 공개원본 MCST HWP(c61a…)→실제한글 HWPX(20a396…)의15→16쪽/geometry21310/semantic4 차이는 이 후보로 해결했다고 주장하지 않습니다. 역사적 변환본 cef8…의 동일 Hancom 대조도 별개 FAIL입니다.
- Native raw 모델 비교는 TS production `capturePreservationEvidence`의 resolved semantic reader와 다릅니다. 공식82 WASM/production guard 및 전체회귀 검수가 별도로 필요합니다. 파일파트 전체/N002/실제한글 조판 동일성 완료를 뜻하지 않습니다.

새 marker는 정확한 `2:xml-import-v1`이며 기존 b1/불명확 원본/HWP3/HWP5 충돌은 새 권한을 얻지 않습니다. 전체 XML 문단 normalizer를 HWP에 재적용하지 않고 필요한 빈 source-cache 재구성만 분리합니다. 원래 XML이 가지지 않았던 순수 생성 본문 캐시는 disposable snapshot에서만 생략하고 HWP writer는 완전한 retained physical-position map만 낮춥니다. 기존 dirty/tab guards는 유지됩니다.

재현은 `build/mcst-cross-closure77/source-import-v7-compact80`의 explicit integration targets와 동봉된 하니스/실행 스크립트를 사용합니다. 원본·공개 파생 HWP/HWPX·전체 snapshot·폰트 프로그램·WASM은 이 묶음에 없습니다. 실제한글 검수 산출물은 ignored build에만 있고 입력 SHA/수치/값해시만 보관합니다. 원시 실패 근거는 덮어쓰지 않았습니다.
