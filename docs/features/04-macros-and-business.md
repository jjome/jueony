# 반복 작업·공무원 업무 양식

[← 종합 진행 현황](<../jueony-progress.md>) · [전체 검색](<../jueony-work-checklist.html>) · [완료 규칙](<../97-master-work-checklist.md>)

문서마당·상용구·기관 양식, 반복 명령, 매크로 기록·재생과 메일 머지.

## 진행 요약

실행 작업 **6개**, 상위 범위 **5개**. CSV의 기록을 기능별로 표시한 문서다.

| 구분 | 실행 작업 | 상위 범위 |
| --- | --- | --- |
| 구현 | 완료 3/6 · 부분 1 · 미구현 2 | 완료 0/5 · 부분 2 · 미구현 3 |
| 검증 | 완료 3/6 · 부분 0 · 미검증 3 | 완료 0/5 · 부분 2 · 미검증 3 |
| Agent 연결 | 연결 3/6 · 부분 0 · 미연결 3 | 연결 0/5 · 부분 0 · 미연결 5 |

☑ 완료/연결 · ◐ 부분 · ☐ 대기 · ? 재점검 · — 해당 없음. 검증 완료에는 필요한 한글 직접 비교도 포함한다. 구현 완료만으로 세 축 완료가 되지 않는다.

상위 범위는 세 축 완료 **0/5개**다. 세부 작업 완료 수와 분리해서 읽는다.

## 먼저 할 일

- **구현** [N038](<04-macros-and-business.md#n038>) **반복 작업의 표·개체 명령 확장** — 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀
- **구현** [N040](<04-macros-and-business.md#n040>) **기관별 공식 양식·공문 업무 흐름** — 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀
- **구현** [N039](<04-macros-and-business.md#n039>) **수동 편집 동작의 매크로 기록·재생** — 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀

## 기능별 작업표

관련된 상위 기능과 실행 작업을 함께 묶었다. 각 표는 최대 8개 항목이며, 완료된 항목도 같은 표에 유지한다. ID를 누르면 아래의 완료조건·근거로 이동한다. **범위** 행은 상위 점검, **작업** 행은 실행 작업으로 중복 집계하지 않는다.

- [문서마당](<#work-1>)
- [파일 · 상위 기능 점검](<#work-2>)
- [입력 · 상위 기능 점검](<#work-3>)
- [도구 · 상위 기능 점검](<#work-4>)
- [스크립트 매크로](<#work-5>)
- [검색·반복 · 독립 실행 작업](<#work-6>)

<a id="work-1"></a>

### 문서마당

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B003](<04-macros-and-business.md#b003>) · 범위 | 문서마당 | ◐ 부분 | ◐ 부분 | ☐ 미연결 |
| [N040](<04-macros-and-business.md#n040>) · 작업 | 기관별 공식 양식·공문 업무 흐름 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |

<a id="work-2"></a>

### 파일 · 상위 기능 점검

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B004](<04-macros-and-business.md#b004>) · 범위 | 문서 시작 도우미 | ☐ 미구현 | ☐ 미검증 | ☐ 미연결 |

<a id="work-3"></a>

### 입력 · 상위 기능 점검

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B081](<04-macros-and-business.md#b081>) · 범위 | 상용구 | ◐ 부분 | ◐ 부분 | ☐ 미연결 |

<a id="work-4"></a>

### 도구 · 상위 기능 점검

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B141](<04-macros-and-business.md#b141>) · 범위 | 메일 머지 | ☐ 미구현 | ☐ 미검증 | ☐ 미연결 |

<a id="work-5"></a>

### 스크립트 매크로

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B142](<04-macros-and-business.md#b142>) · 범위 | 스크립트 매크로 | ☐ 미구현 | ☐ 미검증 | ☐ 미연결 |
| [N039](<04-macros-and-business.md#n039>) · 작업 | 수동 편집 동작의 매크로 기록·재생 | ☐ 미구현 | ☐ 미검증 | ☐ 미연결 |

<a id="work-6"></a>

### 검색·반복 · 독립 실행 작업

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [G087](<04-macros-and-business.md#g087>) · 작업 | 업무별 반복 명령 저장·변수·재실행 | ☑ 완료 | ☑ 완료 | ☑ 연결 |
| [G088](<04-macros-and-business.md#g088>) · 작업 | 구역·쪽·바탕쪽 반복 recipe 확장 | ☑ 완료 | ☑ 완료 | ☑ 연결 |
| [G089](<04-macros-and-business.md#g089>) · 작업 | 공문·계획·결과 보고 기본 초안 | ☑ 완료 | ☑ 완료 | ☑ 연결 |
| [N038](<04-macros-and-business.md#n038>) · 작업 | 반복 작업의 표·개체 명령 확장 | ☐ 미구현 | ☐ 미검증 | ☐ 미연결 |

## 항목별 완료조건·근거

각 항목은 펼쳐서 읽는다. 상태와 근거는 CSV에서 관리한다.

<details id="b003">
<summary>B003 · 문서마당</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ☐ 미연결.
- 검증 구분: 자동 **PARTIAL** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 공문·계획·회의 결과·보고서 4개 자체 기본 양식: 빈 문서, 제목/항목 스타일·표, 단일 undo·양 형식 저장 검사. 한글 문서마당 원본·기관 양식·자동 새 탭·외부 템플릿 갤러리 남음.
- UI 명령: `file:work-template`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>) · [basic-text-browser.json](<../evidence/remaining-editor-2026-10-13/basic-text-browser.json>)
- 원래 기록: `PARTIAL;BROWSER_TESTED_NATIVE_PENDING`

</details>

<details id="b004">
<summary>B004 · 문서 시작 도우미</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ☐ 미구현 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 초기 작성 경로 없음
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `MISSING;NOT_RUN`

</details>

<details id="b081">
<summary>B081 · 상용구</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ☐ 미연결.
- 검증 구분: 자동 **PARTIAL** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 공통 일반 텍스트 상용구 등록·수정·이름 변경·삭제·본문 삽입·동시 변경/손상 보호·재실행·undo·저장 검사. 서식/필드/변수, 한글 상용구 파일·약어 키·셀/특수 영역 남음.
- UI 명령: `insert:snippets`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>) · [basic-text-browser.json](<../evidence/remaining-editor-2026-10-13/basic-text-browser.json>)
- 원래 기록: `PARTIAL;BROWSER_TESTED_NATIVE_PENDING`

</details>

<details id="b141">
<summary>B141 · 메일 머지</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ☐ 미구현 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 자료 원본·필드·일괄 결과 보존
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `MISSING;NOT_RUN`

</details>

<details id="b142">
<summary>B142 · 스크립트 매크로</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ☐ 미구현 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 한글 스크립트/키 입력 녹화는 미지원. Jueony 지원 AI 명령 저장·재실행 매크로는 별도 구현(28번 문서)
- UI 명령: `pending:macro-record`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `MISSING;NOT_RUN`

</details>

<details id="g087">
<summary>G087 · 업무별 반복 명령 저장·변수·재실행</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 현재 지원 본문/새 표·일부 구역 recipe 범위
- 다음 작업: 기록된 범위 유지·관련 변경 시 회귀 검사
- 근거: [28-continuation-implementation.md](<../28-continuation-implementation.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g088">
<summary>G088 · 구역·쪽·바탕쪽 반복 recipe 확장</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 허용 명령/대상 매핑·버전·실패 원복
- 다음 작업: 기록된 범위 유지·관련 변경 시 회귀 검사
- 근거: [64-section-repeat-work.md](<../64-section-repeat-work.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g089">
<summary>G089 · 공문·계획·결과 보고 기본 초안</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 입력한 사실 기반 합성 양식; 공식 기관 인증 제외
- 다음 작업: 기록된 범위 유지·관련 변경 시 회귀 검사
- 근거: [28-continuation-implementation.md](<../28-continuation-implementation.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="n038">
<summary>N038 · 반복 작업의 표·개체 명령 확장</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☐ 미구현 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NA**.
- 완료 범위: 범위/상태/ID/변수·dry-run·batch·한 번 undo·저장 검사
- 다음 작업: 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀
- 근거: [64-section-repeat-work.md](<../64-section-repeat-work.md>)
- 원래 기록: `EXPLICIT_REMAINING_OR_AUDIT`

</details>

<details id="n039">
<summary>N039 · 수동 편집 동작의 매크로 기록·재생</summary>

- 종류: 실행 작업 · 우선순위: P2.
- 상태: 구현 ☐ 미구현 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 지원 동작만·민감 정보·중단·재실행/내보내기
- 다음 작업: 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀
- 상위 항목: [B142](<04-macros-and-business.md#b142>) 스크립트 매크로
- 근거: [28-continuation-implementation.md](<../28-continuation-implementation.md>)
- 원래 기록: `EXPLICIT_REMAINING_OR_AUDIT`

</details>

<details id="n040">
<summary>N040 · 기관별 공식 양식·공문 업무 흐름</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 초안/결재/붙임/보존·기관 사실 입력·문서 유출 방지
- 다음 작업: 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀
- 상위 항목: [B003](<04-macros-and-business.md#b003>) 문서마당
- 근거: [28-continuation-implementation.md](<../28-continuation-implementation.md>)
- 원래 기록: `EXPLICIT_REMAINING_OR_AUDIT`

</details>

## 함께 보는 기능

- [AI 연결·Agent 실행](<02-agent-and-models.md>)
- [참고 자료·검색·RAG](<03-references-and-rag.md>)
- [본문 편집·입력·선택·찾기](<06-editing-and-selection.md>)

이 파일은 자동 생성한다. 상태는 [CSV](<../jueony-work-checklist.csv>)에서, 기능 배치는 [분류 원본](<../checklist-features.json>)에서 수정한다.
