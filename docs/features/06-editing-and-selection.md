# 본문 편집·입력·선택·찾기

[← 종합 진행 현황](<../jueony-progress.md>) · [전체 검색](<../jueony-work-checklist.html>) · [완료 규칙](<../97-master-work-checklist.md>)

본문 작성·삽입·교체·삭제, IME, 클립보드, 선택·탐색·찾기와 특수 문자.

## 진행 요약

실행 작업 **11개**, 상위 범위 **20개**. CSV의 기록을 기능별로 표시한 문서다.

| 구분 | 실행 작업 | 상위 범위 |
| :--- | :---: | :---: |
| 구현 | 완료 ![11/11](<../progress-badges/complete-11-of-11.svg>) · 부분 0 | 완료 0/20 · 부분 19 · 미구현 1 |
| 검증 | 완료 0/11 · 부분 11 | 완료 0/20 · 부분 5 · 미검증 15 |
| Agent 연결 | 연결 ![4/4](<../progress-badges/complete-4-of-4.svg>) · 부분 0 · 해당 없음 7 | 연결 0/20 · 부분 2 · 미연결 18 |

☑ 완료/연결 · ◐ 부분 · ☐ 대기 · ? 재점검 · — 해당 없음. 검증 완료에는 필요한 한글 직접 비교도 포함한다. 구현 완료만으로 세 축 완료가 되지 않는다.

상위 범위는 세 축 완료 **0/20개**다. 세부 작업 완료 수와 분리해서 읽는다.

## 먼저 할 일

- **검증** [A001](<06-editing-and-selection.md#a001>) **새 본문 문서 작성** — 지원 범위별 한글 비교와 실제 모델 품질 확인; 원본 확장은 별도 작업.
- **검증** [A002](<06-editing-and-selection.md#a002>) **여러 본문 문단 삽입** — 지원 범위별 한글 비교와 실제 모델 품질 확인; 원본 확장은 별도 작업.
- **검증** [A003](<06-editing-and-selection.md#a003>) **본문 범위 교체** — 지원 범위별 한글 비교와 실제 모델 품질 확인; 원본 확장은 별도 작업.

## 기능별 작업표

관련된 상위 기능과 실행 작업을 함께 묶었다. 각 표는 최대 8개 항목이며, 완료된 항목도 같은 표에 유지한다. ID를 누르면 아래의 완료조건·근거로 이동한다. **범위** 행은 상위 점검, **작업** 행은 실행 작업으로 중복 집계하지 않는다.

- [편집 · 상위 기능 점검 (1)](<#work-1>)
- [편집 · 상위 기능 점검 (2)](<#work-2>)
- [잘라내기](<#work-3>)
- [모양 복사](<#work-4>)
- [선택 내용 지우기](<#work-5>)
- [찾기](<#work-6>)
- [입력 · 상위 기능 점검](<#work-7>)
- [본문 블록 확대](<#work-8>)
- [단축키 · 상위 기능 점검](<#work-9>)
- [Agent 명령 · 독립 실행 작업](<#work-10>)
- [입력·선택 · 독립 실행 작업](<#work-11>)

<a id="work-1"></a>

### 편집 · 상위 기능 점검 (1)

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B023](<06-editing-and-selection.md#b023>) · 범위 | 되돌리기 | ◐ 부분 | ☐ 미검증 | ◐ 부분 |
| [B024](<06-editing-and-selection.md#b024>) · 범위 | 다시 실행 | ◐ 부분 | ☐ 미검증 | ◐ 부분 |
| [B026](<06-editing-and-selection.md#b026>) · 범위 | 복사 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |
| [B027](<06-editing-and-selection.md#b027>) · 범위 | 붙이기 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |
| [B028](<06-editing-and-selection.md#b028>) · 범위 | 골라 붙이기 | ◐ 부분 | ◐ 부분 | ☐ 미연결 |
| [B031](<06-editing-and-selection.md#b031>) · 범위 | 조판 부호 삭제 | ☐ 미구현 | ☐ 미검증 | ☐ 미연결 |
| [B032](<06-editing-and-selection.md#b032>) · 범위 | 전체 선택 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |
| [B034](<06-editing-and-selection.md#b034>) · 범위 | 바꾸기 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |

<a id="work-2"></a>

### 편집 · 상위 기능 점검 (2)

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B035](<06-editing-and-selection.md#b035>) · 범위 | 다음 검색 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |
| [B036](<06-editing-and-selection.md#b036>) · 범위 | 이동 대화상자 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |
| [B037](<06-editing-and-selection.md#b037>) · 범위 | 글자 변환·정렬 | ◐ 부분 | ◐ 부분 | ☐ 미연결 |
| [B039](<06-editing-and-selection.md#b039>) · 범위 | 이전·다음 커서 위치 | ◐ 부분 | ◐ 부분 | ☐ 미연결 |
| [B040](<06-editing-and-selection.md#b040>) · 범위 | 문서 끼워넣기 | ◐ 부분 | ◐ 부분 | ☐ 미연결 |

<a id="work-3"></a>

### 잘라내기

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B025](<06-editing-and-selection.md#b025>) · 범위 | 잘라내기 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |
| [G114](<06-editing-and-selection.md#g114>) · 작업 | 선택한 표·그림·도형 잘라내기 실패 보호 | ☑ 완료 | ◐ 부분 | — 해당 없음 |

<a id="work-4"></a>

### 모양 복사

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B029](<06-editing-and-selection.md#b029>) · 범위 | 모양 복사 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |
| [G108](<06-editing-and-selection.md#g108>) · 작업 | 본문 모양 복사 원자적 되돌리기 | ☑ 완료 | ◐ 부분 | — 해당 없음 |

<a id="work-5"></a>

### 선택 내용 지우기

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B030](<06-editing-and-selection.md#b030>) · 범위 | 선택 내용 지우기 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |
| [A003](<06-editing-and-selection.md#a003>) · 작업 | 본문 범위 교체 | ☑ 완료 | ◐ 부분 | ☑ 연결 |
| [A004](<06-editing-and-selection.md#a004>) · 작업 | 본문 범위 삭제 | ☑ 완료 | ◐ 부분 | ☑ 연결 |

<a id="work-6"></a>

### 찾기

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B033](<06-editing-and-selection.md#b033>) · 범위 | 찾기 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |
| [G109](<06-editing-and-selection.md#g109>) · 작업 | 본문·표·중첩 표 찾기와 안전한 바꾸기 | ☑ 완료 | ◐ 부분 | — 해당 없음 |

<a id="work-7"></a>

### 입력 · 상위 기능 점검

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B090](<06-editing-and-selection.md#b090>) · 범위 | 문자표 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |

<a id="work-8"></a>

### 본문 블록 확대

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B170](<06-editing-and-selection.md#b170>) · 범위 | 본문 블록 확대 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |
| [G110](<06-editing-and-selection.md#g110>) · 작업 | 본문 경계 선택과 기본 서식 단축키 | ☑ 완료 | ◐ 부분 | — 해당 없음 |

<a id="work-9"></a>

### 단축키 · 상위 기능 점검

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B182](<06-editing-and-selection.md#b182>) · 범위 | 특수 공백·하이픈 | ◐ 부분 | ◐ 부분 | ☐ 미연결 |

<a id="work-10"></a>

### Agent 명령 · 독립 실행 작업

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [A001](<06-editing-and-selection.md#a001>) · 작업 | 새 본문 문서 작성 | ☑ 완료 | ◐ 부분 | ☑ 연결 |
| [A002](<06-editing-and-selection.md#a002>) · 작업 | 여러 본문 문단 삽입 | ☑ 완료 | ◐ 부분 | ☑ 연결 |

<a id="work-11"></a>

### 입력·선택 · 독립 실행 작업

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [G019](<06-editing-and-selection.md#g019>) · 작업 | 본문과 표의 한글 IME 조합 보호 | ☑ 완료 | ◐ 부분 | — 해당 없음 |
| [G023](<06-editing-and-selection.md#g023>) · 작업 | 특수 공백·하이픈 입력 | ☑ 완료 | ◐ 부분 | — 해당 없음 |
| [G024](<06-editing-and-selection.md#g024>) · 작업 | 본문 책갈피와 탐색 이력 | ☑ 완료 | ◐ 부분 | — 해당 없음 |

## 항목별 완료조건·근거

각 항목은 펼쳐서 읽는다. 상태와 근거는 CSV에서 관리한다.

<details id="b023">
<summary>B023 · 되돌리기</summary>

- 종류: 한글 상위 기능 · 우선순위: P0.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ◐ 부분.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 명령별 undo 묶음 비교 필요
- UI 명령: `edit:undo`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `WIRED;NOT_RUN`

</details>

<details id="b024">
<summary>B024 · 다시 실행</summary>

- 종류: 한글 상위 기능 · 우선순위: P0.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ◐ 부분.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: Ctrl+Y는 줄 삭제에 예약
- UI 명령: `edit:redo`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `WIRED;NOT_RUN`

</details>

<details id="b025">
<summary>B025 · 잘라내기</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: OS 클립보드와 셀·개체 별도 검사
- UI 명령: `edit:cut`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `WIRED;NOT_RUN`

</details>

<details id="b026">
<summary>B026 · 복사</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: Ctrl+Insert 문맥 충돌은 실측 필요
- UI 명령: `edit:copy`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `PARTIAL;NOT_RUN`

</details>

<details id="b027">
<summary>B027 · 붙이기</summary>

- 종류: 한글 상위 기능 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: HWP/HTML/이미지 서식 비교 필요
- UI 명령: `edit:paste`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `WIRED;NOT_RUN`

</details>

<details id="b028">
<summary>B028 · 골라 붙이기</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ☐ 미연결.
- 검증 구분: 자동 **PARTIAL** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 텍스트만 골라 붙이기: 본문 한 문단 선택→여러 줄, 원문·서식·undo·양 형식 저장 검사. HTML/그림/HWP 조각, 표와 특수 영역·여러 문단 선택 남음.
- UI 명령: `edit:paste-special`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>) · [basic-text-browser.json](<../evidence/remaining-editor-2026-10-13/basic-text-browser.json>)
- 원래 기록: `PARTIAL;BROWSER_TESTED_NATIVE_PENDING`

</details>

<details id="b029">
<summary>B029 · 모양 복사</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 셀/본문/마지막 복사모양 수명 관찰
- UI 명령: `edit:format-copy`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `WIRED;NOT_RUN`

</details>

<details id="b030">
<summary>B030 · 선택 내용 지우기</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 셀 블록과 개체 범위 차이 검사
- UI 명령: `edit:delete`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `WIRED;NOT_RUN`

</details>

<details id="b031">
<summary>B031 · 조판 부호 삭제</summary>

- 종류: 한글 상위 기능 · 우선순위: P1.
- 상태: 구현 ☐ 미구현 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 종류별 삭제 대화상자 없음
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `MISSING;NOT_RUN`

</details>

<details id="b032">
<summary>B032 · 전체 선택</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 본문·표·머리말 범위 검사
- UI 명령: `edit:select-all`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `WIRED;NOT_RUN`

</details>

<details id="b033">
<summary>B033 · 찾기</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 모달 FindDialog
- UI 명령: `edit:find`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `WIRED;NOT_RUN`

</details>

<details id="b034">
<summary>B034 · 바꾸기</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 셀 검색·모두바꾸기 undo 검수
- UI 명령: `edit:find-replace`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `WIRED;NOT_RUN`

</details>

<details id="b035">
<summary>B035 · 다음 검색</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 검색 조건 수명 검사
- UI 명령: `edit:find-again`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `WIRED;NOT_RUN`

</details>

<details id="b036">
<summary>B036 · 이동 대화상자</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 쪽·구역·책갈피 대상별 대조
- UI 명령: `edit:goto`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `WIRED;NOT_RUN`

</details>

<details id="b037">
<summary>B037 · 글자 변환·정렬</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ☐ 미연결.
- 검증 구분: 자동 **PARTIAL** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 본문·단순 셀 글자 변환과 전체 본문 문단의 문자/정확한 소수 정렬, 탭 열·제목 유지·서식 이동·undo·저장 검사. 한자/가나 변환·표/특수 영역 정렬·한글 정렬 규칙 비교 남음.
- UI 명령: `edit:transform-text; edit:sort-paragraphs`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>) · [basic-text-browser.json](<../evidence/remaining-editor-2026-10-13/basic-text-browser.json>) · [result.json](<../evidence/advanced-editor-2026-10-13/browser/result.json>) · [result.json](<../evidence/advanced-editor-2026-10-13/native/result.json>)
- 원래 기록: `PARTIAL;BROWSER_TESTED_NATIVE_PENDING`

</details>

<details id="b039">
<summary>B039 · 이전·다음 커서 위치</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ☐ 미연결.
- 검증 구분: 자동 **PARTIAL** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: Ctrl+=/Ctrl+Shift+= 실행·분기·64개 이력·변경 위치 제외·문서 로드 중 커서 기록 경합 수정. 본문/평면 셀 검수. 실제 한글 기록 시점·특수 영역 정책 비교 남음.
- UI 명령: `ext:jueony-previous-cursor; ext:jueony-next-cursor`
- 근거: [result.json](<../evidence/navigation-history-2026-10-12/verified/result.json>) · [editor-tests.txt](<../evidence/navigation-history-2026-10-12/editor-tests.txt>)
- 원래 기록: `PARTIAL;BROWSER_TESTED_NATIVE_HISTORY_POLICY_PENDING`

</details>

<details id="b040">
<summary>B040 · 문서 끼워넣기</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ☐ 미연결.
- 검증 구분: 자동 **PARTIAL** / 한글 **PARTIAL**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 단일 구역 본문/표/그림의 서식 및 자산 이식과 한 번 undo, 두 형식 저장/한글 재열기 구현. 스타일/쪽 유지 옵션·다중 구역·특수 컨트롤과 전체 조판 대조 남음.
- UI 명령: `ext:jueony-insert-document`
- 근거: [result.json](<../evidence/document-insert-2026-10-12/final-verified/result.json>) · [result.json](<../evidence/document-insert-2026-10-12/engine-complete/result.json>)
- 원래 기록: `PARTIAL;PARTIAL_NATIVE_COMPARISON`

</details>

<details id="b090">
<summary>B090 · 문자표</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 유니코드·옛한글·최근 값 검사
- UI 명령: `insert:symbols`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `WIRED;NOT_RUN`

</details>

<details id="b170">
<summary>B170 · 본문 블록 확대</summary>

- 종류: 한글 상위 기능 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 엔진 5단계와 공식 4회 기준 차이
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `PARTIAL;NOT_RUN`

</details>

<details id="b182">
<summary>B182 · 특수 공백·하이픈</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ☐ 미연결.
- 검증 구분: 자동 **PARTIAL** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: Unicode U+2007/U+00A0/U+00AD 본문 입력·단축키·undo·양 형식 저장 검사. HWP 특수 제어 생성과 조판 폭/무른 하이픈, OS 예약키·표/특수 영역 직접 비교 남음.
- UI 명령: `insert:fixed-space; insert:nonbreaking-space; insert:soft-hyphen`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>) · [basic-text-browser.json](<../evidence/remaining-editor-2026-10-13/basic-text-browser.json>)
- 원래 기록: `PARTIAL;BROWSER_TESTED_NATIVE_PENDING`

</details>

<details id="a001">
<summary>A001 · 새 본문 문서 작성</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 현재 계약이 허용하는 조회·대상·파일형식·보호·크기·묶음 제한 안의 내부 Agent 연결. 모든 원본/한글 기능을 지원한다는 의미 아님.
- 다음 작업: 지원 범위별 한글 비교와 실제 모델 품질 확인; 원본 확장은 별도 작업.
- 상위 항목: [B001](<05-files-storage-recovery.md#b001>) 새 문서
- Agent 명령: `create_document`
- 근거: [12-mvp-implementation.md](<../12-mvp-implementation.md>) · [wire-schema.mjs](<../../apps/editor/src/modules/document/public/wire-schema.mjs>)
- 원래 기록: `CURRENT_46_KIND_CONTRACT`

</details>

<details id="a002">
<summary>A002 · 여러 본문 문단 삽입</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 현재 계약이 허용하는 조회·대상·파일형식·보호·크기·묶음 제한 안의 내부 Agent 연결. 모든 원본/한글 기능을 지원한다는 의미 아님.
- 다음 작업: 지원 범위별 한글 비교와 실제 모델 품질 확인; 원본 확장은 별도 작업.
- 상위 항목: [B001](<05-files-storage-recovery.md#b001>) 새 문서
- Agent 명령: `insert_body_paragraphs`
- 근거: [12-mvp-implementation.md](<../12-mvp-implementation.md>) · [wire-schema.mjs](<../../apps/editor/src/modules/document/public/wire-schema.mjs>)
- 원래 기록: `CURRENT_46_KIND_CONTRACT`

</details>

<details id="a003">
<summary>A003 · 본문 범위 교체</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 현재 계약이 허용하는 조회·대상·파일형식·보호·크기·묶음 제한 안의 내부 Agent 연결. 모든 원본/한글 기능을 지원한다는 의미 아님.
- 다음 작업: 지원 범위별 한글 비교와 실제 모델 품질 확인; 원본 확장은 별도 작업.
- 상위 항목: [B030](<06-editing-and-selection.md#b030>) 선택 내용 지우기
- Agent 명령: `replace_body_text`
- 근거: [12-mvp-implementation.md](<../12-mvp-implementation.md>) · [wire-schema.mjs](<../../apps/editor/src/modules/document/public/wire-schema.mjs>)
- 원래 기록: `CURRENT_46_KIND_CONTRACT`

</details>

<details id="a004">
<summary>A004 · 본문 범위 삭제</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 현재 계약이 허용하는 조회·대상·파일형식·보호·크기·묶음 제한 안의 내부 Agent 연결. 모든 원본/한글 기능을 지원한다는 의미 아님.
- 다음 작업: 지원 범위별 한글 비교와 실제 모델 품질 확인; 원본 확장은 별도 작업.
- 상위 항목: [B030](<06-editing-and-selection.md#b030>) 선택 내용 지우기
- Agent 명령: `delete_body_text`
- 근거: [12-mvp-implementation.md](<../12-mvp-implementation.md>) · [wire-schema.mjs](<../../apps/editor/src/modules/document/public/wire-schema.mjs>)
- 원래 기록: `CURRENT_46_KIND_CONTRACT`

</details>

<details id="g019">
<summary>G019 · 본문과 표의 한글 IME 조합 보호</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 조합 중 Agent 적용 차단; 전체 IME/OS 조합 검수 남음
- 다음 작업: 정의한 범위 회귀 유지; 한글 비교 대기
- 근거: [37-basic-editing-state-result.md](<../37-basic-editing-state-result.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g023">
<summary>G023 · 특수 공백·하이픈 입력</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PARTIAL** / 한글 **NOT_RUN**.
- 완료 범위: 구현 기록과 저장 코드 점검; 모든 조판 검수 제외
- 다음 작업: 정의한 범위 회귀 유지; 한글 비교 대기
- 근거: [47-remaining-editor-implementation.md](<../47-remaining-editor-implementation.md>) · [basic-text-browser.json](<../evidence/remaining-editor-2026-10-13/basic-text-browser.json>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g024">
<summary>G024 · 본문 책갈피와 탐색 이력</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 지원 본문 점 위치와 이전/다음 정책
- 다음 작업: 정의한 범위 회귀 유지; 한글 비교 대기
- 근거: [40-basic-navigation-calendar-result.md](<../40-basic-navigation-calendar-result.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g108">
<summary>G108 · 본문 모양 복사 원자적 되돌리기</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 같은 구역 본문 선택의 글자·문단 서식 복사; 단일 undo/redo·역방향/F3 선택·실패 롤백·문서 전환·HWP/HWPX 저장 재열기
- 다음 작업: 한글 2024 직접 비교는 마지막 일괄 검수. 제한된 구현 범위 밖 특수 story/문맥은 상위 기능에서 관리.
- 상위 항목: [B029](<06-editing-and-selection.md#b029>) 모양 복사
- UI 명령: `edit:format-copy`
- 근거: [139-basic-editor-parallel-plan.md](<../139-basic-editor-parallel-plan.md>) · [manifest.json](<../evidence/basic-editor-2026-10-24/first/manifest.json>)
- 원래 기록: `SCOPED_BASIC_EDITOR_IMPLEMENTED_AUTOMATED_2026_10_24`

</details>

<details id="g109">
<summary>G109 · 본문·표·중첩 표 찾기와 안전한 바꾸기</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 지원 일반 본문 및 표 셀의 경로별 찾기/이전/다음/모두 바꾸기; 문서 버전·보호·IME 검증과 단일 undo/redo·저장 재열기
- 다음 작업: 한글 2024 직접 비교는 마지막 일괄 검수. 제한된 구현 범위 밖 특수 story/문맥은 상위 기능에서 관리.
- 상위 항목: [B033](<06-editing-and-selection.md#b033>) 찾기
- UI 명령: `edit:find;edit:find-replace;edit:find-again`
- 근거: [139-basic-editor-parallel-plan.md](<../139-basic-editor-parallel-plan.md>) · [manifest.json](<../evidence/basic-editor-2026-10-24/first/manifest.json>)
- 원래 기록: `SCOPED_BASIC_EDITOR_IMPLEMENTED_AUTOMATED_2026_10_24`

</details>

<details id="g110">
<summary>G110 · 본문 경계 선택과 기본 서식 단축키</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 본문 문서·문단·화면 경계 선택, Ctrl+T 선택삭제, 붙여넣기 대화상자, 글자 크기 반복, 위·아래 첨자 순환과 글꼴 이동. 전체 단축키 매트릭스 제외
- 다음 작업: 한글 2024 직접 비교 보류. 세부 범위의 구현·자동 검사만 완료이며 상위 기능 전체 완료는 아님.
- 상위 항목: [B170](<06-editing-and-selection.md#b170>) 본문 블록 확대
- 근거: [139-basic-editor-parallel-plan.md](<../139-basic-editor-parallel-plan.md>) · [manifest.json](<../evidence/basic-editor-2026-10-24/second/manifest.json>)
- 원래 기록: `SCOPED_BASIC_EDITOR_IMPLEMENTED_AUTOMATED_2026_10_24`

</details>

<details id="g114">
<summary>G114 · 선택한 표·그림·도형 잘라내기 실패 보호</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 현재 지원 본문 개체의 rich clipboard 쓰기 성공 후 삭제, 오래된 선택·문서 변경·중복 실행 거절, 중간 실패 롤백·undo/redo·저장 재열기. 실제 OS clipboard 최종 반영과 특수 story 제외
- 다음 작업: 한글 2024 직접 비교 보류. 세부 범위의 구현·자동 검사만 완료이며 상위 기능 전체 완료는 아님.
- 상위 항목: [B025](<06-editing-and-selection.md#b025>) 잘라내기
- 근거: [139-basic-editor-parallel-plan.md](<../139-basic-editor-parallel-plan.md>) · [manifest.json](<../evidence/basic-editor-2026-10-24/second/manifest.json>)
- 원래 기록: `SCOPED_BASIC_EDITOR_IMPLEMENTED_AUTOMATED_2026_10_24`

</details>

## 함께 보는 기능

- [글자·문단·스타일·번호](<07-formatting-and-styles.md>)
- [상태 저장·환경·선택 복원](<13-state-and-preferences.md>)
- [화면·메뉴·작업 창·단축키](<12-ui-and-shortcuts.md>)

이 파일은 자동 생성한다. 상태는 [CSV](<../jueony-work-checklist.csv>)에서, 기능 배치는 [분류 원본](<../checklist-features.json>)에서 수정한다.
