# GPT·Claude·Gemini 연결과 편집 기능 확장

기준: 2026-10-11. 이 문서가 제공자 연결과 이번 확장의 최신 상태다. 이전 단계의 검사 기록은 당시 범위를 뜻한다.

## 실행과 연결

문서를 저장한 뒤 루트의 `Restart-Jueony.cmd`를 실행한다. `Start-Jueony.cmd`는 일반 시작용이다. 현재 PC에서는 PowerShell과 동봉 Node.js 22 서버, Edge/Chrome 창을 사용한다. 기본 주소는 `http://127.0.0.1:4173/`다.

1. 상단 **AI 연결 설정 → 새 연결**을 누른다.
2. 제공자를 고른다. 공식 기본 endpoint는 자동으로 채워진다.
3. 계정에서 사용할 수 있는 **실제 모델 ID**와 API 키를 입력한다. 모델 이름을 추측해 기본 선택하지 않는다.
4. **연결 저장**을 누른다. Windows 암호화 저장을 선택하면 다음 실행에서도 복원된다.
5. 저장된 연결을 선택하고 **연결 테스트**를 실행한다. 이 테스트는 합성 요청 1회이며 문서·대화·자료를 보내지 않는다. API 사용량은 발생한다.
6. 채팅 위의 연결과 모델을 고른 뒤 요청한다. 설정창에서는 여러 연결을 선택해 개별 수정·키 교체·삭제할 수 있다.

새 키로 테스트만 하면 그 키는 저장하지 않고 입력창을 비운다. 계속 사용하려면 다시 입력해 저장한다. 같은 API 방식과 같은 endpoint에서 모델만 변경할 때는 기존 키를 유지한다. endpoint나 API 방식을 바꾸면 키를 다시 입력해야 한다. 저장된 키 원문을 브라우저로 되돌려 보내지 않는다.

| 표시 | adapter ID | 기본 endpoint | 입력할 모델 |
|---|---|---|---|
| GPT · OpenAI Responses | `openai-responses` | `https://api.openai.com/v1` | 계정에서 지원하는 Responses/JSON schema 모델 ID |
| Claude · Anthropic Messages | `anthropic` | `https://api.anthropic.com/v1` | 계정에서 구조화 출력을 지원하는 모델 ID |
| Gemini · Google AI Studio | `gemini` | `https://generativelanguage.googleapis.com/v1beta` | `models/` 접두사 없는 모델 ID |
| HyperCLOVA X · NAVER | `hyperclova` | `https://clovastudio.stream.ntruss.com/v3/chat-completions` | 승인된 HCX 모델, 기본 HCX-005 |
| OpenAI 호환 Chat Completions | `openai-compatible` | 사용자가 설정 | 해당 서버 모델 ID |

세 새 adapter는 공개 서비스의 API 키 인증용이다. Azure OpenAI, Bedrock, Vertex AI OAuth를 이 이름으로 지원한다고 간주하지 않는다. 기관 프록시는 해당 API 규격·인증·TLS가 일치해야 한다. 일반 인터넷 API는 폐쇄망 운영 환경을 대신하지 않는다.

## 코드 경계와 동작

UI → `run-once.ts` → `LLMPort` → 인증된 로컬 서버 → `providers/registry.mjs` → 각 adapter다. 모델 응답은 공통 `{message,sourceIds,operations}`로 반환한다. 문서 적용은 공통 의미 검사와 revision 검사 후 기존 `SnapshotCommand`를 통해 한 번 수행한다. SDK는 추가하지 않았다.

| 파일 | 책임 |
|---|---|
| `apps/launcher/providers/openai-responses.mjs` | Responses 고유 요청·인증·완료/거부 판정 |
| `apps/launcher/providers/anthropic.mjs` | Messages 고유 헤더·system·output_config 변환 |
| `apps/launcher/providers/gemini.mjs` | GenerateContent URL·systemInstruction·parts 변환 |
| `apps/launcher/providers/native-common.mjs` | TLS/설정 검사, schema 투영, HTTP 제한, 공통 오류 |
| `apps/launcher/providers/registry.mjs` | 5가지 adapter factory 등록 |
| `apps/editor/src/mvp/provider-presets.ts` | 설정 화면의 표시 이름·기본 주소·입력 안내 |

OpenAI에는 `store:false`, `text.format`의 strict JSON schema를 사용한다. 필수/nullable 변환 뒤 선택적 서식 속성의 null만 “변경 안 함”으로 정규화한다. 알 수 없는 명령이나 속성은 삭제해 숨기지 않고 앱에서 거절한다. [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses).

Claude에는 `anthropic-version:2023-06-01`, `x-api-key`, `output_config.format`을 쓴다. thinking 블록은 편집 결과에 합치지 않으며 거부·토큰 한도·tool_use 응답을 적용하지 않는다. [Messages](https://platform.claude.com/docs/en/api/messages/create), [Structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs).

Gemini에는 `x-goog-api-key`와 확인일 REST 문서의 `generationConfig.responseFormat.text`를 쓴다. 키를 URL에 넣지 않는다. 차단·잘림·thought·함수 호출을 편집 JSON으로 취급하지 않는다. GenerateContent 문서는 Legacy로 표기되어 있어 API 계열 변경은 별도 adapter 검증 후 진행한다. [REST 구조화 출력](https://ai.google.dev/gemini-api/docs/generate-content/structured-output?hl=en), [API 참조](https://ai.google.dev/api/generate-content).

새 adapter의 제한은 요청 90초, 응답 1 MB, 출력 토큰 기본 8192/설정 128~32768이다. 실제 모델 한도보다 높게 입력하면 제공자 오류가 될 수 있다. 응답이 잘리거나 구조화 출력 미지원이면 편집하지 않는다. redirect·자동 재시도·제공자 자동 전환은 없다. 키와 원격 오류 본문을 일반 로그에 남기지 않는다. 로컬 테스트 이외의 HTTP endpoint는 거절한다.

## 이번에 확장한 편집 명령

공통 명령은 14종이다. 기존 10종에 단순 표의 행/열 삽입·삭제 4종을 추가했다.

| 명령/속성 | 실제 지원 | 남은 제한 |
|---|---|---|
| `insert_table_row`, `insert_table_column` | 앞/중간/끝 삽입과 셀 값 지정 | 병합·중첩·다중 문단·혼합 서식 셀 제외 |
| `delete_table_row`, `delete_table_column` | 0부터 시작하는 index의 행/열 삭제 | 마지막 행/열 삭제 거절, 재배치는 미지원 |
| `set_table_cell` | 긴 내용 교체, 빈 문자열로 비우기, 다시 입력 | 셀당 4,000 코드포인트, 단일 문단 |
| `format_characters`, `format_table_cells` | 글꼴 이름, 장평 50~200%, 자간 -50~50%, 위/아래첨자 | 장평·자간 정수, 위/아래첨자 동시 지정 거절 |
| 기존 본문·서식·쪽 설정 | 동일하게 지원 | 세부 범위는 [기능 목록](ai-editor-capability-matrix.csv) |

행/열 변경 결과는 50행·20열·200셀 이내다. 삽입 index는 그 위치 **앞**, 마지막 index는 덧붙이기다. 새 표의 `@resultId`를 같은 요청에서 후속 편집할 수 있다. 가상 표에서 이후 명령의 좌표·원문을 미리 검사하고, 엔진 적용 후 실제 셀 행렬을 확인한다. 실패하면 요청 snapshot으로 복원하며 실패 상태를 구분한다.

기존 셀 교체가 엔진의 짧은 문자열 전용 API에 의존하던 문제를 수정했다. 삭제→삽입→기존 글자 모양 복원으로 긴 내용과 빈 셀을 처리한다. 글꼴 이름은 언어별 font ID에 연결한다. 글꼴 파일을 추가한 것은 아니므로 PC/렌더러에 해당 글꼴이 없으면 대체될 수 있다.

빈 본문에 텍스트를 넣고 같은 요청에서 글자 서식을 적용하는 경우도 수정했다. 검증은 명령 순서대로 바뀐 본문을 추적한다. 반대로 본문을 완전히 비운 뒤 글자 서식을 요구하면 적용 전에 거절한다. 빈 셀의 글자 서식도 텍스트를 채운 뒤 적용한다.

예: “첫 표의 마지막에 담당 열을 추가해줘”, “첫 표의 두 번째 행을 삭제해줘”, “제목을 맑은 고딕 16pt 굵게, 장평 95%로 해줘”. 이는 지원 명령의 예이며 모델이 항상 올바르게 해석한다는 보장은 아니다. 생성 문서는 새 문서 작성 후 후속 요청으로 꾸민다. 병합 셀·개체·문단 재배치·자동 저장을 실행했다고 표시하지 않는다.

## 폴더 없는 참고 첨부

채팅의 **＋ 참고 파일**, 채팅 영역에 파일 드래그, 입력창에 파일 붙여넣기를 지원한다. HWP/HWPX는 엔진 텍스트 추출, TXT/MD는 UTF-8로 읽는다. 이미지 OCR·PDF·DOCX·XLSX는 지원하지 않는다. 일반 텍스트 붙여넣기는 기존 입력 동작을 유지한다.

첨부는 현재 업무/채팅에만 속한다. 다른 채팅에는 전송되지 않고 돌아오면 목록이 유지된다. ×로 제거한다. 현재 브라우저 세션의 임시 파일이며 새로고침·앱 종료 시 해제된다. 원본을 복사하거나 수정하지 않는다. 대화 기록에는 이름·해시·실제 전달 문자 수·추출 한계를 남기고 원본 bytes를 넣지 않는다. 첨부 시점의 파일을 읽으므로 이후 원본 변경은 재첨부해야 한다. 연결 폴더의 열린 문서는 기존처럼 미저장 최신 내용을 우선한다.

개별 파일 16 MB, 임시 첨부 전체 64 MB, 요청당 연결 자료+첨부 합계 20개/120,000자다. 제한/미지원 형식/해독 오류를 조용히 생략하지 않고 요청 전에 알린다. 자동 색인이나 RAG가 구현됐다는 뜻은 아니다.

## 검증 상태

[검사 기록](evidence/native-agent-2026-10-11/README.md)에 단위·브라우저·공개 문서 검사와 실호출 여부를 구분했다. 세 새 제공자는 **합성 HTTP fixture 검증 완료 / 실제 API 키를 사용한 호출 미검증**이다. 키가 등록되면 연결 테스트 후 초안→후속 편집→undo→저장을 계정별로 확인해야 한다. fixture가 모델의 편집 품질을 입증하지는 않는다.

계정 접근이 없는 제공자까지 성공했다고 표시하지 않는다. 자동 RAG·Agent loop·외부 MCP·한글 100% 호환성은 이번에 완료되지 않았다. 그 다음 작업은 [Agent 설계](22-agent-retrieval-execution-design.md)와 기존 기능 목록에 남겼다.
