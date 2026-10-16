# 표·셀·크기·계산

[← 종합 진행 현황](<../jueony-progress.md>) · [전체 검색](<../jueony-work-checklist.html>) · [완료 규칙](<../97-master-work-checklist.md>)

표 생성·변환·제목 반복·여백·크기·병합·분할·행열·중첩과 계산.

## 진행 요약

실행 작업 **36개**, 상위 범위 **24개**. CSV의 기록을 기능별로 표시한 문서다.

| 구분 | 실행 작업 | 상위 범위 |
| --- | --- | --- |
| 구현 | 완료 30/36 · 부분 2 · 미구현 3 · 재점검 1 | 완료 0/24 · 부분 23 · 미구현 1 |
| 검증 | 완료 2/36 · 부분 30 · 미검증 4 | 완료 0/24 · 부분 13 · 미검증 11 |
| Agent 연결 | 연결 26/33 · 부분 3 · 미연결 4 · 해당 없음 3 | 연결 0/24 · 부분 9 · 미연결 15 |

☑ 완료/연결 · ◐ 부분 · ☐ 대기 · ? 재점검 · — 해당 없음. 검증 완료에는 필요한 한글 직접 비교도 포함한다. 구현 완료만으로 세 축 완료가 되지 않는다.

상위 범위는 세 축 완료 **0/24개**다. 세부 작업 완료 수와 분리해서 읽는다.

**현재 통합 중:** 병합 표 행 높이의 Native 수정과 속성 대화상자의 변경 값 보존을 검증 중이다. 병합 행열 Agent 전체 연결은 완료로 표시하지 않는다.

## 먼저 할 일

- **구현** [N004](<08-tables.md#n004>) **기존 병합 원본의 후속 Agent 셀 편집** — 단순 병합 주 셀의 문단 교체만 연결; 필드·개체·혼합서식과 복합 병합 원본은 남음; 최종 한글 비교는 별도.
- **구현** [N005](<08-tables.md#n005>) **임의 N×M 셀 분할 Agent** — 비병합 원본의 1~8 지정 행·열 분할만 연결; 병합·중첩·영역서식·내용분배 옵션은 남음; 최종 한글 비교는 별도.
- **구현** [N006](<08-tables.md#n006>) **중첩 표 Agent 조회·경로·편집** — 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀

## 기능별 작업표

관련된 상위 기능과 실행 작업을 함께 묶었다. 각 표는 최대 8개 항목이며, 완료된 항목도 같은 표에 유지한다. ID를 누르면 아래의 완료조건·근거로 이동한다. **범위** 행은 상위 점검, **작업** 행은 실행 작업으로 중복 집계하지 않는다.

- [표 만들기](<#work-1>)
- [입력 · 상위 기능 점검](<#work-2>)
- [표 자동 채우기](<#work-3>)
- [셀 속성](<#work-4>)
- [표 · 상위 기능 점검](<#work-5>)
- [표 나누기](<#work-6>)
- [표 붙이기](<#work-7>)
- [행·열 추가](<#work-8>)
- [행·열 삭제](<#work-9>)
- [셀 분할](<#work-10>)
- [셀 병합](<#work-11>)
- [계산식](<#work-12>)
- [단축키 · 상위 기능 점검](<#work-13>)
- [표·쪽·개체 · 독립 실행 작업 (1)](<#work-14>)
- [표·쪽·개체 · 독립 실행 작업 (2)](<#work-15>)

<a id="work-1"></a>

### 표 만들기

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B067](<08-tables.md#b067>) · 범위 | 표 만들기 | ◐ 부분 | ☐ 미검증 | ◐ 부분 |
| [A031](<08-tables.md#a031>) · 작업 | 새 단순 표 생성 | ☑ 완료 | ◐ 부분 | ☑ 연결 |

<a id="work-2"></a>

### 입력 · 상위 기능 점검

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B068](<08-tables.md#b068>) · 범위 | 표 그리기·지우개 | ☐ 미구현 | ☐ 미검증 | ☐ 미연결 |
| [B069](<08-tables.md#b069>) · 범위 | 문자열-표 변환 | ◐ 부분 | ◐ 부분 | ☐ 미연결 |

<a id="work-3"></a>

### 표 자동 채우기

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B084](<08-tables.md#b084>) · 범위 | 표 자동 채우기 | ◐ 부분 | ◐ 부분 | ☐ 미연결 |
| [N010](<08-tables.md#n010>) · 작업 | 날짜·수식 자동 채우기 | ☐ 미구현 | ☐ 미검증 | ☐ 미연결 |

<a id="work-4"></a>

### 셀 속성

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B153](<08-tables.md#b153>) · 범위 | 셀 속성 | ◐ 부분 | ◐ 부분 | ◐ 부분 |
| [A006](<08-tables.md#a006>) · 작업 | 연속 제목 행 지정·반복 | ☑ 완료 | ◐ 부분 | ☑ 연결 |
| [A007](<08-tables.md#a007>) · 작업 | 표 쪽 나눔 none/cell/row | ☑ 완료 | ◐ 부분 | ☑ 연결 |
| [A032](<08-tables.md#a032>) · 작업 | 단순 셀 원문 검사·교체 | ☑ 완료 | ◐ 부분 | ☑ 연결 |
| [A033](<08-tables.md#a033>) · 작업 | 단순 셀 서식·안 여백·열 너비·행 높이 | ☑ 완료 | ◐ 부분 | ☑ 연결 |
| [N006](<08-tables.md#n006>) · 작업 | 중첩 표 Agent 조회·경로·편집 | ☐ 미구현 | ☐ 미검증 | ☐ 미연결 |

<a id="work-5"></a>

### 표 · 상위 기능 점검

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B154](<08-tables.md#b154>) · 범위 | 각 셀 테두리·배경 | ◐ 부분 | ◐ 부분 | ☐ 미연결 |
| [B155](<08-tables.md#b155>) · 범위 | 여러 셀 테두리·배경 | ◐ 부분 | ◐ 부분 | ☐ 미연결 |
| [B162](<08-tables.md#b162>) · 범위 | 높이·너비 균등 | ◐ 부분 | ◐ 부분 | ◐ 부분 |
| [B163](<08-tables.md#b163>) · 범위 | 표마당 | ◐ 부분 | ◐ 부분 | ☐ 미연결 |
| [B164](<08-tables.md#b164>) · 범위 | 표 뒤집기 | ◐ 부분 | ◐ 부분 | ☐ 미연결 |
| [B165](<08-tables.md#b165>) · 범위 | 블록 계산 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |
| [B166](<08-tables.md#b166>) · 범위 | 쉬운 계산식 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |
| [B168](<08-tables.md#b168>) · 범위 | 자릿점 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |

<a id="work-6"></a>

### 표 나누기

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B156](<08-tables.md#b156>) · 범위 | 표 나누기 | ◐ 부분 | ◐ 부분 | ◐ 부분 |
| [A048](<08-tables.md#a048>) · 작업 | 표 내부 행 경계 나누기 | ☑ 완료 | ◐ 부분 | ☑ 연결 |
| [N008](<08-tables.md#n008>) · 작업 | 표 나누기·붙이기 Agent | ☑ 완료 | ◐ 부분 | ☑ 연결 |

<a id="work-7"></a>

### 표 붙이기

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B157](<08-tables.md#b157>) · 범위 | 표 붙이기 | ◐ 부분 | ◐ 부분 | ◐ 부분 |
| [A049](<08-tables.md#a049>) · 작업 | 조회된 호환 다음 표 붙이기 | ☑ 완료 | ◐ 부분 | ☑ 연결 |

<a id="work-8"></a>

### 행·열 추가

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B158](<08-tables.md#b158>) · 범위 | 행·열 추가 | ◐ 부분 | ☐ 미검증 | ◐ 부분 |
| [A035](<08-tables.md#a035>) · 작업 | 단순 표 행 추가 | ☑ 완료 | ◐ 부분 | ☑ 연결 |
| [A036](<08-tables.md#a036>) · 작업 | 단순 표 열 추가 | ☑ 완료 | ◐ 부분 | ☑ 연결 |
| [N007](<08-tables.md#n007>) · 작업 | 병합 포함 행/열 추가·삭제 Agent | ☐ 미구현 | ☐ 미검증 | ☐ 미연결 |

<a id="work-9"></a>

### 행·열 삭제

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B159](<08-tables.md#b159>) · 범위 | 행·열 삭제 | ◐ 부분 | ☐ 미검증 | ◐ 부분 |
| [A037](<08-tables.md#a037>) · 작업 | 단순 표 행 삭제 | ☑ 완료 | ◐ 부분 | ☑ 연결 |
| [A038](<08-tables.md#a038>) · 작업 | 단순 표 열 삭제 | ☑ 완료 | ◐ 부분 | ☑ 연결 |

<a id="work-10"></a>

### 셀 분할

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B160](<08-tables.md#b160>) · 범위 | 셀 분할 | ◐ 부분 | ◐ 부분 | ◐ 부분 |
| [A047](<08-tables.md#a047>) · 작업 | 기본 병합 셀 증거 격자 분할 | ☑ 완료 | ◐ 부분 | ☑ 연결 |
| [N003](<08-tables.md#n003>) · 작업 | 병합 셀 기본 분할의 Agent 계약·실행 | ☑ 완료 | ◐ 부분 | ☑ 연결 |
| [N005](<08-tables.md#n005>) · 작업 | 임의 N×M 셀 분할 Agent | ◐ 부분 | ◐ 부분 | ◐ 부분 |
| [A051](<08-tables.md#a051>) · 작업 | 비병합 셀의 지정 행·열 분할 | ☑ 완료 | ◐ 부분 | ☑ 연결 |

<a id="work-11"></a>

### 셀 병합

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B161](<08-tables.md#b161>) · 범위 | 셀 병합 | ◐ 부분 | ◐ 부분 | ◐ 부분 |
| [A005](<08-tables.md#a005>) · 작업 | 사각형 셀 병합 | ☑ 완료 | ◐ 부분 | ☑ 연결 |
| [N004](<08-tables.md#n004>) · 작업 | 기존 병합 원본의 후속 Agent 셀 편집 | ◐ 부분 | ◐ 부분 | ◐ 부분 |
| [A050](<08-tables.md#a050>) · 작업 | 병합 주 셀의 지정 문단 교체 | ☑ 완료 | ◐ 부분 | ☑ 연결 |

<a id="work-12"></a>

### 계산식

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B167](<08-tables.md#b167>) · 범위 | 계산식 | ◐ 부분 | ◐ 부분 | ☐ 미연결 |
| [N009](<08-tables.md#n009>) · 작업 | 표 계산식 Agent 편집·갱신 | ? 재점검 | ☐ 미검증 | ☐ 미연결 |

<a id="work-13"></a>

### 단축키 · 상위 기능 점검

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B169](<08-tables.md#b169>) · 범위 | 첫 셀·셀 블록 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |
| [B171](<08-tables.md#b171>) · 범위 | 칸 전체 블록 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |
| [B172](<08-tables.md#b172>) · 범위 | 줄 전체 블록 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |
| [B173](<08-tables.md#b173>) · 범위 | 셀 이동·표 안 탭 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |

<a id="work-14"></a>

### 표·쪽·개체 · 독립 실행 작업 (1)

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [G040](<08-tables.md#g040>) · 작업 | 단순 문자열→표·표→문자열 변환 | ☑ 완료 | ◐ 부분 | — 해당 없음 |
| [G041](<08-tables.md#g041>) · 작업 | 정수 자동 채우기 | ☑ 완료 | ◐ 부분 | — 해당 없음 |
| [G042](<08-tables.md#g042>) · 작업 | 셀 높이/너비 수동 균등 경로 | ☑ 완료 | ◐ 부분 | ◐ 부분 |
| [G043](<08-tables.md#g043>) · 작업 | 연속 여러 제목 행과 반복 | ☑ 완료 | ◐ 부분 | ☑ 연결 |
| [G044](<08-tables.md#g044>) · 작업 | 표·셀 보호 상태의 Native 재확인 | ☑ 완료 | ☑ 완료 | ☑ 연결 |
| [G045](<08-tables.md#g045>) · 작업 | HWPX 셀 안 여백 네 방향·기본값 복귀 | ☑ 완료 | ◐ 부분 | ☑ 연결 |
| [G046](<08-tables.md#g046>) · 작업 | 표 기본 안 여백 변경 뒤 재배치 | ☑ 완료 | ◐ 부분 | — 해당 없음 |
| [G047](<08-tables.md#g047>) · 작업 | HWPX 열 너비 같게·정수 나머지 | ☑ 완료 | ◐ 부분 | ☑ 연결 |

<a id="work-15"></a>

### 표·쪽·개체 · 독립 실행 작업 (2)

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [G048](<08-tables.md#g048>) · 작업 | HWPX 열 너비 mm 직접 지정 | ☑ 완료 | ◐ 부분 | ☑ 연결 |
| [G049](<08-tables.md#g049>) · 작업 | HWPX 행 높이 같게·정수 나머지 | ☑ 완료 | ◐ 부분 | ☑ 연결 |
| [G050](<08-tables.md#g050>) · 작업 | HWPX 행 높이 mm 직접 지정 | ☑ 완료 | ◐ 부분 | ☑ 연결 |
| [G051](<08-tables.md#g051>) · 작업 | HWPX 한 쪽 평면 표 사각형 병합 | ☑ 완료 | ◐ 부분 | ☑ 연결 |
| [G052](<08-tables.md#g052>) · 작업 | 병합 중 다른 표의 같은 길이 텍스트 오염 거절 | ☑ 완료 | ☑ 완료 | ☑ 연결 |

## 항목별 완료조건·근거

각 항목은 펼쳐서 읽는다. 상태와 근거는 CSV에서 관리한다.

<details id="b067">
<summary>B067 · 표 만들기</summary>

- 종류: 한글 상위 기능 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ◐ 부분.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 키는 입력 대화상자; 메뉴는 격자
- UI 명령: `table:create`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `WIRED;NOT_RUN`

</details>

<details id="b068">
<summary>B068 · 표 그리기·지우개</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ☐ 미구현 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 기본 생성과 별도
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `MISSING;NOT_RUN`

</details>

<details id="b069">
<summary>B069 · 문자열-표 변환</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ☐ 미연결.
- 검증 구분: 자동 **PARTIAL** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 전체 본문↔평면 비병합 단일 문단 셀, literal 구분자·빈 셀·Unicode·혼합 글자/행 서식·사본/실패 복원/undo/양 형식 저장 검사. 새 구분자는 앞 셀 서식 상속. 필드·병합·중첩·여러 문단 셀과 실제 한글 비교 남음.
- UI 명령: `table:text-to-table; table:table-to-text`
- 근거: [table.json](<../evidence/pre-agent-2026-10-13/checks/table.json>) · [table-engine.json](<../evidence/pre-agent-2026-10-13/checks/table-engine.json>) · [result.json](<../evidence/advanced-editor-2026-10-13/browser/result.json>) · [result.json](<../evidence/advanced-editor-2026-10-13/native/result.json>)
- 원래 기록: `PARTIAL;BROWSER_TESTED_NATIVE_PENDING`

</details>

<details id="b084">
<summary>B084 · 표 자동 채우기</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ☐ 미연결.
- 검증 구분: 자동 **PARTIAL** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 정수·번호·날짜 자동 채우기와 명시적 일/월/년 간격, 원래 일 기준 말일 보정·윤년·역방향·미리보기·undo·저장 구현. 혼합 서식·복수 문단·병합·중첩·요일·수식 추론과 한글 동등성 남음.
- UI 명령: `table:auto-fill-integers`
- 근거: [table.json](<../evidence/pre-agent-2026-10-13/checks/table.json>) · [table-engine.json](<../evidence/pre-agent-2026-10-13/checks/table-engine.json>) · [basic-text-browser.json](<../evidence/remaining-editor-2026-10-13/basic-text-browser.json>) · [result.json](<../evidence/advanced-editor-2026-10-13/browser/result.json>) · [result.json](<../evidence/advanced-editor-2026-10-13/native/result.json>)
- 원래 기록: `PARTIAL;BROWSER_TESTED_NATIVE_PENDING`

</details>

<details id="b153">
<summary>B153 · 셀 속성</summary>

- 종류: 한글 상위 기능 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ◐ 부분.
- 검증 구분: 자동 **PARTIAL** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 2026-10-15: 표 바깥 여백의 HWP/HWPX 모델·저장 불일치 수정, 실제 속성 창 취소·적용·undo/redo·안전 저장·UI 재열기 검증. 모든 속성 조합과 한글 직접 동등성 검수는 남음.
- UI 명령: `table:cell-props`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>) · [verification-summary.json](<../evidence/save-table-controls-2026-10-14/verification-summary.json>) · [94-table-width-and-outer-margins.md](<../94-table-width-and-outer-margins.md>)
- 원래 기록: `WIRED;BROWSER_TESTED_NATIVE_PENDING`

</details>

<details id="b154">
<summary>B154 · 각 셀 테두리·배경</summary>

- 종류: 한글 상위 기능 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ☐ 미연결.
- 검증 구분: 자동 **PARTIAL** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 셀 블록 L/C 연결 및 테두리/배경 초기 탭 전달 구현. 실제 한글 문맥·혼합 셀 비교 필요.
- UI 명령: `table:border-each`
- 근거: [parity-result.json](<../evidence/features-2026-10-11/parity-result.json>) · [editor-tests.txt](<../evidence/features-2026-10-11/editor-tests.txt>)
- 원래 기록: `PARTIAL;UNIT_TESTED_NATIVE_PENDING`

</details>

<details id="b155">
<summary>B155 · 여러 셀 테두리·배경</summary>

- 종류: 한글 상위 기능 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ☐ 미연결.
- 검증 구분: 자동 **PARTIAL** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 셀 블록 B/F 연결 및 테두리/배경 초기 탭 전달 구현. 실제 한글 문맥·혼합 셀 비교 필요.
- UI 명령: `table:border-one`
- 근거: [parity-result.json](<../evidence/features-2026-10-11/parity-result.json>) · [editor-tests.txt](<../evidence/features-2026-10-11/editor-tests.txt>)
- 원래 기록: `PARTIAL;UNIT_TESTED_NATIVE_PENDING`

</details>

<details id="b156">
<summary>B156 · 표 나누기</summary>

- 종류: 한글 상위 기능 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ◐ 부분.
- 검증 구분: 자동 **PARTIAL** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: HWPX 단순 범위 Agent/자동검사 완료; 복합 원본·모든 옵션·한글 직접 비교 남음
- UI 명령: `table:split`
- Agent 명령: `split_table`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>) · [99-agent-table-structure.md](<../99-agent-table-structure.md>)
- 원래 기록: `WIRED;NOT_RUN`

</details>

<details id="b157">
<summary>B157 · 표 붙이기</summary>

- 종류: 한글 상위 기능 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ◐ 부분.
- 검증 구분: 자동 **PARTIAL** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: HWPX 단순 범위 Agent/자동검사 완료; 복합 원본·모든 옵션·한글 직접 비교 남음
- UI 명령: `table:attach`
- Agent 명령: `attach_table`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>) · [99-agent-table-structure.md](<../99-agent-table-structure.md>)
- 원래 기록: `WIRED;NOT_RUN`

</details>

<details id="b158">
<summary>B158 · 행·열 추가</summary>

- 종류: 한글 상위 기능 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ◐ 부분.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 셀 블록/병합 셀 범위 검사
- UI 명령: `table:insert-row-col`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `WIRED;NOT_RUN`

</details>

<details id="b159">
<summary>B159 · 행·열 삭제</summary>

- 종류: 한글 상위 기능 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ◐ 부분.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 마지막 행·중첩 구조 보존
- UI 명령: `table:delete-row-col`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `WIRED;NOT_RUN`

</details>

<details id="b160">
<summary>B160 · 셀 분할</summary>

- 종류: 한글 상위 기능 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ◐ 부분.
- 검증 구분: 자동 **PARTIAL** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 기본 증거 격자 분할 자동 검사 완료; 임의 행/열·복합 원본·IME·한글 직접 비교 남음; 이번 좁은 하위 범위만 구현, 전체 옵션/한글 검증은 미완료.
- UI 명령: `table:cell-split`
- Agent 명령: `split_table_cell`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>) · [98-agent-table-split.md](<../98-agent-table-split.md>) · [104-parallel-editor-integration.md](<../104-parallel-editor-integration.md>)
- 원래 기록: `WIRED;NOT_RUN`

</details>

<details id="b161">
<summary>B161 · 셀 병합</summary>

- 종류: 한글 상위 기능 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ◐ 부분.
- 검증 구분: 자동 **PARTIAL** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 2026-10-15: HWPX 한 쪽 본문 평면 표의 AI 사각형 병합·문단/글자 서식·모든 표 텍스트 보존·원복·저장 UI 재열기 검증. 셀 속성 차이·병합 원본/중첩·분할 Agent와 한글 직접 검수는 남음.; 이번 좁은 하위 범위만 구현, 전체 옵션/한글 검증은 미완료.
- UI 명령: `table:cell-merge`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>) · [96-agent-table-merge.md](<../96-agent-table-merge.md>) · [verification-summary.json](<../evidence/table-merge-2026-10-15/verification-summary.json>) · [104-parallel-editor-integration.md](<../104-parallel-editor-integration.md>)
- 원래 기록: `WIRED;BROWSER_TESTED_NATIVE_PENDING`

</details>

<details id="b162">
<summary>B162 · 높이·너비 균등</summary>

- 종류: 한글 상위 기능 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ◐ 부분.
- 검증 구분: 자동 **PARTIAL** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 비병합 평면 표의 수동 전체 행/열 밴드 균등 경로 재사용. HWPX AI 열 너비 같게와 전체 행 열 너비 mm 직접 지정의 단독 요청·보존·배치·undo/redo·저장 검증. 2026-10-15: HWPX 한 쪽 단순 표의 AI 행 높이 같게·mm 직접 지정과 실제 높이/최소 내용 높이 거절·실패 원복·저장 재열기 검증. 병합/중첩·복합 배치·한글 동등성 검수는 남음.
- UI 명령: `table:cell-height-equal`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>) · [verification-summary.json](<../evidence/save-table-controls-2026-10-14/verification-summary.json>) · [94-table-width-and-outer-margins.md](<../94-table-width-and-outer-margins.md>) · [95-agent-row-heights.md](<../95-agent-row-heights.md>) · [verification-summary.json](<../evidence/row-heights-2026-10-15/verification-summary.json>)
- 원래 기록: `PARTIAL;BROWSER_TESTED_NATIVE_PENDING`

</details>

<details id="b163">
<summary>B163 · 표마당</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ☐ 미연결.
- 검증 구분: 자동 **PARTIAL** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 자체 기본 모양 4종, 제목행/줄무늬·전체 표/직사각 셀 선택·가로/세로 병합·선택 밖 보호 셀 유지·내부 경계만 변경·undo·저장 검사. 한글 원본 표마당·비대칭 경계선·제외 셀·중첩 대상·갤러리 사용자 편집과 실제 한글 비교 남음.
- UI 명령: `table:basic-presets`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>) · [result.json](<../evidence/advanced-editor-2026-10-13/browser/result.json>) · [result.json](<../evidence/advanced-editor-2026-10-13/native/result.json>)
- 원래 기록: `PARTIAL;BROWSER_TESTED_NATIVE_PENDING`

</details>

<details id="b164">
<summary>B164 · 표 뒤집기</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ☐ 미연결.
- 검증 구분: 자동 **PARTIAL** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 본문 전체 표 T 전치에 가로/세로 병합 footprint·복수 문단·혼합 서식·영역 배경·사본/undo/저장 검수 추가. 보호·반복 제목행·중첩 대상/블록 복사·원본 지면 크기 정책·실제 한글 비교 남음.
- UI 명령: `ext:jueony-transpose-table; table:transpose-copy`
- 근거: [result.json](<../evidence/pre-agent-editor-2026-10-12/final/result.json>) · [result.json](<../evidence/advanced-editor-2026-10-13/browser/result.json>) · [result.json](<../evidence/advanced-editor-2026-10-13/native/result.json>)
- 원래 기록: `PARTIAL;BROWSER_TESTED_NATIVE_PENDING`

</details>

<details id="b165">
<summary>B165 · 블록 계산</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: sum/avg/product 동적 명령 등록
- UI 명령: `table:block-formula`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `WIRED;NOT_RUN`

</details>

<details id="b166">
<summary>B166 · 쉬운 계산식</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 가로·세로 키 매핑 없음
- UI 명령: `table:formula`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `PARTIAL;NOT_RUN`

</details>

<details id="b167">
<summary>B167 · 계산식</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ☐ 미연결.
- 검증 구분: 자동 **PARTIAL** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: Ctrl+N,F 계산식 연결. 한글 전체 계산식 기능과 재계산·저장 동등성 미검증.
- UI 명령: `table:formula`
- 근거: [parity-result.json](<../evidence/features-2026-10-11/parity-result.json>) · [editor-tests.txt](<../evidence/features-2026-10-11/editor-tests.txt>)
- 원래 기록: `PARTIAL;UNIT_TESTED_NATIVE_PENDING`

</details>

<details id="b168">
<summary>B168 · 자릿점</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 수식 값과 문자열 구분
- UI 명령: `table:thousand-sep`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `WIRED;NOT_RUN`

</details>

<details id="b169">
<summary>B169 · 첫 셀·셀 블록</summary>

- 종류: 한글 상위 기능 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 엔진 F5 있음; 표 개체/Shift+F5 세부 다름
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `PARTIAL;NOT_RUN`

</details>

<details id="b171">
<summary>B171 · 칸 전체 블록</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 이번 수정; 실제 한글 대조 미실행
- UI 명령: `ext:jueony-select-cell-columns`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `WIRED;NOT_RUN`

</details>

<details id="b172">
<summary>B172 · 줄 전체 블록</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 이번 수정; 실제 한글 대조 미실행
- UI 명령: `ext:jueony-select-cell-rows`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `WIRED;NOT_RUN`

</details>

<details id="b173">
<summary>B173 · 셀 이동·표 안 탭</summary>

- 종류: 한글 상위 기능 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 엔진 이동 경로 존재; 문서 탭 순환 충돌 검수
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `PARTIAL;NOT_RUN`

</details>

<details id="a005">
<summary>A005 · 사각형 셀 병합</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 현재 계약이 허용하는 조회·대상·파일형식·보호·크기·묶음 제한 안의 내부 Agent 연결. 모든 원본/한글 기능을 지원한다는 의미 아님.
- 다음 작업: 지원 범위별 한글 비교와 실제 모델 품질 확인; 원본 확장은 별도 작업.
- 상위 항목: [B161](<08-tables.md#b161>) 셀 병합
- Agent 명령: `merge_table_cells`
- 근거: [96-agent-table-merge.md](<../96-agent-table-merge.md>) · [wire-schema.mjs](<../../apps/editor/src/modules/document/public/wire-schema.mjs>)
- 원래 기록: `CURRENT_46_KIND_CONTRACT`

</details>

<details id="a006">
<summary>A006 · 연속 제목 행 지정·반복</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 현재 계약이 허용하는 조회·대상·파일형식·보호·크기·묶음 제한 안의 내부 Agent 연결. 모든 원본/한글 기능을 지원한다는 의미 아님.
- 다음 작업: 지원 범위별 한글 비교와 실제 모델 품질 확인; 원본 확장은 별도 작업.
- 상위 항목: [B153](<08-tables.md#b153>) 셀 속성
- Agent 명령: `set_table_header`
- 근거: [87-table-multiple-title-rows.md](<../87-table-multiple-title-rows.md>) · [wire-schema.mjs](<../../apps/editor/src/modules/document/public/wire-schema.mjs>)
- 원래 기록: `CURRENT_46_KIND_CONTRACT`

</details>

<details id="a007">
<summary>A007 · 표 쪽 나눔 none/cell/row</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 현재 계약이 허용하는 조회·대상·파일형식·보호·크기·묶음 제한 안의 내부 Agent 연결. 모든 원본/한글 기능을 지원한다는 의미 아님.
- 다음 작업: 지원 범위별 한글 비교와 실제 모델 품질 확인; 원본 확장은 별도 작업.
- 상위 항목: [B153](<08-tables.md#b153>) 셀 속성
- Agent 명령: `set_table_pagination`
- 근거: [84-agent-table-pagination.md](<../84-agent-table-pagination.md>) · [wire-schema.mjs](<../../apps/editor/src/modules/document/public/wire-schema.mjs>)
- 원래 기록: `CURRENT_46_KIND_CONTRACT`

</details>

<details id="a031">
<summary>A031 · 새 단순 표 생성</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 현재 계약이 허용하는 조회·대상·파일형식·보호·크기·묶음 제한 안의 내부 Agent 연결. 모든 원본/한글 기능을 지원한다는 의미 아님.
- 다음 작업: 지원 범위별 한글 비교와 실제 모델 품질 확인; 원본 확장은 별도 작업.
- 상위 항목: [B067](<08-tables.md#b067>) 표 만들기
- Agent 명령: `create_table`
- 근거: [17-editor-control-implementation.md](<../17-editor-control-implementation.md>) · [wire-schema.mjs](<../../apps/editor/src/modules/document/public/wire-schema.mjs>)
- 원래 기록: `CURRENT_46_KIND_CONTRACT`

</details>

<details id="a032">
<summary>A032 · 단순 셀 원문 검사·교체</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 현재 계약이 허용하는 조회·대상·파일형식·보호·크기·묶음 제한 안의 내부 Agent 연결. 모든 원본/한글 기능을 지원한다는 의미 아님.
- 다음 작업: 지원 범위별 한글 비교와 실제 모델 품질 확인; 원본 확장은 별도 작업.
- 상위 항목: [B153](<08-tables.md#b153>) 셀 속성
- Agent 명령: `set_table_cell`
- 근거: [23-autonomous-work-result.md](<../23-autonomous-work-result.md>) · [wire-schema.mjs](<../../apps/editor/src/modules/document/public/wire-schema.mjs>)
- 원래 기록: `CURRENT_46_KIND_CONTRACT`

</details>

<details id="a033">
<summary>A033 · 단순 셀 서식·안 여백·열 너비·행 높이</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 현재 계약이 허용하는 조회·대상·파일형식·보호·크기·묶음 제한 안의 내부 Agent 연결. 모든 원본/한글 기능을 지원한다는 의미 아님.
- 다음 작업: 지원 범위별 한글 비교와 실제 모델 품질 확인; 원본 확장은 별도 작업.
- 상위 항목: [B153](<08-tables.md#b153>) 셀 속성
- Agent 명령: `format_table_cells`
- 근거: [17-editor-control-implementation.md](<../17-editor-control-implementation.md>) · [88-agent-cell-inner-padding.md](<../88-agent-cell-inner-padding.md>) · [94-table-width-and-outer-margins.md](<../94-table-width-and-outer-margins.md>) · [95-agent-row-heights.md](<../95-agent-row-heights.md>)
- 원래 기록: `CURRENT_46_KIND_CONTRACT`

</details>

<details id="a035">
<summary>A035 · 단순 표 행 추가</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 현재 계약이 허용하는 조회·대상·파일형식·보호·크기·묶음 제한 안의 내부 Agent 연결. 모든 원본/한글 기능을 지원한다는 의미 아님.
- 다음 작업: 지원 범위별 한글 비교와 실제 모델 품질 확인; 원본 확장은 별도 작업.
- 상위 항목: [B158](<08-tables.md#b158>) 행·열 추가
- Agent 명령: `insert_table_row`
- 근거: [23-autonomous-work-result.md](<../23-autonomous-work-result.md>) · [wire-schema.mjs](<../../apps/editor/src/modules/document/public/wire-schema.mjs>)
- 원래 기록: `CURRENT_46_KIND_CONTRACT`

</details>

<details id="a036">
<summary>A036 · 단순 표 열 추가</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 현재 계약이 허용하는 조회·대상·파일형식·보호·크기·묶음 제한 안의 내부 Agent 연결. 모든 원본/한글 기능을 지원한다는 의미 아님.
- 다음 작업: 지원 범위별 한글 비교와 실제 모델 품질 확인; 원본 확장은 별도 작업.
- 상위 항목: [B158](<08-tables.md#b158>) 행·열 추가
- Agent 명령: `insert_table_column`
- 근거: [23-autonomous-work-result.md](<../23-autonomous-work-result.md>) · [wire-schema.mjs](<../../apps/editor/src/modules/document/public/wire-schema.mjs>)
- 원래 기록: `CURRENT_46_KIND_CONTRACT`

</details>

<details id="a037">
<summary>A037 · 단순 표 행 삭제</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 현재 계약이 허용하는 조회·대상·파일형식·보호·크기·묶음 제한 안의 내부 Agent 연결. 모든 원본/한글 기능을 지원한다는 의미 아님.
- 다음 작업: 지원 범위별 한글 비교와 실제 모델 품질 확인; 원본 확장은 별도 작업.
- 상위 항목: [B159](<08-tables.md#b159>) 행·열 삭제
- Agent 명령: `delete_table_row`
- 근거: [23-autonomous-work-result.md](<../23-autonomous-work-result.md>) · [wire-schema.mjs](<../../apps/editor/src/modules/document/public/wire-schema.mjs>)
- 원래 기록: `CURRENT_46_KIND_CONTRACT`

</details>

<details id="a038">
<summary>A038 · 단순 표 열 삭제</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 현재 계약이 허용하는 조회·대상·파일형식·보호·크기·묶음 제한 안의 내부 Agent 연결. 모든 원본/한글 기능을 지원한다는 의미 아님.
- 다음 작업: 지원 범위별 한글 비교와 실제 모델 품질 확인; 원본 확장은 별도 작업.
- 상위 항목: [B159](<08-tables.md#b159>) 행·열 삭제
- Agent 명령: `delete_table_column`
- 근거: [23-autonomous-work-result.md](<../23-autonomous-work-result.md>) · [wire-schema.mjs](<../../apps/editor/src/modules/document/public/wire-schema.mjs>)
- 원래 기록: `CURRENT_46_KIND_CONTRACT`

</details>

<details id="a047">
<summary>A047 · 기본 병합 셀 증거 격자 분할</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: HWPX 한 쪽 평면 표의 단일 병합 셀; 단일 셀 증거로 확인한 불균등 폭/높이; 모든 텍스트·서식 첫 셀 유지, 새 셀 비움; cursor·undo/redo·보존·재열기
- 다음 작업: 지원 범위별 한글 비교와 실제 모델 품질 확인; 원본 확장은 별도 작업.
- 상위 항목: [B160](<08-tables.md#b160>) 셀 분할
- 선행 작업: [N003](<08-tables.md#n003>)
- Agent 명령: `split_table_cell`
- 근거: [98-agent-table-split.md](<../98-agent-table-split.md>) · [wire-schema.mjs](<../../apps/editor/src/modules/document/public/wire-schema.mjs>) · [verification-summary.json](<../evidence/table-split-2026-10-15/verification-summary.json>)
- 원래 기록: `CURRENT_47_KIND_CONTRACT`

</details>

<details id="a048">
<summary>A048 · 표 내부 행 경계 나누기</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: HWPX 단일 쪽 평면 미병합 격자; 내부 행 경계 나누기와 호환 nextTarget 붙이기; 빈 host/gap·전체 문단/셀/구역·cursor·undo/redo·재시작·저장재열기
- 다음 작업: 지원 범위별 한글 비교와 실제 모델 품질 확인; 원본 확장은 별도 작업.
- 상위 항목: [B156](<08-tables.md#b156>) 표 나누기
- 선행 작업: [N008](<08-tables.md#n008>)
- Agent 명령: `split_table`
- 근거: [99-agent-table-structure.md](<../99-agent-table-structure.md>) · [verification-summary.json](<../evidence/table-structure-2026-10-15/verification-summary.json>)
- 원래 기록: `CURRENT_49_KIND_CONTRACT`

</details>

<details id="a049">
<summary>A049 · 조회된 호환 다음 표 붙이기</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: HWPX 단일 쪽 평면 미병합 격자; 내부 행 경계 나누기와 호환 nextTarget 붙이기; 빈 host/gap·전체 문단/셀/구역·cursor·undo/redo·재시작·저장재열기
- 다음 작업: 지원 범위별 한글 비교와 실제 모델 품질 확인; 원본 확장은 별도 작업.
- 상위 항목: [B157](<08-tables.md#b157>) 표 붙이기
- 선행 작업: [N008](<08-tables.md#n008>)
- Agent 명령: `attach_table`
- 근거: [99-agent-table-structure.md](<../99-agent-table-structure.md>) · [verification-summary.json](<../evidence/table-structure-2026-10-15/verification-summary.json>)
- 원래 기록: `CURRENT_49_KIND_CONTRACT`

</details>

<details id="g040">
<summary>G040 · 단순 문자열→표·표→문자열 변환</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 탭/쉼표/세미콜론·빈 셀·Unicode; CSV 인용/병합 제외
- 다음 작업: 정의한 범위 회귀 유지; 한글 비교 대기
- 근거: [44-editor-stages-result.md](<../44-editor-stages-result.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g041">
<summary>G041 · 정수 자동 채우기</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 지원 정수 수열; 날짜/수식 자동 채우기 제외
- 다음 작업: 정의한 범위 회귀 유지; 한글 비교 대기
- 근거: [44-editor-stages-result.md](<../44-editor-stages-result.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g042">
<summary>G042 · 셀 높이/너비 수동 균등 경로</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ◐ 부분.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 정규 평면 전체 밴드; 병합/부분/복합 원본 제외
- 다음 작업: 정의한 범위 회귀 유지; 한글 비교 대기
- 근거: [28-continuation-implementation.md](<../28-continuation-implementation.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g043">
<summary>G043 · 연속 여러 제목 행과 반복</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 제목 행 prefix·쪽 나눔·undo/redo·저장
- 다음 작업: 정의한 범위 회귀 유지; 한글 비교 대기
- 근거: [87-table-multiple-title-rows.md](<../87-table-multiple-title-rows.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g044">
<summary>G044 · 표·셀 보호 상태의 Native 재확인</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 읽기 전용 원본·위조 snapshot·보호 이웃 변경 거절
- 다음 작업: 기록된 범위 유지·관련 변경 시 회귀 검사
- 근거: [86-ai-table-protection.md](<../86-ai-table-protection.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g045">
<summary>G045 · HWPX 셀 안 여백 네 방향·기본값 복귀</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 단순 표·단독 요청·내용 공간·실제 재열기
- 다음 작업: 정의한 범위 회귀 유지; 한글 비교 대기
- 근거: [88-agent-cell-inner-padding.md](<../88-agent-cell-inner-padding.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g046">
<summary>G046 · 표 기본 안 여백 변경 뒤 재배치</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 기존 셀·글줄·명시/상속 여백 소유
- 다음 작업: 정의한 범위 회귀 유지; 한글 비교 대기
- 근거: [90-table-default-padding-reflow.md](<../90-table-default-padding-reflow.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g047">
<summary>G047 · HWPX 열 너비 같게·정수 나머지</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 전체 행 밴드·총너비 유지·단독 요청
- 다음 작업: 정의한 범위 회귀 유지; 한글 비교 대기
- 근거: [91-agent-equal-column-widths.md](<../91-agent-equal-column-widths.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g048">
<summary>G048 · HWPX 열 너비 mm 직접 지정</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 본문 폭 상한·실제 배치·보존·커서
- 다음 작업: 정의한 범위 회귀 유지; 한글 비교 대기
- 근거: [94-table-width-and-outer-margins.md](<../94-table-width-and-outer-margins.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g049">
<summary>G049 · HWPX 행 높이 같게·정수 나머지</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 전체 열·연속 행·실제 높이·단독 요청
- 다음 작업: 정의한 범위 회귀 유지; 한글 비교 대기
- 근거: [95-agent-row-heights.md](<../95-agent-row-heights.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g050">
<summary>G050 · HWPX 행 높이 mm 직접 지정</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 내용 최소 높이 초과 거절·실제 재열기
- 다음 작업: 정의한 범위 회귀 유지; 한글 비교 대기
- 근거: [95-agent-row-heights.md](<../95-agent-row-heights.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g051">
<summary>G051 · HWPX 한 쪽 평면 표 사각형 병합</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 같은 셀 속성·행 우선 문단·형식 보존
- 다음 작업: 정의한 범위 회귀 유지; 한글 비교 대기
- 근거: [96-agent-table-merge.md](<../96-agent-table-merge.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g052">
<summary>G052 · 병합 중 다른 표의 같은 길이 텍스트 오염 거절</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 전체 본문·표 셀 텍스트를 계획 트리로 비교
- 다음 작업: 기록된 범위 유지·관련 변경 시 회귀 검사
- 근거: [96-agent-table-merge.md](<../96-agent-table-merge.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="n003">
<summary>N003 · 병합 셀 기본 분할의 Agent 계약·실행</summary>

- 종류: 실행 작업 · 우선순위: P0.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: HWPX 한 쪽 평면 표의 단일 병합 셀; 단일 셀 증거로 확인한 불균등 폭/높이; 모든 텍스트·서식 첫 셀 유지, 새 셀 비움; cursor·undo/redo·보존·재열기
- 다음 작업: 한글 2024 직접 비교; 임의 분할·복합 원본은 N005/N006 별도
- 상위 항목: [B160](<08-tables.md#b160>) 셀 분할
- Agent 명령: `split_table_cell`
- 근거: [98-agent-table-split.md](<../98-agent-table-split.md>) · [wire-schema.mjs](<../../apps/editor/src/modules/document/public/wire-schema.mjs>) · [verification-summary.json](<../evidence/table-split-2026-10-15/verification-summary.json>)
- 원래 기록: `SCOPED_BASIC_SPLIT_47_KIND_CONTRACT`

</details>

<details id="n004">
<summary>N004 · 기존 병합 원본의 후속 Agent 셀 편집</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ◐ 부분.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 임의 여러 문단/병합 원본 읽기와 원문·서식 보존
- 다음 작업: 단순 병합 주 셀의 문단 교체만 연결; 필드·개체·혼합서식과 복합 병합 원본은 남음; 최종 한글 비교는 별도.
- 상위 항목: [B161](<08-tables.md#b161>) 셀 병합
- Agent 명령: `replace_cell_paragraph`
- 근거: [101-agent-merged-cell-paragraph.md](<../101-agent-merged-cell-paragraph.md>) · [verification-summary.json](<../evidence/parallel-editor-2026-10-15/verification-summary.json>)
- 원래 기록: `EXPLICIT_REMAINING_OR_AUDIT`

</details>

<details id="n005">
<summary>N005 · 임의 N×M 셀 분할 Agent</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ◐ 부분.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 새 격자·행/열 참조 이관과 셀 내용 분배 명세
- 다음 작업: 비병합 원본의 1~8 지정 행·열 분할만 연결; 병합·중첩·영역서식·내용분배 옵션은 남음; 최종 한글 비교는 별도.
- 상위 항목: [B160](<08-tables.md#b160>) 셀 분할
- Agent 명령: `split_table_cell_into`
- 근거: [102-agent-cell-subdivision.md](<../102-agent-cell-subdivision.md>) · [verification-summary.json](<../evidence/parallel-editor-2026-10-15/verification-summary.json>)
- 원래 기록: `EXPLICIT_REMAINING_OR_AUDIT`

</details>

<details id="n006">
<summary>N006 · 중첩 표 Agent 조회·경로·편집</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☐ 미구현 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 부모 list 경로·stable 대상·보호·자원·저장 검증
- 다음 작업: 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀
- 상위 항목: [B153](<08-tables.md#b153>) 셀 속성
- 근거: [96-agent-table-merge.md](<../96-agent-table-merge.md>)
- 원래 기록: `EXPLICIT_REMAINING_OR_AUDIT`

</details>

<details id="n007">
<summary>N007 · 병합 포함 행/열 추가·삭제 Agent</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☐ 미구현 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: span 교차·주 셀 제거·neighbor 영향·실패 원복
- 다음 작업: 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀
- 상위 항목: [B158](<08-tables.md#b158>) 행·열 추가
- 근거: [96-agent-table-merge.md](<../96-agent-table-merge.md>)
- 원래 기록: `EXPLICIT_REMAINING_OR_AUDIT`

</details>

<details id="n008">
<summary>N008 · 표 나누기·붙이기 Agent</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: HWPX 단일 쪽 평면 미병합 격자; 내부 행 경계 나누기와 호환 nextTarget 붙이기; 빈 host/gap·전체 문단/셀/구역·cursor·undo/redo·재시작·저장재열기
- 다음 작업: 한글 직접 비교와 복합·병합·중첩 원본 확장; 유료 모델 품질은 별도
- 상위 항목: [B156](<08-tables.md#b156>) 표 나누기
- Agent 명령: `split_table;attach_table`
- 근거: [99-agent-table-structure.md](<../99-agent-table-structure.md>) · [verification-summary.json](<../evidence/table-structure-2026-10-15/verification-summary.json>)
- 원래 기록: `SCOPED_49_KIND_CONTRACT`

</details>

<details id="n009">
<summary>N009 · 표 계산식 Agent 편집·갱신</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ? 재점검 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 수식 파싱·참조 변경·오류·재계산·저장 형식
- 다음 작업: 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀
- 상위 항목: [B167](<08-tables.md#b167>) 계산식
- 근거: [47-remaining-editor-implementation.md](<../47-remaining-editor-implementation.md>)
- 원래 기록: `EXPLICIT_REMAINING_OR_AUDIT`

</details>

<details id="n010">
<summary>N010 · 날짜·수식 자동 채우기</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☐ 미구현 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 수열/참조 규칙·locale·중단·원복
- 다음 작업: 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀
- 상위 항목: [B084](<08-tables.md#b084>) 표 자동 채우기
- 근거: [44-editor-stages-result.md](<../44-editor-stages-result.md>)
- 원래 기록: `EXPLICIT_REMAINING_OR_AUDIT`

</details>

<details id="a050">
<summary>A050 · 병합 주 셀의 지정 문단 교체</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 한 쪽 평면 비보호 HWPX의 병합 주 셀·단순 문단; 정확한 원문/버전·다른 본문/문단/서식/자원·portable/Canvas 배치·커서·undo/redo·실패원복·저장/UI 재열기
- 다음 작업: 지원 범위별 한글 비교와 실제 모델 품질 확인; 원본 확장은 별도 작업.
- 상위 항목: [B161](<08-tables.md#b161>) 셀 병합
- 선행 작업: [N004](<08-tables.md#n004>)
- Agent 명령: `replace_cell_paragraph`
- 근거: [101-agent-merged-cell-paragraph.md](<../101-agent-merged-cell-paragraph.md>) · [verification-summary.json](<../evidence/parallel-editor-2026-10-15/verification-summary.json>)
- 원래 기록: `CURRENT_51_KIND_CONTRACT`

</details>

<details id="a051">
<summary>A051 · 비병합 셀의 지정 행·열 분할</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 한 쪽 한 단 평면 HWPX 비병합 셀; 외곽·이웃 span·원래 내용/서식/자원 보존; 정확히 zero zone 관측·최소크기·실패원복·저장/UI 재열기
- 다음 작업: 지원 범위별 한글 비교와 실제 모델 품질 확인; 원본 확장은 별도 작업.
- 상위 항목: [B160](<08-tables.md#b160>) 셀 분할
- 선행 작업: [N005](<08-tables.md#n005>)
- Agent 명령: `split_table_cell_into`
- 근거: [102-agent-cell-subdivision.md](<../102-agent-cell-subdivision.md>) · [verification-summary.json](<../evidence/parallel-editor-2026-10-15/verification-summary.json>)
- 원래 기록: `CURRENT_51_KIND_CONTRACT`

</details>

## 함께 보는 기능

- [파일·저장·복구·형식 보존](<05-files-storage-recovery.md>)
- [머리말·각주·필드·책갈피](<10-headers-notes-fields.md>)
- [그림·도형·글상자·수식·개체](<11-objects.md>)

이 파일은 자동 생성한다. 상태는 [CSV](<../jueony-work-checklist.csv>)에서, 기능 배치는 [분류 원본](<../checklist-features.json>)에서 수정한다.
