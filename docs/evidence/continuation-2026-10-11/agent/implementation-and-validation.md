# 선택 자료 검색과 적용 전 bounded 검토 실행

2026-10-11. 기준 commit `06f5a396e98747def012ca68b51a76524784db1f`. 사용자가 기반 작업 이후 자율 진행을 승인하여 독립적인 Agent 확장을 선택형으로 구현했다. 한글 2024의 독립 검수와 G2 전체 관문을 통과했다고 표시하지 않는다.

## 구현 범위

### 명시 선택 자료의 로컬 검색

`src/retrieval/selected-sources.ts`의 요청별 메모리 색인은 `readReferences`가 현재 업무·채팅의 명시 선택 파일/폴더와 임시 첨부에서 읽은 자료만 입력받는다. 폴더를 추가 탐색하거나 다른 업무에서 자료를 자동 가져오지 않는다. 요청마다 새로 생성하므로 선택 해제·원문 변경 후 이전 색인이 남지 않는다. 영구 DB, embedding, vector 검색, 외부 검색 서버는 추가하지 않았다.

자료를 최대 1,000 UTF-16 단위의 구간으로 나누되 가능한 줄 경계를 선택하고 surrogate 쌍/CRLF를 분리하지 않는다. 검색 텍스트만 NFKC·소문자로 정규화한다. 인용 내용은 원문 그대로이며 0부터 시작하는 `[start,end)` offset, 1부터 시작하는 추출문 줄 번호, 원본 SHA-256, 구간 SHA-256을 반환한다. HWP/HWPX 추출문 줄 번호는 한글의 쪽/표 셀 좌표가 아니다.

전체 단어·문자열과 한국어 2글자 부분 문자열을 사용한 lexical 점수에 파일명 일치와 역문서 빈도를 반영한다. 형태소 분석기 또는 의미 기반 검색으로 표현하지 않는다. 최대 **8구간, 본문 8,000자, 원본별 3구간**을 전달한다. 관련 구간이 없으면 참고 본문을 보내지 않고 안내한다. 점수는 확률이나 사실 검증 결과가 아니다.

`mvp/context.ts`의 기존 `buildContext`는 기본 전체 선택 자료 전달을 유지한다. `buildRetrievedContext(...,signal?)`가 선택형 검색을 적용해 `{context,retrieval}`을 반환한다. 검색 출처 ID는 chunk ID이며 root UI는 최종 `context.references`의 메타데이터를 실행 기록에 넣어 모델이 반환한 `sourceIds`와 연결한다. `RetrievalSummary`에 전송량, 선택 자료 수, 검색 구간/위치/hash, 제한을 포함한다.

### 최종 명령 한 번 적용

`src/agent/run-bounded.ts`는 모델 호출과 편집 실행을 분리한다. 첫 후보 생성 → 공통 명령 검증 → 후보 재검토를 최대 **3회 모델 호출** 안에서 수행한다. 같은 명령과 출처 집합이 반복되면 두 번째 응답에서 종료한다. 메시지 표현이나 객체 키 순서의 차이는 명령 변경으로 보지 않는다.

중간 후보는 메모리에만 보관하며 실제 문서를 수정하지 않는다. 모든 후보는 원래 문서 revision과 제공된 출처 ID를 기준으로 검사한다. 마지막 검증 후보만 기존 공통 `commitGeneration` 경계로 보내고, 엔진 `preflight`가 있으면 사전 검사 후 revision을 다시 확인한다. 새 문서는 최종 적용 단계에서만 만든다. 일반 문서 적용은 기존 요청 ID와 SnapshotCommand/receipt 경로를 그대로 사용한다.

이 구현은 명령 계획을 재검토하는 bounded workflow다. 모델이 다음 read/search 도구를 선택하는 일반적인 자율 tool loop가 아니다. 현재 공통 LLM Port는 Generation만 지원하므로 존재하지 않는 read tool이나 임의 파일/네트워크/셸 도구를 모델에 표시하지 않는다. Provider adapter에 반복 실행이나 검색을 넣지 않았다. 같은 Port와 공급자 연결을 사용한다.

기본 시간 한도는 120초, 누적 입력 문자 한도는 1,500,000자이며 호출 상한은 3회다. 토큰/금액 계량을 구현했다고 표시하지 않는다. 문서/업무 전환, 사용자 편집, 취소, 시간/입력 한도, 잘못된 명령·출처, 제공자 오류, 사전 검증 실패에서는 중간 계획을 적용하지 않는다. 제공자 또는 read-only preflight가 취소를 무시해도 기다림을 중단하고 늦은 결과를 버린다. 이미 시작한 실제 apply를 Promise 경쟁으로 끊어 미적용으로 잘못 표시하지 않는다. 제공자가 이미 처리한 요청의 과금 취소까지 보장하지는 않는다.

`mvp/run-once.ts`는 기본 한 번 호출을 유지하며 검증된 `generation`을 반환하도록 확장했다. bounded도 동일한 최종 generation을 반환하여 root의 반복 작업 기록/재실행이 별도의 문서 쓰기 경로를 만들지 않게 한다. 진행 이벤트에는 호출 수·단계·경과 시간·입력 문자 수·명령 수만 담고 API 키나 원문을 추가하지 않는다.

## 검증

```powershell
node --experimental-strip-types --test apps/editor/tests/retrieval.test.ts apps/editor/tests/agent-bounded.test.ts apps/editor/tests/agent-bounded-engine.test.ts apps/editor/tests/agent-flow.test.ts apps/editor/tests/agent-commands.test.ts
node --experimental-strip-types docs/evidence/continuation-2026-10-11/agent/evaluate-retrieval.mjs
```

[전용 및 기존 회귀](agent-tests.txt): **35개 통과**, 실패·건너뜀 없음.

- 검색 8개: 원문/위치/hash, 동일 입력의 결정성, 업무·채팅 격리, 한국어 구간 선택, 예산, 무검색 결과, 취소·버전/중복 거절, 자료 해제·갱신, 기존 Context 유지.
- bounded 11개: 2회 조기 종료/3회 상한, 최종 단일 적용, 취소/문서 수정/업무 전환, 불법 명령·출처 거절, 시간/입력 한도, preflight 실패/충돌/대기 취소, 새 문서 단일 생성, single 유지.
- 실제 WASM 1개: 중간 모델 호출 동안 본문 무변경, 최종 제목만 적용, 기존 표 보존, HWP/HWPX 재열기, 요청 snapshot undo 복원. 실제 브라우저 입력·렌더링·한글 출력의 검증을 대신하지 않는다.
- 기존 Agent 흐름 및 문서 명령 회귀 15개.

[합성 검색 평가](retrieval-evaluation.json): 합성 업무 자료 6개, 82,668자, 정답 근거를 지정한 질문 12개에서 필요한 구간을 12/12 찾았다. 평균 전달 본문은 5,739자이며 없는 검색어는 0구간이었다. 작은 합성 자료의 구간 포함 여부 검사다. 실제 기관 문서 검색 품질, 모델 작성 품질, hallucination 감소, single 대비 성능 향상이 검증됐다는 뜻은 아니다. 입력량도 토큰이나 API 비용으로 환산하지 않았다.

실제 모델/API 키·사용자 문서를 사용하거나 외부에 전송하지 않았다. 사용자 서버 4173/4190과 열린 문서는 조작하지 않았다. 공용 빌드와 shell/model/bridge/provider 변경은 통합 담당이 맡는다.

## 통합 검수와 다음 단계

1. UI 기본 single/전체 자료 전달이 기존처럼 작동하고, 검색·검토 옵션을 켰을 때만 새 흐름을 사용한다.
2. 선택 자료 두 개 중 관련 구간만 실제 요청 JSON에 들어가고, chunk ID와 원본 위치/hash가 실행 기록에 남는지 확인한다.
3. mock LLM 2~3회 동안 문서가 그대로이고 마지막에 한 번 적용·한 번 undo되는지 실제 편집기에서 확인한다.
4. 두 번째 호출 중 수동 편집·취소·업무 전환, 잘못된 출처·명령, 엔진 preflight 실패를 주입하여 문서 무변경을 확인한다.
5. HWP/HWPX 저장·재열기와 실제 한글 호환성은 별도 게이트로 유지한다. 병합/중첩 표 등 전체 편집 지원을 이번 Agent 실행기 완료와 혼동하지 않는다.
6. 더 큰 독립 자료/질문 세트에서 lexical 검색 누락을 평가한 뒤 영구 색인·구조별 chunk·hybrid/embedding을 검토한다. 실제 모델 single 대비 성공률/근거/지연/비용을 평가하기 전에는 bounded를 기본값으로 바꾸지 않는다.