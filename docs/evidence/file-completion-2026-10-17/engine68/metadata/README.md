# B014 · 다섯 문서 요약 항목

공식68 `source-cda65172283c6657`에서 제목·주제·작성자·키워드·설명 편집, 한 번의 Snapshot Undo/Redo, HWP/HWPX 저장·재열기를 확인했다.

- 후보 Native Rust: **15/15 PASS**, ignored 0. 재현 원본과 로그를 보존했다. 공식68의 다섯 독립 메타데이터 소스 파일은 동일 텍스트이며 신규 파일의 CRLF/LF 차이는 raw SHA와 구분한다. `document.rs`에는 독립 G073 변경도 있어 전체가 같다고 주장하지 않는다.
- 공식 WASM 실제 API: **9/9 PASS**. 양방향 두 번 재열기, 정확한 다섯 값, 다른 전체 의미·모든 공개 지면 필드의 0.2 검사, 스냅샷, stale/no-op, UTF16 경계, 손실 보고서 0인 실제 메타데이터 손상 거절을 확인했다.
- 실제 격리 Edge: **10/10 PASS**. 실제 메뉴·입력창·Undo/Redo·원래 OPFS 파일에 Save·UI 재열기, Esc/no-op, stale·적용 후 오류의 원자 복원, 읽기 전용 UI, 손상 저장 거절·원문/dirty 유지·재시도를 확인했다. page/console/external 오류 0이며 두 개의 의도된 Save 오류는 별도로 기록했다.
- 독립 Python CFB PropertySet/OPF oracle: 자체 문서 두 형식의 다섯 값이 정확하다. Native getter를 재사용하지 않았다.
- 실제 한글 2024: 자체 `summary.hwp`의 다섯 항목 표시를 root가 직접 확인했다. PNG와 접근성 트리를 보존했다. 취소의 창 활성화 오류로 직접 입력을 중단했으며 **한글 SaveAs나 HWPX 속성 UI 검증 완료로 표시하지 않는다**.

단위 그룹과 Native/API/브라우저 검사는 서로 다른 검사 층이다. 이를 더해 기능 진행률을 만들지 않는다. 날짜·저장자·수정 이력 편집, 한글 통계 집계 동일성, Agent 명령 추가는 이 범위 밖이며 B014 전체 완료라는 뜻이 아니다.

## 보호와 제한

다섯 문자열만 항목별 4,096 UTF16 단위 이내로 편집한다. 단일 OLE/OPF 소유가 불명확하거나 손상되면 편집하지 않는다. 앱은 기존 password-save 문맥, 읽기 전용/양식 모드, 조합·revision·Native 문서 핸들과 raw 소유 CAS를 검사한다. 기존 복호 HWPX 파서는 원래 암호 여부를 IR header에 남기지 않으므로 Native API만의 암호 출처 판정으로 과장하지 않는다. 앱의 별도 password 문맥 검사는 유지한다.

전체 의미·지면/0.2와 저장 검사를 완화하지 않았다. generic preservation은 신규 API가 읽어 준 다섯 값을 정확히 비교하며, 새 API의 읽기 실패는 unreadable로 막는다. raw fingerprint는 OPF/CFB CAS용이며 의미 비교에 섞지 않는다. 알려지지 않은 OLE 속성과 메타데이터 span 안의 XML은 원시 보존을 별도 검증했다. 임의 메타데이터의 형식 간 매핑까지 구현했다고 주장하지 않는다.

## 기존 G073 baseline과 새 메타데이터 계약

`proofs/table-fixture-summary-oracle.json`은 기존 17개 자체 원본을 manifest 순서·SHA에 묶어 CFB/OPF에서 독립 해석한다. 파서 오류는 0이다. 원본은 기존 `engine66/fixtures`를 그대로 참조한다.

실제 한글 HWPX 사본은 원본의 빈 `<opf:title/>`을 **`앞 본문`**으로 채웠다. raw UTF8 `ec959e20ebb3b8ebacb8` 및 코드포인트까지 기록한다. HWP 사본의 known5 차이는 0이지만 HWPX 사본에는 title **1차이**가 있다. 이 둘을 모두 의미 0이라고 표시하거나 제목을 정규화하지 않는다.

unsafe HWPX 네 경로의 공식63→68 HWP 출력은 whole-file byte가 다르다. 독립 CFB/PropertySet 재구성으로 **author PID4 `edward`→원본 OPF의 `rhwp`** 매핑만 바뀌었음을 입증했다. 다른 9개 logical stream, unknown 9개 PID payload/padding, 원시 prefix/suffix와 속성 순서는 정확히 같다. source-SHA-bound 독립 값을 사용해 전체 Summary bytes를 재구성했고 새 bytes와 정확히 일치했다. 이로 인한 CFB 주소·배치 차이를 whole-file 동일이라고 부르지 않는다.

추가 음성 3개(BodyText raw 1byte, unknown PID9 1byte, 잘못된 원본 작성자 기대값)는 모두 거절한다. 고의 손상은 `unsafe-summary-diff`의 자체 사본에만 적용했고 원본은 불변이다.

## 재현

앱 원래 위치의 `verify-document-metadata-engine.mjs` / `verify-document-metadata.mjs`를 사용한다. `JUEONY_ENGINE_PACKAGE`, `JUEONY_TEST_DIST`(Edge), `JUEONY_TEST_OUTPUT`은 절대 경로로 지정하고 앱 디렉터리에서 실행한다. 검수기 원본과 SHA를 보존했으며 archived script의 상대 import는 원래 저장소 위치를 기준으로 한다.

Native 재현 원본 `document-metadata-native.rs`는 별도의 immutable-source 사본에 integration target으로 추가해 실행한다. 운영 Cargo나 기존 엔진 패키지를 수정하지 않는다. Python oracle과 exact CFB helper/반례 재현기도 포함했다. 공개·사용자 문서, 글꼴 프로그램, 실행 파일, WASM/SDK 바이너리는 이 묶음에 포함하지 않았다.

## 검수 helper의 BOM 원시 소유 보완

초기 test-only CFB reader의 TextDecoder 기본 BOM 제거를 발견해, 명시적 UTF16/UTF8 문자 디코딩에서 `ignoreBOM:true`로 내용 U+FEFF를 보존했다. 운영 엔진·앱 변경은 없다. 현재 네 경로와 음성 3개를 재실행했고 결과는 그대로다.

별도 음성 사본은 CFB Summary stream 이름에 U+FEFF를 붙였다. 초기 helper는 이를 제거해 다른 원시 이름을 alias로 받아들였지만, 최종 helper는 해당 사본을 거절한다. `helper-name-BOM-negative.json` 및 재현 원본에 이 차이를 남겼다. 초기 helper/초기 SHA manifest/결과는 `history/initial-helper-bom-policy`에 보존했으며 최종 코드 SHA와 구별한다. 이 추가 검사는 기존 15/9/10 기능 시나리오 수에 합산하지 않는다.
