# Claude 실제 연결 및 편집 검증

모델: `claude-sonnet-5-5`, endpoint: `https://api.anthropic.com/v1`.

## 실제 원인

사용자 화면에는 401이 표시됐지만, 저장된 연결을 다시 호출했을 때는 400/schema 오류였다. 실제 제공자 응답은 `invalid_request_error`와 "The compiled grammar is too large, which would cause performance issues. Simplify your tool schemas or reduce the number of strict tools."였다. 선택 속성을 0개/union을 5개로 줄인 첫 수정도 내부 규칙 크기 제한에 걸렸다. [공식 문서](https://platform.claude.com/docs/en/build-with-claude/structured-outputs#schema-complexity-limits)는 명시적 개수 제한을 만족해도 내부 복잡도 제한을 넘을 수 있다고 설명한다.

최종 수정은 `{kind,arguments}` 명령 포장이다. `arguments`의 JSON 문자열을 객체로 복원한 뒤 기존 문서 의미 검증을 그대로 실행한다. 외부 schema의 선택 속성과 union은 모두 0개이며 내부 인자는 애플리케이션에서 검증한다. 401/403 안내를 구분하고 실제 `compiled grammar` 문구도 복잡도 오류로 분류한다.

## 검증 결과

- 서버·provider 단위 검사: 43개 통과.
- 편집기·WASM·Agent 검사: 43개 통과. 새 Claude 인자 포장이 잘못된 대상/범위/출처/타입/미지원 속성 검사를 우회하지 못하는 회귀 검사 포함.
- 모의 HTTP provider 브라우저 검사: 9개 시나리오 통과. `native-ui.json`.
- 수정 adapter의 실제 연결 probe: 성공, 사용자 문서 전송 없음.
- 별도 브라우저/서버의 실제 모델 요청 2회: 7개 시나리오 통과. `result.json`.
  - 자연어로 세 문단의 새 문서 작성.
  - 본문 교체, 16pt 굵게, 2×2 표 생성, A4 가로/왼쪽 여백 20mm를 한 요청에서 적용.
  - 구조 변경 비교, HWP 다운로드 저장, 요청 단위 undo.
  - 저장한 HWP 및 엔진에서 변환한 HWPX를 편집기에서 재열어 본문·서식·표·쪽 설정을 재확인.
- 사용자 실행 서버(4173)에도 수정 adapter를 적용하고 실제 연결 probe 성공을 확인했다. 서버 프로세스·세션 토큰·열린 편집기를 유지했다.
- 최신 연결 2개를 Windows DPAPI로 보존하고 별도 프로세스에서도 복원되는 것을 확인했다. 키·원격 오류에 포함될 수 있는 비밀값은 증거에 남기지 않았다. 임시 암호화 복사본과 진단 연결은 정리했다.

## 한글에서 확인할 파일

- [HWP](claude-applied.hwp): 실제 편집기 저장 흐름으로 내려받은 결과.
- [HWPX](claude-applied.hwpx): 위 HWP를 동일 엔진에서 변환한 결과.
- [재열기 화면](applied.png), [변경 비교 화면](diff.png).

실제 한컴 한글에서의 재열기는 아직 검사하지 않았다. 단일 합성 문서의 성공이며 모든 요청·복잡한 문서의 품질을 보장하지 않는다. GPT/Gemini 실계정 검증 결과를 뜻하지 않는다.

## 재현

`apps/editor`에서 Node.js 22로 `scripts/verify-claude-live.mjs --live`를 실행한다. 암호화 저장소에 Claude 연결이 정확히 하나 있어야 한다. 별도 저장소를 사용하려면 `--store <암호화 파일 경로>`를 지정한다. 합성 문서만 전송하며 요청 2회는 API 사용량을 발생시킨다. 자동 재시도는 없다. 결과는 `apps/editor/evidence/claude-live`에 저장된다.
