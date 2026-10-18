# N001 일반 복합 배치 자체 시험 문서

외부 업무 문서를 사용하지 않고 만든 HWP22개와, 고정124 엔진으로 변환한 HWPX22개다. 표1~4개, 본문 교차, 본문처럼 취급하는 표/떠 있는 표, 위치 이동, 여러 쪽, 균등·비균등2~3단을 조합한다. 파일별 원시 SHA256과 설정은 `manifest.json`에 있다.

`generate-own.rs`는 고정124의 공개 새 문서·본문·표·셀 API로 내용을 만든다. 시험 원형을 만드는 단계에서만 문서 모델의 표 배치·쪽·단 속성을 설정하고 일반 HWP로 직렬화한다. 이후 검수는 그 파일을 새로 연 뒤 공개 편집·저장 API만 사용한다. 사설 행 캐시·lease·descriptor·소스 권한 표식을 만들거나 고쳐서 성공시키지 않는다.

Native 생성기는 동일124 Rust 소스의 `rhwp` 의존성을 쓰는 별도 Cargo 실행본으로 실행하고 `N001_FIXTURE_OUTPUT`에 새 출력 폴더를 지정한다. `root-generator-reproduction-proof-lf.json`은 현재 추적하는 정확한 LF 생성기 소스를 직접 컴파일하여 HWP22개가 원래 파일과 바이트까지 같음을 기록한다. 먼저 실행한 CRLF 생성기와의 원문·정규화 지문 차이는 `generator-line-ending-provenance.json`에 별도로 남겼다. HWPX 재생성은 `generate-xml125.mjs`를 사용하며, 지정한 `JUEONY_ENGINE_PACKAGE`의 WASM 지문이 정확한124인지 강제한다. 후보 엔진으로 검수 입력을 다시 만들지 않는다.

원래 Native→HWPX 변환에서 이미 있던 배치 차이는 `initial-conversion-observations.json`에 그대로 남겼다. 두 형식은 별개의 고정 입력이며, HWPX 입력이 Native와 처음부터 같았다고 주장하지 않는다.

검사는 `apps/editor/scripts/verify-general-layout-corpus125.mjs`로 실행한다. `JUEONY_ENGINE_PACKAGE`와 `JUEONY_TEST_OUTPUT`에 절대 경로를 지정한다. 이 검사는44개 고정 입력의 본문 재조판, 양형식 저장, 공개 의미·지면 전체 비교, Undo/Redo, 디스크 재열기와 후속 편집·저장을 요구한다. 저장 거절이나 배치 차이는 실패다. 실제 한글 화면·인쇄 비교를 대신하지 않는다.

이 자체 시험 자산에는 저장소의 라이선스를 적용한다. 사용한 rhwp 소스의 MIT 고지는 원본 엔진과 함께 유지한다.
