# 화면·메뉴·작업 창·단축키

[← 종합 진행 현황](<../jueony-progress.md>) · [전체 검색](<../jueony-work-checklist.html>) · [완료 규칙](<../97-master-work-checklist.md>)

한글 UI 통합, 보기·배율·패널·문서 탭, 리본·문맥 메뉴와 키 문맥.

## 진행 요약

실행 작업 **11개**, 상위 범위 **30개**. CSV의 기록을 기능별로 표시한 문서다.

| 구분 | 실행 작업 | 상위 범위 |
| --- | --- | --- |
| 구현 | 완료 7/11 · 부분 3 · 재점검 1 | 완료 0/30 · 부분 18 · 미구현 12 |
| 검증 | 완료 4/11 · 부분 3 · 미검증 4 | 완료 0/30 · 부분 2 · 미검증 28 |
| Agent 연결 | 연결 1/1 · 부분 0 · 해당 없음 10 | 연결 0/30 · 부분 0 · 미연결 30 |

☑ 완료/연결 · ◐ 부분 · ☐ 대기 · ? 재점검 · — 해당 없음. 검증 완료에는 필요한 한글 직접 비교도 포함한다. 구현 완료만으로 세 축 완료가 되지 않는다.

상위 범위는 세 축 완료 **0/30개**다. 세부 작업 완료 수와 분리해서 읽는다.

## 먼저 할 일

- **구현** [N019](<12-ui-and-shortcuts.md#n019>) **한글의 모든 리본·빠른 메뉴·문맥 메뉴 비교** — 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀
- **재점검** [N020](<12-ui-and-shortcuts.md#n020>) **한글 대화상자 활성화 오류 재현·해결** — 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀
- **구현** [N021](<12-ui-and-shortcuts.md#n021>) **본문/표/특수 영역 전체 단축키 매트릭스** — 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀

## 기능별 작업표

관련된 상위 기능과 실행 작업을 함께 묶었다. 각 표는 최대 8개 항목이며, 완료된 항목도 같은 표에 유지한다. ID를 누르면 아래의 완료조건·근거로 이동한다. **범위** 행은 상위 점검, **작업** 행은 실행 작업으로 중복 집계하지 않는다.

- [보기 · 상위 기능 점검 (1)](<#work-1>)
- [보기 · 상위 기능 점검 (2)](<#work-2>)
- [보기 · 상위 기능 점검 (3)](<#work-3>)
- [기본 도구 상자](<#work-4>)
- [문서 탭·상황선·눈금자](<#work-5>)
- [도구 · 상위 기능 점검](<#work-6>)
- [단축키 · 상위 기능 점검](<#work-7>)
- [UI·단축키 · 독립 실행 작업 (1)](<#work-8>)
- [UI·단축키 · 독립 실행 작업 (2)](<#work-9>)

<a id="work-1"></a>

### 보기 · 상위 기능 점검 (1)

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B041](<12-ui-and-shortcuts.md#b041>) · 범위 | 확대 축소 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |
| [B042](<12-ui-and-shortcuts.md#b042>) · 범위 | 쪽·폭 맞춤 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |
| [B043](<12-ui-and-shortcuts.md#b043>) · 범위 | 조판 부호 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |
| [B044](<12-ui-and-shortcuts.md#b044>) · 범위 | 문단 부호 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |
| [B045](<12-ui-and-shortcuts.md#b045>) · 범위 | 투명 선 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |
| [B046](<12-ui-and-shortcuts.md#b046>) · 범위 | 쪽 윤곽 | ☐ 미구현 | ☐ 미검증 | ☐ 미연결 |
| [B047](<12-ui-and-shortcuts.md#b047>) · 범위 | 교정 부호·그림 표시 | ☐ 미구현 | ☐ 미검증 | ☐ 미연결 |
| [B048](<12-ui-and-shortcuts.md#b048>) · 범위 | 메모 표시·안내선 | ☐ 미구현 | ☐ 미검증 | ☐ 미연결 |

<a id="work-2"></a>

### 보기 · 상위 기능 점검 (2)

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B049](<12-ui-and-shortcuts.md#b049>) · 범위 | 한자 발음 표시 | ☐ 미구현 | ☐ 미검증 | ☐ 미연결 |
| [B050](<12-ui-and-shortcuts.md#b050>) · 범위 | 격자 표시 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |
| [B051](<12-ui-and-shortcuts.md#b051>) · 범위 | 격자 설정 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |
| [B052](<12-ui-and-shortcuts.md#b052>) · 범위 | 개체 이동 안내선 | ☐ 미구현 | ☐ 미검증 | ☐ 미연결 |
| [B053](<12-ui-and-shortcuts.md#b053>) · 범위 | 문서 보기 색 | ☐ 미구현 | ☐ 미검증 | ☐ 미연결 |
| [B055](<12-ui-and-shortcuts.md#b055>) · 범위 | 서식 도구 상자 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |
| [B056](<12-ui-and-shortcuts.md#b056>) · 범위 | 도구 상자 사용자 설정 | ☐ 미구현 | ☐ 미검증 | ☐ 미연결 |
| [B057](<12-ui-and-shortcuts.md#b057>) · 범위 | 스타일 작업 창 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |

<a id="work-3"></a>

### 보기 · 상위 기능 점검 (3)

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B058](<12-ui-and-shortcuts.md#b058>) · 범위 | 탐색 작업 창 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |
| [B059](<12-ui-and-shortcuts.md#b059>) · 범위 | 책갈피·개요·클립보드 작업 창 | ☐ 미구현 | ☐ 미검증 | ☐ 미연결 |
| [B060](<12-ui-and-shortcuts.md#b060>) · 범위 | 번역·사전·스크립트 작업 창 | ☐ 미구현 | ☐ 미검증 | ☐ 미연결 |
| [B062](<12-ui-and-shortcuts.md#b062>) · 범위 | 편집 화면 분할 | ☐ 미구현 | ☐ 미검증 | ☐ 미연결 |
| [B063](<12-ui-and-shortcuts.md#b063>) · 범위 | 문서 창 배열 | ☐ 미구현 | ☐ 미검증 | ☐ 미연결 |

<a id="work-4"></a>

### 기본 도구 상자

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B054](<12-ui-and-shortcuts.md#b054>) · 범위 | 기본 도구 상자 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |
| [N019](<12-ui-and-shortcuts.md#n019>) · 작업 | 한글의 모든 리본·빠른 메뉴·문맥 메뉴 비교 | ◐ 부분 | ☐ 미검증 | — 해당 없음 |

<a id="work-5"></a>

### 문서 탭·상황선·눈금자

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B061](<12-ui-and-shortcuts.md#b061>) · 범위 | 문서 탭·상황선·눈금자 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |
| [N023](<12-ui-and-shortcuts.md#n023>) · 작업 | 큰 DPI·배율·좁은 화면 전체 환경 | ◐ 부분 | ☐ 미검증 | — 해당 없음 |

<a id="work-6"></a>

### 도구 · 상위 기능 점검

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B148](<12-ui-and-shortcuts.md#b148>) · 범위 | 글자판 설정 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |
| [B150](<12-ui-and-shortcuts.md#b150>) · 범위 | 사용자 설정 | ☐ 미구현 | ☐ 미검증 | ☐ 미연결 |
| [B151](<12-ui-and-shortcuts.md#b151>) · 범위 | 환경 설정 | ◐ 부분 | ◐ 부분 | ☐ 미연결 |
| [B152](<12-ui-and-shortcuts.md#b152>) · 범위 | 스킨 설정 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |

<a id="work-7"></a>

### 단축키 · 상위 기능 점검

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B179](<12-ui-and-shortcuts.md#b179>) · 범위 | 메뉴 키팁 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |
| [B180](<12-ui-and-shortcuts.md#b180>) · 범위 | 빠른 메뉴 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |
| [B181](<12-ui-and-shortcuts.md#b181>) · 범위 | 문서 탭 순환 | ◐ 부분 | ◐ 부분 | ☐ 미연결 |

<a id="work-8"></a>

### UI·단축키 · 독립 실행 작업 (1)

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [G012](<12-ui-and-shortcuts.md#g012>) · 작업 | 앱과 편집기의 중복 메뉴 통합 | ☑ 완료 | ◐ 부분 | — 해당 없음 |
| [G013](<12-ui-and-shortcuts.md#g013>) · 작업 | 채팅·문서 사이 가변 너비 | ☑ 완료 | ☑ 완료 | — 해당 없음 |
| [G014](<12-ui-and-shortcuts.md#g014>) · 작업 | 채팅 목록·폴더 트리 사이 가변 높이 | ☑ 완료 | ◐ 부분 | — 해당 없음 |
| [G015](<12-ui-and-shortcuts.md#g015>) · 작업 | 문서 집중 보기·패널 복원 | ☑ 완료 | ☑ 완료 | — 해당 없음 |
| [G016](<12-ui-and-shortcuts.md#g016>) · 작업 | 문서 탭 순환과 활성 탭 소유 | ☑ 완료 | ◐ 부분 | — 해당 없음 |
| [G017](<12-ui-and-shortcuts.md#g017>) · 작업 | 채팅 Enter 전송·Shift+Enter 줄바꿈 | ☑ 완료 | ☑ 완료 | — 해당 없음 |
| [G018](<12-ui-and-shortcuts.md#g018>) · 작업 | 미지원 기능의 성공 표시 차단 | ☑ 완료 | ☑ 완료 | ☑ 연결 |
| [N020](<12-ui-and-shortcuts.md#n020>) · 작업 | 한글 대화상자 활성화 오류 재현·해결 | ? 재점검 | ☐ 미검증 | — 해당 없음 |

<a id="work-9"></a>

### UI·단축키 · 독립 실행 작업 (2)

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [N021](<12-ui-and-shortcuts.md#n021>) · 작업 | 본문/표/특수 영역 전체 단축키 매트릭스 | ◐ 부분 | ☐ 미검증 | — 해당 없음 |

## 항목별 완료조건·근거

각 항목은 펼쳐서 읽는다. 상태와 근거는 CSV에서 관리한다.

<details id="b041">
<summary>B041 · 확대 축소</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 수치·맞춤 모드·복원은 상태 트랙
- UI 명령: `view:zoom-dialog`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `WIRED;NOT_RUN`

</details>

<details id="b042">
<summary>B042 · 쪽·폭 맞춤</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 창 크기 변경 재계산 필요
- UI 명령: `view:zoom-fit-page`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `WIRED;NOT_RUN`

</details>

<details id="b043">
<summary>B043 · 조판 부호</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 문서 내용 비변경 검수
- UI 명령: `view:ctrl-mark`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `WIRED;NOT_RUN`

</details>

<details id="b044">
<summary>B044 · 문단 부호</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 탭 간 사용자 설정 동기화 검사
- UI 명령: `view:para-mark`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `WIRED;NOT_RUN`

</details>

<details id="b045">
<summary>B045 · 투명 선</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 표 진입·이탈 표시 비교
- UI 명령: `view:border-transparent`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `WIRED;NOT_RUN`

</details>

<details id="b046">
<summary>B046 · 쪽 윤곽</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ☐ 미구현 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 페이지 여백 숨김 경로 대조 필요
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `MISSING;NOT_RUN`

</details>

<details id="b047">
<summary>B047 · 교정 부호·그림 표시</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ☐ 미구현 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 표시 옵션 미연결
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `MISSING;NOT_RUN`

</details>

<details id="b048">
<summary>B048 · 메모 표시·안내선</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ☐ 미구현 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 주석 구조 지원과 UI는 별개
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `MISSING;NOT_RUN`

</details>

<details id="b049">
<summary>B049 · 한자 발음 표시</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ☐ 미구현 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 발음 데이터·설정 필요
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `MISSING;NOT_RUN`

</details>

<details id="b050">
<summary>B050 · 격자 표시</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 그리기 기준 검수
- UI 명령: `view:toggle-grid`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `WIRED;NOT_RUN`

</details>

<details id="b051">
<summary>B051 · 격자 설정</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 간격·맞추기·수명 검수
- UI 명령: `view:grid-settings`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `WIRED;NOT_RUN`

</details>

<details id="b052">
<summary>B052 · 개체 이동 안내선</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ☐ 미구현 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 표시·설정 하위 항목 필요
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `MISSING;NOT_RUN`

</details>

<details id="b053">
<summary>B053 · 문서 보기 색</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ☐ 미구현 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 앱 테마와 다른 문서 보기 기능
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `MISSING;NOT_RUN`

</details>

<details id="b054">
<summary>B054 · 기본 도구 상자</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 이번 누락키 복구; 한글 단계별 접기 전체는 미검증
- UI 명령: `view:toolbox-basic`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `PARTIAL;NOT_RUN`

</details>

<details id="b055">
<summary>B055 · 서식 도구 상자</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 재실행 및 전체 chrome 연결 검수
- UI 명령: `view:toolbox-format`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `WIRED;NOT_RUN`

</details>

<details id="b056">
<summary>B056 · 도구 상자 사용자 설정</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ☐ 미구현 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 단축키/메뉴 사용자 편집 없음
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `MISSING;NOT_RUN`

</details>

<details id="b057">
<summary>B057 · 스타일 작업 창</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: Jueony style panel; 한글 창 동작 비교 필요
- UI 명령: `format:apply-style`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `PARTIAL;NOT_RUN`

</details>

<details id="b058">
<summary>B058 · 탐색 작업 창</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 본문·표 텍스트 탐색만 지원. 개체·수식·머리말·꼬리말·주석·고급 조건 미지원.
- UI 명령: `ext:jueony-navigation-pane`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `PARTIAL;NOT_RUN`

</details>

<details id="b059">
<summary>B059 · 책갈피·개요·클립보드 작업 창</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ☐ 미구현 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 대화상자 기능과 작업창 구분
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `MISSING;NOT_RUN`

</details>

<details id="b060">
<summary>B060 · 번역·사전·스크립트 작업 창</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ☐ 미구현 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 외부 의존 포함 하위 조사 필요
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `MISSING;NOT_RUN`

</details>

<details id="b061">
<summary>B061 · 문서 탭·상황선·눈금자</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 기본 표시 존재; 개별 표시 옵션·수명 미검증
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `PARTIAL;NOT_RUN`

</details>

<details id="b062">
<summary>B062 · 편집 화면 분할</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ☐ 미구현 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: Agent 패널 분할과 별개 기능
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `MISSING;NOT_RUN`

</details>

<details id="b063">
<summary>B063 · 문서 창 배열</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ☐ 미구현 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 단일 host iframe 탭 기반
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `MISSING;NOT_RUN`

</details>

<details id="b148">
<summary>B148 · 글자판 설정</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: Windows IME 사용; 한글의 별도 자판 관리 없음
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `PARTIAL;NOT_RUN`

</details>

<details id="b150">
<summary>B150 · 사용자 설정</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ☐ 미구현 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 메뉴/도구/키매핑 사용자 편집 없음
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `MISSING;NOT_RUN`

</details>

<details id="b151">
<summary>B151 · 환경 설정</summary>

- 종류: 한글 상위 기능 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ☐ 미연결.
- 검증 구분: 자동 **PARTIAL** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 대표 글꼴·보기·테마·대화상자 옵션·복구·새 문서 기본값 JSON 교환, 버전/범위·동시 변경·부분 저장 실패 복원·재실행 검사. 업무/문서별 커서·전체 한글 환경 이관과 수명 비교 남음.
- UI 명령: `tool:options; tool:settings-backup`
- 근거: [session.json](<../evidence/pre-agent-2026-10-13/checks/session.json>) · [formatting.json](<../evidence/pre-agent-2026-10-13/checks/formatting.json>) · [basic-text-browser.json](<../evidence/remaining-editor-2026-10-13/basic-text-browser.json>)
- 원래 기록: `PARTIAL;BROWSER_TESTED_NATIVE_PENDING`

</details>

<details id="b152">
<summary>B152 · 스킨 설정</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: Studio theme/skin 일부 재사용
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `PARTIAL;NOT_RUN`

</details>

<details id="b179">
<summary>B179 · 메뉴 키팁</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: Studio 메뉴 포커스와 한글 키팁 체계 차이
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `PARTIAL;NOT_RUN`

</details>

<details id="b180">
<summary>B180 · 빠른 메뉴</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 현재 선택의 Shift+F10 빠른 메뉴·비활성 건너뛰기·방향/Home/End/Enter/Space/Esc·포커스 복원 검사. 한글 전체 메뉴 항목·접근키·특수 개체 문맥 비교 남음.
- UI 명령: `; ext:jueony-context-menu`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>) · [basic-text-browser.json](<../evidence/remaining-editor-2026-10-13/basic-text-browser.json>)
- 원래 기록: `PARTIAL;NOT_RUN`

</details>

<details id="b181">
<summary>B181 · 문서 탭 순환</summary>

- 종류: 한글 상위 기능 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ☐ 미연결.
- 검증 구분: 자동 **PARTIAL** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 동일 업무 본문 문서 Ctrl+Tab/Ctrl+Shift+Tab 순환, 순서 wrap·선택/bytes 보존·modal/IME/채팅 격리 검수. 표 Ctrl+Tab 문자 삽입·Ctrl+Shift+Tab 내어쓰기 분리. 특수 영역/단일 창 전체 한글 비교는 남음.
- UI 명령: `host:document-tab-cycle`
- 근거: [session.json](<../evidence/pre-agent-2026-10-13/checks/session.json>)
- 원래 기록: `PARTIAL;BROWSER_TESTED_NATIVE_PENDING`

</details>

<details id="g012">
<summary>G012 · 앱과 편집기의 중복 메뉴 통합</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 현재 통합 메뉴; 전체 한글 리본/작업 창 동등성 제외
- 다음 작업: 정의한 범위 회귀 유지; 한글 비교 대기
- 근거: [44-editor-stages-result.md](<../44-editor-stages-result.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g013">
<summary>G013 · 채팅·문서 사이 가변 너비</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 드래그·키보드·초기화·재실행 저장
- 다음 작업: 기록된 범위 유지·관련 변경 시 회귀 검사
- 근거: [18-pane-resize-agent-check.md](<../18-pane-resize-agent-check.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g014">
<summary>G014 · 채팅 목록·폴더 트리 사이 가변 높이</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PARTIAL** / 한글 **NA**.
- 완료 범위: 업무 화면 분할 조절; OS 조합 검증 별도
- 다음 작업: 기록된 범위 유지·관련 변경 시 회귀 검사
- 근거: [12-mvp-implementation.md](<../12-mvp-implementation.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g015">
<summary>G015 · 문서 집중 보기·패널 복원</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 동일 문서 엔진 유지·패널 표시 환경 저장
- 다음 작업: 기록된 범위 유지·관련 변경 시 회귀 검사
- 근거: [28-continuation-implementation.md](<../28-continuation-implementation.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g016">
<summary>G016 · 문서 탭 순환과 활성 탭 소유</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 지원 문서 탭·키 경로; 모든 창 관리 제외
- 다음 작업: 정의한 범위 회귀 유지; 한글 비교 대기
- 근거: [44-editor-stages-result.md](<../44-editor-stages-result.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g017">
<summary>G017 · 채팅 Enter 전송·Shift+Enter 줄바꿈</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 입력·진행·오류 표시와 실제 요청 흐름
- 다음 작업: 기록된 범위 유지·관련 변경 시 회귀 검사
- 근거: [19-agent-interaction-fix.md](<../19-agent-interaction-fix.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g018">
<summary>G018 · 미지원 기능의 성공 표시 차단</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 불가 명령·잘못된 범위·보호 원본 요청 거절
- 다음 작업: 기록된 범위 유지·관련 변경 시 회귀 검사
- 근거: [96-agent-table-merge.md](<../96-agent-table-merge.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="n019">
<summary>N019 · 한글의 모든 리본·빠른 메뉴·문맥 메뉴 비교</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent — 해당 없음.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 하위 dialog/표·개체·특수 영역·disabled 조건까지
- 다음 작업: 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀
- 상위 항목: [B054](<12-ui-and-shortcuts.md#b054>) 기본 도구 상자
- 근거: [25-hangul-parity-and-state-plan.md](<../25-hangul-parity-and-state-plan.md>)
- 원래 기록: `EXPLICIT_REMAINING_OR_AUDIT`

</details>

<details id="n020">
<summary>N020 · 한글 대화상자 활성화 오류 재현·해결</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ? 재점검 / 검증 ☐ 미검증 / Agent — 해당 없음.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 일반 권한·modal 소유·foreground 정책 증거; 실패 우회 검증
- 다음 작업: 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀
- 상위 항목: [B098](<07-formatting-and-styles.md#b098>) 스타일
- 근거: [39-native-dialog-investigation.md](<../39-native-dialog-investigation.md>)
- 원래 기록: `EXPLICIT_REMAINING_OR_AUDIT`

</details>

<details id="n021">
<summary>N021 · 본문/표/특수 영역 전체 단축키 매트릭스</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent — 해당 없음.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한컴 기본 매핑·선택/IME/대화상자/OS 예약키 조합
- 다음 작업: 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀
- 상위 항목: [B169](<08-tables.md#b169>) 첫 셀·셀 블록
- 근거: [16-hangul-shortcuts-plan.md](<../16-hangul-shortcuts-plan.md>)
- 원래 기록: `EXPLICIT_REMAINING_OR_AUDIT`

</details>

<details id="n023">
<summary>N023 · 큰 DPI·배율·좁은 화면 전체 환경</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent — 해당 없음.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 125/150/200%·다중 모니터·좌표/선택·보기 수명
- 다음 작업: 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀
- 상위 항목: [B061](<12-ui-and-shortcuts.md#b061>) 문서 탭·상황선·눈금자
- 근거: [44-editor-stages-result.md](<../44-editor-stages-result.md>)
- 원래 기록: `EXPLICIT_REMAINING_OR_AUDIT`

</details>

## 함께 보는 기능

- [상태 저장·환경·선택 복원](<13-state-and-preferences.md>)
- [본문 편집·입력·선택·찾기](<06-editing-and-selection.md>)
- [글자·문단·스타일·번호](<07-formatting-and-styles.md>)

이 파일은 자동 생성한다. 상태는 [CSV](<../jueony-work-checklist.csv>)에서, 기능 배치는 [분류 원본](<../checklist-features.json>)에서 수정한다.
