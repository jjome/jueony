# 머리말·각주·필드·책갈피

[← 종합 진행 현황](<../jueony-progress.md>) · [전체 검색](<../jueony-work-checklist.html>) · [완료 규칙](<../97-master-work-checklist.md>)

머리말·꼬리말, 각주·미주, 필드·날짜·상호 참조·책갈피·링크.

## 진행 요약

실행 작업 **9개**, 상위 범위 **11개**. CSV의 기록을 기능별로 표시한 문서다.

| 구분 | 실행 작업 | 상위 범위 |
| --- | --- | --- |
| 구현 | 완료 ![9/9 완료](<../progress-badges/complete-9-of-9.svg>) · 부분 0 | 완료 0/11 · 부분 8 · 미구현 3 |
| 검증 | 완료 0/9 · 부분 9 | 완료 0/11 · 부분 2 · 미검증 9 |
| Agent 연결 | 연결 ![8/8 완료](<../progress-badges/complete-8-of-8.svg>) · 부분 0 · 해당 없음 1 | 연결 0/11 · 부분 2 · 미연결 9 |

☑ 완료/연결 · ◐ 부분 · ☐ 대기 · ? 재점검 · — 해당 없음. 검증 완료에는 필요한 한글 직접 비교도 포함한다. 구현 완료만으로 세 축 완료가 되지 않는다.

상위 범위는 세 축 완료 **0/11개**다. 세부 작업 완료 수와 분리해서 읽는다.

## 먼저 할 일

- **검증** [A018](<10-headers-notes-fields.md#a018>) **본문 점 책갈피 추가** — 지원 범위별 한글 비교와 실제 모델 품질 확인; 원본 확장은 별도 작업.
- **검증** [A019](<10-headers-notes-fields.md#a019>) **본문 책갈피 이름 변경** — 지원 범위별 한글 비교와 실제 모델 품질 확인; 원본 확장은 별도 작업.
- **검증** [A020](<10-headers-notes-fields.md#a020>) **본문 책갈피 삭제** — 지원 범위별 한글 비교와 실제 모델 품질 확인; 원본 확장은 별도 작업.

## 기능별 작업표

관련된 상위 기능과 실행 작업을 함께 묶었다. 각 표는 최대 8개 항목이며, 완료된 항목도 같은 표에 유지한다. ID를 누르면 아래의 완료조건·근거로 이동한다. **범위** 행은 상위 점검, **작업** 행은 실행 작업으로 중복 집계하지 않는다.

- [입력 · 상위 기능 점검](<#work-1>)
- [각주](<#work-2>)
- [책갈피](<#work-3>)
- [머리말·꼬리말](<#work-4>)

<a id="work-1"></a>

### 입력 · 상위 기능 점검

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B077](<10-headers-notes-fields.md#b077>) · 범위 | 필드 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |
| [B078](<10-headers-notes-fields.md#b078>) · 범위 | 양식 개체 | ☐ 미구현 | ☐ 미검증 | ☐ 미연결 |
| [B086](<10-headers-notes-fields.md#b086>) · 범위 | 미주 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |
| [B087](<10-headers-notes-fields.md#b087>) · 범위 | 각주·미주 모양 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |
| [B088](<10-headers-notes-fields.md#b088>) · 범위 | 날짜·시간·파일명 | ◐ 부분 | ◐ 부분 | ☐ 미연결 |
| [B089](<10-headers-notes-fields.md#b089>) · 범위 | 덧말 | ☐ 미구현 | ☐ 미검증 | ☐ 미연결 |
| [B093](<10-headers-notes-fields.md#b093>) · 범위 | 상호 참조 | ☐ 미구현 | ☐ 미검증 | ☐ 미연결 |
| [B095](<10-headers-notes-fields.md#b095>) · 범위 | 하이퍼링크 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |

<a id="work-2"></a>

### 각주

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B085](<10-headers-notes-fields.md#b085>) · 범위 | 각주 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |
| [G100](<10-headers-notes-fields.md#g100>) · 작업 | 새 각주의 고정 스타일 인덱스 참조 오류 수정 | ☑ 완료 | ◐ 부분 | — 해당 없음 |

<a id="work-3"></a>

### 책갈피

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B094](<10-headers-notes-fields.md#b094>) · 범위 | 책갈피 | ◐ 부분 | ☐ 미검증 | ◐ 부분 |
| [A018](<10-headers-notes-fields.md#a018>) · 작업 | 본문 점 책갈피 추가 | ☑ 완료 | ◐ 부분 | ☑ 연결 |
| [A019](<10-headers-notes-fields.md#a019>) · 작업 | 본문 책갈피 이름 변경 | ☑ 완료 | ◐ 부분 | ☑ 연결 |
| [A020](<10-headers-notes-fields.md#a020>) · 작업 | 본문 책갈피 삭제 | ☑ 완료 | ◐ 부분 | ☑ 연결 |

<a id="work-4"></a>

### 머리말·꼬리말

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B115](<10-headers-notes-fields.md#b115>) · 범위 | 머리말·꼬리말 | ◐ 부분 | ◐ 부분 | ◐ 부분 |
| [A021](<10-headers-notes-fields.md#a021>) · 작업 | 단순 머리말/꼬리말 정의 생성 | ☑ 완료 | ◐ 부분 | ☑ 연결 |
| [A022](<10-headers-notes-fields.md#a022>) · 작업 | 단순 머리말/꼬리말 삭제 | ☑ 완료 | ◐ 부분 | ☑ 연결 |
| [A023](<10-headers-notes-fields.md#a023>) · 작업 | 머리말/꼬리말 문단 서식 | ☑ 완료 | ◐ 부분 | ☑ 연결 |
| [A024](<10-headers-notes-fields.md#a024>) · 작업 | 머리말/꼬리말 글자 서식 | ☑ 완료 | ◐ 부분 | ☑ 연결 |
| [A025](<10-headers-notes-fields.md#a025>) · 작업 | 머리말/꼬리말 내용 변경 | ☑ 완료 | ◐ 부분 | ☑ 연결 |

## 항목별 완료조건·근거

각 항목은 펼쳐서 읽는다. 상태와 근거는 CSV에서 관리한다.

<details id="b077">
<summary>B077 · 필드</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 누름틀·양식 종류별 보존 검수
- UI 명령: `insert:field`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `WIRED;NOT_RUN`

</details>

<details id="b078">
<summary>B078 · 양식 개체</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ☐ 미구현 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 양식 개체 신규 생성/속성 UI 없음. 기존 Form 읽기·값 설정 API 존재와 구분.
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `MISSING;NOT_RUN`

</details>

<details id="b085">
<summary>B085 · 각주</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 내용·번호·쪽 위치 보존
- UI 명령: `insert:footnote`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>) · [105-file-storage-preservation.md](<../105-file-storage-preservation.md>) · [verification-summary.json](<../evidence/state-storage-2026-10-16/verification-summary.json>)
- 원래 기록: `WIRED;NOT_RUN`

</details>

<details id="b086">
<summary>B086 · 미주</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 각주 변환 및 저장 별도
- UI 명령: `insert:endnote`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `WIRED;NOT_RUN`

</details>

<details id="b087">
<summary>B087 · 각주·미주 모양</summary>

- 종류: 한글 상위 기능 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 각주·미주 입력/일부 모양 있음. 미주 내용 번호 작은 크기 옵션 비활성.
- UI 명령: `insert:endnote-shape`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `PARTIAL;NOT_RUN`

</details>

<details id="b088">
<summary>B088 · 날짜·시간·파일명</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ☐ 미연결.
- 검증 구분: 자동 **PARTIAL** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 일반 날짜 문자열 5형식·마지막 성공 형식 재실행 복원·취소·충돌·undo·저장·실제 한글 재열기 통과. 자동 갱신 코드·사용자 형식·표/특수 영역 미지원. 형식 복원 정책의 실제 한글 비교 남음.
- UI 명령: `ext:jueony-calendar-stamp; page:insert-field-filename`
- 근거: [result.json](<../evidence/navigation-history-2026-10-12/verified/result.json>) · [native-calendar-reopen.json](<../evidence/navigation-history-2026-10-12/native-calendar-reopen.json>) · [result.json](<../evidence/calendar-format-state-2026-10-12/verified/result.json>)
- 원래 기록: `PARTIAL;CALENDAR_STRING_NATIVE_REOPEN_PASS_ONLY`

</details>

<details id="b089">
<summary>B089 · 덧말</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ☐ 미구현 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 발음/루비 표현 보존 별도
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `MISSING;NOT_RUN`

</details>

<details id="b093">
<summary>B093 · 상호 참조</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ☐ 미구현 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 필드 업데이트 포함 구현 필요
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `MISSING;NOT_RUN`

</details>

<details id="b094">
<summary>B094 · 책갈피</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ◐ 부분.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 이름·위치·숫자 바로키 별도
- UI 명령: `insert:bookmark`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `WIRED;NOT_RUN`

</details>

<details id="b095">
<summary>B095 · 하이퍼링크</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 외부 URL 정책과 내부 이동 검사
- UI 명령: `insert:hyperlink`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `WIRED;NOT_RUN`

</details>

<details id="b115">
<summary>B115 · 머리말·꼬리말</summary>

- 종류: 한글 상위 기능 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ◐ 부분.
- 검증 구분: 자동 **PARTIAL** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 통합 창과 양쪽·홀수·짝수 생성·기존 내용 보존·undo 구현. 한글 대화상자 전체와 외관 비교는 남음.
- UI 명령: `page:header-footer-dialog`
- 근거: [parity-result.json](<../evidence/features-2026-10-11/parity-result.json>) · [editor-tests.txt](<../evidence/features-2026-10-11/editor-tests.txt>)
- 원래 기록: `PARTIAL;BROWSER_TESTED_NATIVE_PENDING`

</details>

<details id="a018">
<summary>A018 · 본문 점 책갈피 추가</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 현재 계약이 허용하는 조회·대상·파일형식·보호·크기·묶음 제한 안의 내부 Agent 연결. 모든 원본/한글 기능을 지원한다는 의미 아님.
- 다음 작업: 지원 범위별 한글 비교와 실제 모델 품질 확인; 원본 확장은 별도 작업.
- 상위 항목: [B094](<10-headers-notes-fields.md#b094>) 책갈피
- Agent 명령: `add_bookmark`
- 근거: [73-agent-body-bookmarks.md](<../73-agent-body-bookmarks.md>) · [wire-schema.mjs](<../../apps/editor/src/modules/document/public/wire-schema.mjs>)
- 원래 기록: `CURRENT_46_KIND_CONTRACT`

</details>

<details id="a019">
<summary>A019 · 본문 책갈피 이름 변경</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 현재 계약이 허용하는 조회·대상·파일형식·보호·크기·묶음 제한 안의 내부 Agent 연결. 모든 원본/한글 기능을 지원한다는 의미 아님.
- 다음 작업: 지원 범위별 한글 비교와 실제 모델 품질 확인; 원본 확장은 별도 작업.
- 상위 항목: [B094](<10-headers-notes-fields.md#b094>) 책갈피
- Agent 명령: `rename_bookmark`
- 근거: [73-agent-body-bookmarks.md](<../73-agent-body-bookmarks.md>) · [wire-schema.mjs](<../../apps/editor/src/modules/document/public/wire-schema.mjs>)
- 원래 기록: `CURRENT_46_KIND_CONTRACT`

</details>

<details id="a020">
<summary>A020 · 본문 책갈피 삭제</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 현재 계약이 허용하는 조회·대상·파일형식·보호·크기·묶음 제한 안의 내부 Agent 연결. 모든 원본/한글 기능을 지원한다는 의미 아님.
- 다음 작업: 지원 범위별 한글 비교와 실제 모델 품질 확인; 원본 확장은 별도 작업.
- 상위 항목: [B094](<10-headers-notes-fields.md#b094>) 책갈피
- Agent 명령: `delete_bookmark`
- 근거: [73-agent-body-bookmarks.md](<../73-agent-body-bookmarks.md>) · [wire-schema.mjs](<../../apps/editor/src/modules/document/public/wire-schema.mjs>)
- 원래 기록: `CURRENT_46_KIND_CONTRACT`

</details>

<details id="a021">
<summary>A021 · 단순 머리말/꼬리말 정의 생성</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 현재 계약이 허용하는 조회·대상·파일형식·보호·크기·묶음 제한 안의 내부 Agent 연결. 모든 원본/한글 기능을 지원한다는 의미 아님.
- 다음 작업: 지원 범위별 한글 비교와 실제 모델 품질 확인; 원본 확장은 별도 작업.
- 상위 항목: [B115](<10-headers-notes-fields.md#b115>) 머리말·꼬리말
- Agent 명령: `create_header_footer`
- 근거: [72-agent-header-creation.md](<../72-agent-header-creation.md>) · [wire-schema.mjs](<../../apps/editor/src/modules/document/public/wire-schema.mjs>)
- 원래 기록: `CURRENT_46_KIND_CONTRACT`

</details>

<details id="a022">
<summary>A022 · 단순 머리말/꼬리말 삭제</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 현재 계약이 허용하는 조회·대상·파일형식·보호·크기·묶음 제한 안의 내부 Agent 연결. 모든 원본/한글 기능을 지원한다는 의미 아님.
- 다음 작업: 지원 범위별 한글 비교와 실제 모델 품질 확인; 원본 확장은 별도 작업.
- 상위 항목: [B115](<10-headers-notes-fields.md#b115>) 머리말·꼬리말
- Agent 명령: `delete_header_footer`
- 근거: [71-agent-header-deletion.md](<../71-agent-header-deletion.md>) · [wire-schema.mjs](<../../apps/editor/src/modules/document/public/wire-schema.mjs>)
- 원래 기록: `CURRENT_46_KIND_CONTRACT`

</details>

<details id="a023">
<summary>A023 · 머리말/꼬리말 문단 서식</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 현재 계약이 허용하는 조회·대상·파일형식·보호·크기·묶음 제한 안의 내부 Agent 연결. 모든 원본/한글 기능을 지원한다는 의미 아님.
- 다음 작업: 지원 범위별 한글 비교와 실제 모델 품질 확인; 원본 확장은 별도 작업.
- 상위 항목: [B115](<10-headers-notes-fields.md#b115>) 머리말·꼬리말
- Agent 명령: `format_header_footer_paragraph`
- 근거: [70-agent-header-paragraph.md](<../70-agent-header-paragraph.md>) · [wire-schema.mjs](<../../apps/editor/src/modules/document/public/wire-schema.mjs>)
- 원래 기록: `CURRENT_46_KIND_CONTRACT`

</details>

<details id="a024">
<summary>A024 · 머리말/꼬리말 글자 서식</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 현재 계약이 허용하는 조회·대상·파일형식·보호·크기·묶음 제한 안의 내부 Agent 연결. 모든 원본/한글 기능을 지원한다는 의미 아님.
- 다음 작업: 지원 범위별 한글 비교와 실제 모델 품질 확인; 원본 확장은 별도 작업.
- 상위 항목: [B115](<10-headers-notes-fields.md#b115>) 머리말·꼬리말
- Agent 명령: `format_header_footer`
- 근거: [69-agent-header-font-format.md](<../69-agent-header-font-format.md>) · [wire-schema.mjs](<../../apps/editor/src/modules/document/public/wire-schema.mjs>)
- 원래 기록: `CURRENT_46_KIND_CONTRACT`

</details>

<details id="a025">
<summary>A025 · 머리말/꼬리말 내용 변경</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 현재 계약이 허용하는 조회·대상·파일형식·보호·크기·묶음 제한 안의 내부 Agent 연결. 모든 원본/한글 기능을 지원한다는 의미 아님.
- 다음 작업: 지원 범위별 한글 비교와 실제 모델 품질 확인; 원본 확장은 별도 작업.
- 상위 항목: [B115](<10-headers-notes-fields.md#b115>) 머리말·꼬리말
- Agent 명령: `set_header_footer_text`
- 근거: [68-agent-header-footer.md](<../68-agent-header-footer.md>) · [wire-schema.mjs](<../../apps/editor/src/modules/document/public/wire-schema.mjs>)
- 원래 기록: `CURRENT_46_KIND_CONTRACT`

</details>

<details id="g100">
<summary>G100 · 새 각주의 고정 스타일 인덱스 참조 오류 수정</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 새 각주만 고유한 named Footnote/각주 문단 스타일과 유효 참조를 확인한다. 스타일 순서 이동·재열기, 없음/rename/중복/type/범위 초과/깨진 참조의 삽입 전 bytes 불변을 검증. 기존 원본은 정규화하지 않는다.
- 다음 작업: 한글 직접 비교. 고유한 표준 각주 스타일을 찾을 수 없는 원본은 삽입 거절로 명시한다.
- 상위 항목: [B085](<10-headers-notes-fields.md#b085>) 각주
- UI 명령: `insert:footnote`
- 근거: [105-file-storage-preservation.md](<../105-file-storage-preservation.md>) · [verification-summary.json](<../evidence/state-storage-2026-10-16/verification-summary.json>)
- 원래 기록: `SCOPED_IMPLEMENTED;ENGINE_BROWSER_VERIFIED_2026_10_16`

</details>

## 함께 보는 기능

- [상태 저장·환경·선택 복원](<13-state-and-preferences.md>)
- [쪽·구역·용지·배경](<09-pages-and-sections.md>)
- [파일·저장·복구·형식 보존](<05-files-storage-recovery.md>)

이 파일은 자동 생성한다. 상태는 [CSV](<../jueony-work-checklist.csv>)에서, 기능 배치는 [분류 원본](<../checklist-features.json>)에서 수정한다.
