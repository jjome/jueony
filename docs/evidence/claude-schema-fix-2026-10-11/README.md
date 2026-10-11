# Claude 구조화 출력 연결 오류 수정

> 첫 수정 당시의 기록이다. 이후 실제 호출에서 내부 grammar 크기 제한이 추가 확인되어 명령 형식을 다시 단순화했고, 실제 Claude 작성·편집·저장 검증에 성공했다. 최신 결과는 [Claude 실호출 검증](../claude-live-fix-2026-10-11/README.md)을 참고한다.

## 확인한 결함과 변경

- 사용자 보고: 크레딧 구매 후에도 Claude 연결 테스트가 HTTP 400으로 실패.
- 이전 코드는 오류 본문을 읽지 않고 취소하므로 실제 제공자의 상세 사유를 복원할 수 없었다.
- 공통 명령 schema의 선택 속성을 계산하면 44개다. Claude 공식 한도는 선택 속성 24개, union 매개변수 16개다.
- Claude 서식 명령의 속성을 요청된 `{name,value}` 항목 배열로 투영해 선택 속성 0개, union 5개로 축소했다. 공통 Agent/편집기 계약은 그대로 사용한다.
- 응답 정규화 시 미지정 속성 유지, false/0 보존, 중복 이름/타입/알 수 없는 속성 거절을 검증했다.
- HTTP 오류는 제한된 JSON 본문을 분류해 결제, schema, 모델, 인증, 속도, 서버 장애를 안내한다. 오류 원문과 키는 기록하지 않는다.

## 검증

- `launcher-tests.txt`: Node 서버/제공자 테스트 42개 통과.
- `native-ui.json`: 별도 브라우저 프로필과 모의 API 서버에서 9개 시나리오 통과. Claude 연결 테스트, 새 문서, 본문/서식/표 편집, 요청 되돌리기, 거부, 연결 저장 및 재시작 복원 포함. 외부 API 호출 0회.
- `scripts/Build-Standalone.ps1`: 수정 모듈을 포함한 실행 묶음 빌드 성공.
- 실제 Claude API 호출 성공은 아직 확인하지 못했다. 진단 중 실행 서버가 종료되어 수정본으로 복구했으며, 복구된 연결 목록에는 NAVER만 있었다. 편집기 창은 닫지 않았고 기존 암호화 파일은 지우거나 덮어쓰지 않았다. 사용자에게 문서 저장 및 Claude 연결 재등록을 요청했다. 실제 계정에서 재검증 전 성공으로 표시하지 않는다.
- 이 기록은 schema 제한 위반을 확인한 것이며, 최초 HTTP 400의 상세 서버 사유까지 확인했다는 뜻은 아니다.

## 근거

[Claude Structured outputs: Schema complexity limits](https://platform.claude.com/docs/en/build-with-claude/structured-outputs#schema-complexity-limits), 2026-10-11 확인.
