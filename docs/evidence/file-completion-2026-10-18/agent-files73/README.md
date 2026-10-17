# Agent 파일 기능 검수 · 정식73

정식 엔진 `source-5c509946c79e331e`, WASM SHA256 `de82cfa5b974a07c1799a253c38a26323a498a7c2731466ae4a6c4c63f031bc6`와 `dist-agent-files-final73`의 검수 증거입니다. Native 6/6, 실제 Edge 12/12, 전체 단위 898/898(실패·skip 0), TypeScript·모듈 경계 통과입니다. 공급자 계약 52/52는 같은 동결된 Agent/provider 코드로 따로 검수했습니다.

실제 production 외부 채팅 입력, Native WASM, 문서 변경 history·Agent undo·수동 redo/undo, Canvas 기하 최대 오차 0.2, workspace IndexedDB를 사용했습니다. 모델 응답은 로컬 loopback 합성 공급자이며 openai-compatible/OpenAI Responses/Anthropic/Gemini 네 프로토콜을 확인했습니다. 네이티브 picker·disk IPC는 명시적인 합성 fixture입니다. 실제 API 계정/키, 사용자 문서, 실제 OS 저장·종료 조작의 증거가 아닙니다.

지원 범위는 현재 문서 정보 읽기, 요약의 제목·주제·작성자·키워드·설명 다섯 필드 변경, 현재 업무 탭 조회·새 탭·선택·수정하지 않은 탭 닫기입니다. 디스크 경로/파일 handle/다른 업무 권한을 모델에 주지 않습니다. OS 열기·최근 문서·저장·다른 이름 저장·환경 설정·복구 실행·수정한 문서 폐기·프로그램 종료·별도 OS 창은 Agent에 연결하지 않았습니다. `fullFileAgent` 완료로 표시하지 않습니다.

탭 명령 중 공개 mutation API 잠금, 중첩 lease 해제, 실패 후 재실행 금지, IDB abort의 탭/바이트/history/체크포인트 보존, 실제 유효 SHA256 새 복구본과의 정확 CAS 거절을 검수했습니다. 자동 checkpoint 타이머는 사용자 저장 환경 설정으로 꺼서 명시적 닫기/CAS 거래를 격리했습니다. 자동 저장/앱 종료 수명 전체 검수는 별도 자료입니다.

`initial-readiness-failure.json`은 최초 11 PASS/1 FAIL을 보존합니다. 새 업무의 iframe API가 존재하더라도 탭은 아직 ‘문서 준비 중…’일 수 있었으며 production은 준비 메시지로 전송을 거절했습니다. 검수기의 전제를 실제 활성 탭 이름과 API 이름, 저장된 업무/activeDocumentId/문서 checkpoint 일치까지 기다리도록 수정했습니다. 최종 본문·cursor·selection·Canvas geometry 비교와 거절 assertion을 삭제하거나 완화하지 않았습니다. 최초 원본 결과·캡처는 ignored build 경로에 그대로 남습니다.

`browser12.json`/실패 JSON은 원래 results·failures·observations·엔진/빌드 지문을 보존하고 반복되는 큰 Native 구조 투영만 제외했습니다. 원본 SHA는 `selection-provenance.json`에 있습니다. `request-cases.json`에는 실제 모델 입력의 요약·탭 문맥을, `runtime-receipt-messages.json`에는 production이 작성하고 다음 모델 문맥으로 전달한 실제 assistant 메시지를 선별했습니다. 이들은 OS 파일 저장 영수증이 아닙니다.

재현 검수기와 관련 단위 원문은 `reproduction/`에 바이트 그대로 보존했습니다. 상대 import가 있으므로 해당 저장소 원래 `apps/editor/scripts/` 및 `tests/` 위치의 SHA 일치 버전을 사용합니다. `apps/editor`에서 Node 22로 실행하며 `JUEONY_ENGINE_PACKAGE`, `JUEONY_TEST_DIST`, `JUEONY_TEST_OUTPUT`은 절대 경로로 지정합니다. `verify-agent-files.mjs`는 `JUEONY_TEST_PORT=4480`, `JUEONY_PROVIDER_PORT=4481`의 사용하지 않는 loopback 포트를 사용합니다. Native 검수기는 Node의 `--experimental-strip-types`가 필요합니다. 프런트/엔진 manifest와 소스 SHA를 먼저 맞추고, 새 출력 폴더에서 실행합니다. 자체 fixture만 사용하며 원문·PDF·폰트 프로그램·브라우저 프로필·실행 파일은 봉인하지 않았습니다.
