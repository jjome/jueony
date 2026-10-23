# 글자·문단·스타일·번호

[← 종합 진행 현황](<../jueony-progress.md>) · [전체 검색](<../jueony-work-checklist.html>) · [완료 규칙](<../97-master-work-checklist.md>)

글자·문단 모양, 스타일, 목록·개요·탭과 관련 빠른키 및 Agent 명령.

## 진행 요약

실행 작업 **24개**, 상위 범위 **18개**. CSV의 기록을 기능별로 표시한 문서다.

| 구분 | 실행 작업 | 상위 범위 |
| :--- | :---: | :---: |
| 구현 | 완료 20/24 · 부분 2 · 미구현 2 | 완료 0/18 · 부분 15 · 미구현 2 · stub 1 |
| 검증 | 완료 0/24 · 부분 20 · 미검증 4 | 완료 0/18 · 부분 4 · 미검증 14 |
| Agent 연결 | 연결 13/16 · 부분 0 · 미연결 3 · 해당 없음 8 | 연결 0/18 · 부분 10 · 미연결 8 |

☑ 완료/연결 · ◐ 부분 · ☐ 대기 · ? 재점검 · — 해당 없음. 검증 완료에는 필요한 한글 직접 비교도 포함한다. 구현 완료만으로 세 축 완료가 되지 않는다.

상위 범위는 세 축 완료 **0/18개**다. 세부 작업 완료 수와 분리해서 읽는다.

## 먼저 할 일

- **구현** [N011](<07-formatting-and-styles.md#n011>) **스타일 가져오기·내보내기** — 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀
- **구현** [N012](<07-formatting-and-styles.md#n012>) **범위 글자 스타일의 영구 정의 연결** — 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀
- **구현** [N013](<07-formatting-and-styles.md#n013>) **스타일마당과 사용자 번호키 재할당** — 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀

## 기능별 작업표

관련된 상위 기능과 실행 작업을 함께 묶었다. 각 표는 최대 8개 항목이며, 완료된 항목도 같은 표에 유지한다. ID를 누르면 아래의 완료조건·근거로 이동한다. **범위** 행은 상위 점검, **작업** 행은 실행 작업으로 중복 집계하지 않는다.

- [입력 · 상위 기능 점검](<#work-1>)
- [글자 모양](<#work-2>)
- [문단 모양](<#work-3>)
- [스타일](<#work-4>)
- [문단 번호](<#work-5>)
- [글머리표](<#work-6>)
- [개요 번호](<#work-7>)
- [서식 · 상위 기능 점검 (1)](<#work-8>)
- [서식 · 상위 기능 점검 (2)](<#work-9>)
- [문단 여백·첫줄 빠른키](<#work-10>)
- [스타일마당](<#work-11>)
- [입력·선택 · 독립 실행 작업](<#work-12>)
- [서식·스타일 · 독립 실행 작업](<#work-13>)

<a id="work-1"></a>

### 입력 · 상위 기능 점검

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B080](<07-formatting-and-styles.md#b080>) · 범위 | 문단 띠 | ☐ stub | ☐ 미검증 | ☐ 미연결 |

<a id="work-2"></a>

### 글자 모양

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B096](<07-formatting-and-styles.md#b096>) · 범위 | 글자 모양 | ◐ 부분 | ☐ 미검증 | ◐ 부분 |
| [A029](<07-formatting-and-styles.md#a029>) · 작업 | 본문 글꼴·글자 서식 | ☑ 완료 | ◐ 부분 | ☑ 연결 |
| [G113](<07-formatting-and-styles.md#g113>) · 작업 | 새 글꼴 선언과 언어별 글꼴 참조 보존 | ☑ 완료 | ◐ 부분 | — 해당 없음 |

<a id="work-3"></a>

### 문단 모양

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B097](<07-formatting-and-styles.md#b097>) · 범위 | 문단 모양 | ◐ 부분 | ☐ 미검증 | ◐ 부분 |
| [A016](<07-formatting-and-styles.md#a016>) · 작업 | 문단 기본 테두리·배경 | ☑ 완료 | ◐ 부분 | ☑ 연결 |
| [A017](<07-formatting-and-styles.md#a017>) · 작업 | 문단 사용자·자동 탭 | ☑ 완료 | ◐ 부분 | ☑ 연결 |
| [A030](<07-formatting-and-styles.md#a030>) · 작업 | 본문 문단 서식 | ☑ 완료 | ◐ 부분 | ☑ 연결 |

<a id="work-4"></a>

### 스타일

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B098](<07-formatting-and-styles.md#b098>) · 범위 | 스타일 | ◐ 부분 | ◐ 부분 | ◐ 부분 |
| [A008](<07-formatting-and-styles.md#a008>) · 작업 | 다음 문단 스타일 | ☑ 완료 | ◐ 부분 | ☑ 연결 |
| [A009](<07-formatting-and-styles.md#a009>) · 작업 | 문단 스타일 이름 변경 | ☑ 완료 | ◐ 부분 | ☑ 연결 |
| [A010](<07-formatting-and-styles.md#a010>) · 작업 | 저장 모양을 공유하는 스타일 생성 | ☑ 완료 | ◐ 부분 | ☑ 연결 |
| [A039](<07-formatting-and-styles.md#a039>) · 작업 | 기존 문단 스타일 적용 | ☑ 완료 | ◐ 부분 | ☑ 연결 |
| [N011](<07-formatting-and-styles.md#n011>) · 작업 | 스타일 가져오기·내보내기 | ☐ 미구현 | ☐ 미검증 | ☐ 미연결 |
| [N012](<07-formatting-and-styles.md#n012>) · 작업 | 범위 글자 스타일의 영구 정의 연결 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |

<a id="work-5"></a>

### 문단 번호

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B099](<07-formatting-and-styles.md#b099>) · 범위 | 문단 번호 | ◐ 부분 | ☐ 미검증 | ◐ 부분 |
| [A012](<07-formatting-and-styles.md#a012>) · 작업 | 새 기본 문단 번호 생성 | ☑ 완료 | ◐ 부분 | ☑ 연결 |
| [A013](<07-formatting-and-styles.md#a013>) · 작업 | 문단 번호 모양 복제 | ☑ 완료 | ◐ 부분 | ☑ 연결 |
| [A015](<07-formatting-and-styles.md#a015>) · 작업 | 저장된 번호·글머리표 적용·해제 | ☑ 완료 | ◐ 부분 | ☑ 연결 |

<a id="work-6"></a>

### 글머리표

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B100](<07-formatting-and-styles.md#b100>) · 범위 | 글머리표 | ◐ 부분 | ☐ 미검증 | ◐ 부분 |
| [A014](<07-formatting-and-styles.md#a014>) · 작업 | 기본 글머리표 생성 | ☑ 완료 | ◐ 부분 | ☑ 연결 |

<a id="work-7"></a>

### 개요 번호

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B101](<07-formatting-and-styles.md#b101>) · 범위 | 개요 번호 | ◐ 부분 | ☐ 미검증 | ◐ 부분 |
| [A011](<07-formatting-and-styles.md#a011>) · 작업 | 구역 개요 정의의 수준 적용·해제 | ☑ 완료 | ◐ 부분 | ☑ 연결 |

<a id="work-8"></a>

### 서식 · 상위 기능 점검 (1)

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B102](<07-formatting-and-styles.md#b102>) · 범위 | 단계 증가·감소 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |
| [B103](<07-formatting-and-styles.md#b103>) · 범위 | 진하게·기울임·밑줄 | ◐ 부분 | ☐ 미검증 | ◐ 부분 |
| [B104](<07-formatting-and-styles.md#b104>) · 범위 | 위·아래 첨자 | ◐ 부분 | ☐ 미검증 | ◐ 부분 |
| [B105](<07-formatting-and-styles.md#b105>) · 범위 | 보통 모양 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |
| [B106](<07-formatting-and-styles.md#b106>) · 범위 | 크기·자간·장평 조정 | ◐ 부분 | ☐ 미검증 | ◐ 부분 |
| [B107](<07-formatting-and-styles.md#b107>) · 범위 | 문단 정렬 | ◐ 부분 | ☐ 미검증 | ◐ 부분 |
| [B108](<07-formatting-and-styles.md#b108>) · 범위 | 빠른 내어쓰기 | ◐ 부분 | ◐ 부분 | ☐ 미연결 |
| [B110](<07-formatting-and-styles.md#b110>) · 범위 | 스타일 번호 바로키 | ◐ 부분 | ◐ 부분 | ☐ 미연결 |

<a id="work-9"></a>

### 서식 · 상위 기능 점검 (2)

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B183](<07-formatting-and-styles.md#b183>) · 범위 | 문단 첫 글자 장식 | ☐ 미구현 | ☐ 미검증 | ☐ 미연결 |

<a id="work-10"></a>

### 문단 여백·첫줄 빠른키

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B109](<07-formatting-and-styles.md#b109>) · 범위 | 문단 여백·첫줄 빠른키 | ◐ 부분 | ◐ 부분 | ☐ 미연결 |
| [N022](<07-formatting-and-styles.md#n022>) · 작업 | 문단 여백 복합키의 한글 차이 해결 | ◐ 부분 | ☐ 미검증 | — 해당 없음 |

<a id="work-11"></a>

### 스타일마당

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B184](<07-formatting-and-styles.md#b184>) · 범위 | 스타일마당 | ☐ 미구현 | ☐ 미검증 | ☐ 미연결 |
| [N013](<07-formatting-and-styles.md#n013>) · 작업 | 스타일마당과 사용자 번호키 재할당 | ☐ 미구현 | ☐ 미검증 | ☐ 미연결 |

<a id="work-12"></a>

### 입력·선택 · 독립 실행 작업

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [G020](<07-formatting-and-styles.md#g020>) · 작업 | Ctrl+1~0 기본 스타일과 입력 문맥 | ☑ 완료 | ◐ 부분 | — 해당 없음 |
| [G021](<07-formatting-and-styles.md#g021>) · 작업 | 문단 여백·첫 줄 증감 빠른키 | ☑ 완료 | ◐ 부분 | — 해당 없음 |

<a id="work-13"></a>

### 서식·스타일 · 독립 실행 작업

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [G036](<07-formatting-and-styles.md#g036>) · 작업 | 글자 스타일의 선택 범위 모양 적용 | ☑ 완료 | ◐ 부분 | — 해당 없음 |
| [G037](<07-formatting-and-styles.md#g037>) · 작업 | 문단 끝 Enter의 다음 스타일 | ☑ 완료 | ◐ 부분 | — 해당 없음 |
| [G038](<07-formatting-and-styles.md#g038>) · 작업 | 스타일 순서 이동과 참조 재배치 | ☑ 완료 | ◐ 부분 | — 해당 없음 |
| [G039](<07-formatting-and-styles.md#g039>) · 작업 | 특수 영역의 스타일 모양 전파 | ☑ 완료 | ◐ 부분 | — 해당 없음 |

## 항목별 완료조건·근거

각 항목은 펼쳐서 읽는다. 상태와 근거는 CSV에서 관리한다.

<details id="b080">
<summary>B080 · 문단 띠</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ☐ stub / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 명령은 등록됐지만 canExecute=false, 빈 execute.
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `STUB;NOT_RUN`

</details>

<details id="b096">
<summary>B096 · 글자 모양</summary>

- 종류: 한글 상위 기능 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ◐ 부분.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 혼합 서식·취소·입력 대기 서식 검사
- UI 명령: `format:char-shape`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `WIRED;NOT_RUN`

</details>

<details id="b097">
<summary>B097 · 문단 모양</summary>

- 종류: 한글 상위 기능 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ◐ 부분.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 기본 탭 간격 단위·구역별 조판·대화상자·snapshot undo 보강. 문단 모양 전체 항목과 한글 조판 비교는 남음.
- UI 명령: `format:para-shape`
- 근거: [engine-result.json](<../evidence/sections-tabs-2026-10-12/engine-result.json>) · [parity-result.json](<../evidence/sections-tabs-2026-10-12/parity-result.json>) · [hancom-baseline.json](<../evidence/sections-tabs-2026-10-12/hancom-baseline.json>)
- 원래 기록: `PARTIAL;NOT_RUN`

</details>

<details id="b098">
<summary>B098 · 스타일</summary>

- 종류: 한글 상위 기능 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ◐ 부분.
- 검증 구분: 자동 **PARTIAL** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 기존 스타일 관리에 기본 스타일 JSON 교환 추가: 언어별 글꼴·서식·다음 스타일 연결·이름 충돌·기존 문서 유지·undo/저장 검사. 한글 STY·번호/개요/테두리/배경/사용자 탭 스타일·사용자 번호키·범위 정의 연결 남음.
- UI 명령: `format:style-dialog; format:style-package`
- 근거: [parity.json](<../evidence/pre-agent-2026-10-13/checks/parity.json>) · [style-order-engine.json](<../evidence/pre-agent-2026-10-13/checks/style-order-engine.json>) · [style-stories-engine.json](<../evidence/pre-agent-2026-10-13/checks/style-stories-engine.json>) · [basic-text-browser.json](<../evidence/remaining-editor-2026-10-13/basic-text-browser.json>)
- 원래 기록: `PARTIAL;BROWSER_TESTED_NATIVE_PENDING`

</details>

<details id="b099">
<summary>B099 · 문단 번호</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ◐ 부분.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 다단계 번호·재시작 비교
- UI 명령: `format:para-num-shape`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `WIRED;NOT_RUN`

</details>

<details id="b100">
<summary>B100 · 글머리표</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ◐ 부분.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 문자·그림 목록 차이 확인
- UI 명령: `format:bullet-shape`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `WIRED;NOT_RUN`

</details>

<details id="b101">
<summary>B101 · 개요 번호</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ◐ 부분.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 일반 번호와 독립 기능 대조 필요
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `PARTIAL;NOT_RUN`

</details>

<details id="b102">
<summary>B102 · 단계 증가·감소</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 명령 존재; 해당 물리 키 매핑 없음
- UI 명령: `format:level-increase`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `PARTIAL;NOT_RUN`

</details>

<details id="b103">
<summary>B103 · 진하게·기울임·밑줄</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ◐ 부분.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 동일 그룹 각각 매핑 존재
- UI 명령: `format:bold`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `WIRED;NOT_RUN`

</details>

<details id="b104">
<summary>B104 · 위·아래 첨자</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ◐ 부분.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 입력 대기 속성·혼합 범위 비교
- UI 명령: `format:superscript`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `WIRED;NOT_RUN`

</details>

<details id="b105">
<summary>B105 · 보통 모양</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 초기화 속성 집합 실측 필요
- UI 명령: `ext:jueony-normal`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `WIRED;NOT_RUN`

</details>

<details id="b106">
<summary>B106 · 크기·자간·장평 조정</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ◐ 부분.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 각 증가 단위와 clamp 검수
- UI 명령: `format:font-size-increase`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `WIRED;NOT_RUN`

</details>

<details id="b107">
<summary>B107 · 문단 정렬</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ◐ 부분.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 각 정렬 키 등록; 브라우저 선점 별도
- UI 명령: `format:align-justify`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `WIRED;NOT_RUN`

</details>

<details id="b108">
<summary>B108 · 빠른 내어쓰기</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ☐ 미연결.
- 검증 구분: 자동 **PARTIAL** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 본문/평면 셀 첫 줄 커서의 실제 폭으로 내어쓰기·반복 no-op·undo·두 형식 저장 검수. 범위/다음 시각 줄/중첩·특수 영역과 실제 한글 비교 남음.
- UI 명령: `ext:jueony-hanging-indent`
- 근거: [result.json](<../evidence/pre-agent-editor-2026-10-12/final/result.json>)
- 원래 기록: `PARTIAL;BROWSER_TESTED_NATIVE_PENDING`

</details>

<details id="b109">
<summary>B109 · 문단 여백·첫줄 빠른키</summary>

- 종류: 한글 상위 기능 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ☐ 미연결.
- 검증 구분: 자동 **PARTIAL** / 한글 **PARTIAL**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 개별 왼쪽/오른쪽/첫줄 ±1pt 및 음수 첫줄을 실제 한글 저장 XML에서 확인. 양쪽 Ctrl+F7/F8은 이 설치가 공식 도움말 및 앱과 반대: 기본 키 설정 조사 필요. 다른 크기·대체키·범위/반복/특수 영역 비교 남음.
- UI 명령: `ext:jueony-paragraph-spacing`
- 근거: [result.json](<../evidence/selection-spacing-2026-10-12/verified/result.json>) · [native-spacing.json](<../evidence/navigation-history-2026-10-12/native-spacing.json>) · [native-key-sequence.json](<../evidence/navigation-history-2026-10-12/native-key-sequence.json>)
- 원래 기록: `PARTIAL;INDIVIDUAL_DELTAS_MATCH_BOTH_F7_F8_DIFFER`

</details>

<details id="b110">
<summary>B110 · 스타일 번호 바로키</summary>

- 종류: 한글 상위 기능 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ☐ 미연결.
- 검증 구분: 자동 **PARTIAL** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: Ctrl+1..0 기본 스타일 연결·undo·HWPX 재열기 검수. 사용자 재할당과 실제 한글 적용 비교는 남음.
- UI 명령: `ext:jueony-default-style`
- 근거: [result.json](<../evidence/basic-state-2026-10-12/browser-verified/result.json>) · [native-dialog-diagnosis.json](<../evidence/basic-state-2026-10-12/native-dialog-diagnosis.json>)
- 원래 기록: `PARTIAL;BROWSER_TESTED_NATIVE_INPUT_BLOCKED`

</details>

<details id="b183">
<summary>B183 · 문단 첫 글자 장식</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ☐ 미구현 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 전용 편집 UI·명령 연결 없음. 단락 시작 장식과 줄 배치·저장 구현.
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>)
- 원래 기록: `MISSING;NOT_RUN`

</details>

<details id="b184">
<summary>B184 · 스타일마당</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ☐ 미구현 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 한 쪽의 완전한 일반 본문 문단 지우기·설정 유지·단일 undo·안전 저장 구현. 본문 없는 문단 하나의 구역은 별도 명령으로 삭제하며 남은 구역 설정 보존. 유일한 구역/공백/복잡한 문서 차단. 걸친 문단·표·개체·여러 쪽 삭제와 자동 정리 남음. HWPX 파일 캐럿은 미지원, 로컬 상태 복원은 검증.
- 근거: [result.json](<../evidence/empty-section-2026-10-14/empty-native/result.json>) · [result.json](<../evidence/empty-section-2026-10-14/empty-browser/result.json>) · [59-empty-body-section-removal.md](<../59-empty-body-section-removal.md>)
- 원래 기록: `MISSING;NOT_RUN`

</details>

<details id="a008">
<summary>A008 · 다음 문단 스타일</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 현재 계약이 허용하는 조회·대상·파일형식·보호·크기·묶음 제한 안의 내부 Agent 연결. 모든 원본/한글 기능을 지원한다는 의미 아님.
- 다음 작업: 지원 범위별 한글 비교와 실제 모델 품질 확인; 원본 확장은 별도 작업.
- 상위 항목: [B098](<07-formatting-and-styles.md#b098>) 스타일
- Agent 명령: `set_next_paragraph_style`
- 근거: [83-agent-next-paragraph-style.md](<../83-agent-next-paragraph-style.md>) · [wire-schema.mjs](<../../apps/editor/src/modules/document/public/wire-schema.mjs>)
- 원래 기록: `CURRENT_46_KIND_CONTRACT`

</details>

<details id="a009">
<summary>A009 · 문단 스타일 이름 변경</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 현재 계약이 허용하는 조회·대상·파일형식·보호·크기·묶음 제한 안의 내부 Agent 연결. 모든 원본/한글 기능을 지원한다는 의미 아님.
- 다음 작업: 지원 범위별 한글 비교와 실제 모델 품질 확인; 원본 확장은 별도 작업.
- 상위 항목: [B098](<07-formatting-and-styles.md#b098>) 스타일
- Agent 명령: `rename_paragraph_style`
- 근거: [82-agent-paragraph-style-rename.md](<../82-agent-paragraph-style-rename.md>) · [wire-schema.mjs](<../../apps/editor/src/modules/document/public/wire-schema.mjs>)
- 원래 기록: `CURRENT_46_KIND_CONTRACT`

</details>

<details id="a010">
<summary>A010 · 저장 모양을 공유하는 스타일 생성</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 현재 계약이 허용하는 조회·대상·파일형식·보호·크기·묶음 제한 안의 내부 Agent 연결. 모든 원본/한글 기능을 지원한다는 의미 아님.
- 다음 작업: 지원 범위별 한글 비교와 실제 모델 품질 확인; 원본 확장은 별도 작업.
- 상위 항목: [B098](<07-formatting-and-styles.md#b098>) 스타일
- Agent 명령: `create_paragraph_style`
- 근거: [81-agent-paragraph-style-create.md](<../81-agent-paragraph-style-create.md>) · [wire-schema.mjs](<../../apps/editor/src/modules/document/public/wire-schema.mjs>)
- 원래 기록: `CURRENT_46_KIND_CONTRACT`

</details>

<details id="a011">
<summary>A011 · 구역 개요 정의의 수준 적용·해제</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 현재 계약이 허용하는 조회·대상·파일형식·보호·크기·묶음 제한 안의 내부 Agent 연결. 모든 원본/한글 기능을 지원한다는 의미 아님.
- 다음 작업: 지원 범위별 한글 비교와 실제 모델 품질 확인; 원본 확장은 별도 작업.
- 상위 항목: [B101](<07-formatting-and-styles.md#b101>) 개요 번호
- Agent 명령: `set_paragraph_outline`
- 근거: [80-agent-paragraph-outline.md](<../80-agent-paragraph-outline.md>) · [wire-schema.mjs](<../../apps/editor/src/modules/document/public/wire-schema.mjs>)
- 원래 기록: `CURRENT_46_KIND_CONTRACT`

</details>

<details id="a012">
<summary>A012 · 새 기본 문단 번호 생성</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 현재 계약이 허용하는 조회·대상·파일형식·보호·크기·묶음 제한 안의 내부 Agent 연결. 모든 원본/한글 기능을 지원한다는 의미 아님.
- 다음 작업: 지원 범위별 한글 비교와 실제 모델 품질 확인; 원본 확장은 별도 작업.
- 상위 항목: [B099](<07-formatting-and-styles.md#b099>) 문단 번호
- Agent 명령: `set_basic_numbering`
- 근거: [79-agent-basic-numbering.md](<../79-agent-basic-numbering.md>) · [wire-schema.mjs](<../../apps/editor/src/modules/document/public/wire-schema.mjs>)
- 원래 기록: `CURRENT_46_KIND_CONTRACT`

</details>

<details id="a013">
<summary>A013 · 문단 번호 모양 복제</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 현재 계약이 허용하는 조회·대상·파일형식·보호·크기·묶음 제한 안의 내부 Agent 연결. 모든 원본/한글 기능을 지원한다는 의미 아님.
- 다음 작업: 지원 범위별 한글 비교와 실제 모델 품질 확인; 원본 확장은 별도 작업.
- 상위 항목: [B099](<07-formatting-and-styles.md#b099>) 문단 번호
- Agent 명령: `clone_paragraph_numbering`
- 근거: [78-agent-numbering-clone.md](<../78-agent-numbering-clone.md>) · [wire-schema.mjs](<../../apps/editor/src/modules/document/public/wire-schema.mjs>)
- 원래 기록: `CURRENT_46_KIND_CONTRACT`

</details>

<details id="a014">
<summary>A014 · 기본 글머리표 생성</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 현재 계약이 허용하는 조회·대상·파일형식·보호·크기·묶음 제한 안의 내부 Agent 연결. 모든 원본/한글 기능을 지원한다는 의미 아님.
- 다음 작업: 지원 범위별 한글 비교와 실제 모델 품질 확인; 원본 확장은 별도 작업.
- 상위 항목: [B100](<07-formatting-and-styles.md#b100>) 글머리표
- Agent 명령: `set_basic_bullet`
- 근거: [77-agent-basic-bullets.md](<../77-agent-basic-bullets.md>) · [wire-schema.mjs](<../../apps/editor/src/modules/document/public/wire-schema.mjs>)
- 원래 기록: `CURRENT_46_KIND_CONTRACT`

</details>

<details id="a015">
<summary>A015 · 저장된 번호·글머리표 적용·해제</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 현재 계약이 허용하는 조회·대상·파일형식·보호·크기·묶음 제한 안의 내부 Agent 연결. 모든 원본/한글 기능을 지원한다는 의미 아님.
- 다음 작업: 지원 범위별 한글 비교와 실제 모델 품질 확인; 원본 확장은 별도 작업.
- 상위 항목: [B099](<07-formatting-and-styles.md#b099>) 문단 번호
- Agent 명령: `set_paragraph_list`
- 근거: [76-agent-paragraph-lists.md](<../76-agent-paragraph-lists.md>) · [wire-schema.mjs](<../../apps/editor/src/modules/document/public/wire-schema.mjs>)
- 원래 기록: `CURRENT_46_KIND_CONTRACT`

</details>

<details id="a016">
<summary>A016 · 문단 기본 테두리·배경</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 현재 계약이 허용하는 조회·대상·파일형식·보호·크기·묶음 제한 안의 내부 Agent 연결. 모든 원본/한글 기능을 지원한다는 의미 아님.
- 다음 작업: 지원 범위별 한글 비교와 실제 모델 품질 확인; 원본 확장은 별도 작업.
- 상위 항목: [B097](<07-formatting-and-styles.md#b097>) 문단 모양
- Agent 명령: `format_paragraph_decoration`
- 근거: [75-agent-paragraph-decoration.md](<../75-agent-paragraph-decoration.md>) · [wire-schema.mjs](<../../apps/editor/src/modules/document/public/wire-schema.mjs>)
- 원래 기록: `CURRENT_46_KIND_CONTRACT`

</details>

<details id="a017">
<summary>A017 · 문단 사용자·자동 탭</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 현재 계약이 허용하는 조회·대상·파일형식·보호·크기·묶음 제한 안의 내부 Agent 연결. 모든 원본/한글 기능을 지원한다는 의미 아님.
- 다음 작업: 지원 범위별 한글 비교와 실제 모델 품질 확인; 원본 확장은 별도 작업.
- 상위 항목: [B097](<07-formatting-and-styles.md#b097>) 문단 모양
- Agent 명령: `set_paragraph_tabs`
- 근거: [74-agent-paragraph-tabs.md](<../74-agent-paragraph-tabs.md>) · [wire-schema.mjs](<../../apps/editor/src/modules/document/public/wire-schema.mjs>)
- 원래 기록: `CURRENT_46_KIND_CONTRACT`

</details>

<details id="a029">
<summary>A029 · 본문 글꼴·글자 서식</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 현재 계약이 허용하는 조회·대상·파일형식·보호·크기·묶음 제한 안의 내부 Agent 연결. 모든 원본/한글 기능을 지원한다는 의미 아님.
- 다음 작업: 지원 범위별 한글 비교와 실제 모델 품질 확인; 원본 확장은 별도 작업.
- 상위 항목: [B096](<07-formatting-and-styles.md#b096>) 글자 모양
- Agent 명령: `format_characters`
- 근거: [23-autonomous-work-result.md](<../23-autonomous-work-result.md>) · [wire-schema.mjs](<../../apps/editor/src/modules/document/public/wire-schema.mjs>)
- 원래 기록: `CURRENT_46_KIND_CONTRACT`

</details>

<details id="a030">
<summary>A030 · 본문 문단 서식</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 현재 계약이 허용하는 조회·대상·파일형식·보호·크기·묶음 제한 안의 내부 Agent 연결. 모든 원본/한글 기능을 지원한다는 의미 아님.
- 다음 작업: 지원 범위별 한글 비교와 실제 모델 품질 확인; 원본 확장은 별도 작업.
- 상위 항목: [B097](<07-formatting-and-styles.md#b097>) 문단 모양
- Agent 명령: `format_paragraph`
- 근거: [17-editor-control-implementation.md](<../17-editor-control-implementation.md>) · [wire-schema.mjs](<../../apps/editor/src/modules/document/public/wire-schema.mjs>)
- 원래 기록: `CURRENT_46_KIND_CONTRACT`

</details>

<details id="a039">
<summary>A039 · 기존 문단 스타일 적용</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 현재 계약이 허용하는 조회·대상·파일형식·보호·크기·묶음 제한 안의 내부 Agent 연결. 모든 원본/한글 기능을 지원한다는 의미 아님.
- 다음 작업: 지원 범위별 한글 비교와 실제 모델 품질 확인; 원본 확장은 별도 작업.
- 상위 항목: [B098](<07-formatting-and-styles.md#b098>) 스타일
- Agent 명령: `apply_paragraph_style`
- 근거: [17-editor-control-implementation.md](<../17-editor-control-implementation.md>) · [wire-schema.mjs](<../../apps/editor/src/modules/document/public/wire-schema.mjs>)
- 원래 기록: `CURRENT_46_KIND_CONTRACT`

</details>

<details id="g020">
<summary>G020 · Ctrl+1~0 기본 스타일과 입력 문맥</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 본문/입력 중 키 충돌 보호; 한글 전체 맥락 비교 남음
- 다음 작업: 정의한 범위 회귀 유지; 한글 비교 대기
- 근거: [37-basic-editing-state-result.md](<../37-basic-editing-state-result.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g021">
<summary>G021 · 문단 여백·첫 줄 증감 빠른키</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 개별 delta·undo·저장; 일부 복합키 한글 차이 남음
- 다음 작업: 정의한 범위 회귀 유지; 한글 비교 대기
- 근거: [38-paragraph-selection-state-result.md](<../38-paragraph-selection-state-result.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g036">
<summary>G036 · 글자 스타일의 선택 범위 모양 적용</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 본문/검증된 같은 중첩 셀 범위; 영구 정의 연결 제외
- 다음 작업: 정의한 범위 회귀 유지; 한글 비교 대기
- 근거: [44-editor-stages-result.md](<../44-editor-stages-result.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g037">
<summary>G037 · 문단 끝 Enter의 다음 스타일</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 유효 다음 ID와 문단 중간 분할 구분
- 다음 작업: 정의한 범위 회귀 유지; 한글 비교 대기
- 근거: [44-editor-stages-result.md](<../44-editor-stages-result.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g038">
<summary>G038 · 스타일 순서 이동과 참조 재배치</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 본문·특수 영역 정의 참조와 다음 ID
- 다음 작업: 정의한 범위 회귀 유지; 한글 비교 대기
- 근거: [44-editor-stages-result.md](<../44-editor-stages-result.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g039">
<summary>G039 · 특수 영역의 스타일 모양 전파</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 지원 중첩 셀/머리말/각주; 직접 서식 유지
- 다음 작업: 정의한 범위 회귀 유지; 한글 비교 대기
- 근거: [44-editor-stages-result.md](<../44-editor-stages-result.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="n011">
<summary>N011 · 스타일 가져오기·내보내기</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☐ 미구현 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 참조 그래프·충돌 이름·다음 스타일·특수 영역
- 다음 작업: 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀
- 상위 항목: [B098](<07-formatting-and-styles.md#b098>) 스타일
- 근거: [44-editor-stages-result.md](<../44-editor-stages-result.md>)
- 원래 기록: `EXPLICIT_REMAINING_OR_AUDIT`

</details>

<details id="n012">
<summary>N012 · 범위 글자 스타일의 영구 정의 연결</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 직접 모양 복사와 정의 ID 연결을 구분·재열기 전파
- 다음 작업: 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀
- 상위 항목: [B098](<07-formatting-and-styles.md#b098>) 스타일
- 근거: [44-editor-stages-result.md](<../44-editor-stages-result.md>)
- 원래 기록: `EXPLICIT_REMAINING_OR_AUDIT`

</details>

<details id="n013">
<summary>N013 · 스타일마당과 사용자 번호키 재할당</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☐ 미구현 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 기관 서식·profile·충돌·재실행 수명
- 다음 작업: 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀
- 상위 항목: [B184](<07-formatting-and-styles.md#b184>) 스타일마당
- 근거: [44-editor-stages-result.md](<../44-editor-stages-result.md>)
- 원래 기록: `EXPLICIT_REMAINING_OR_AUDIT`

</details>

<details id="n022">
<summary>N022 · 문단 여백 복합키의 한글 차이 해결</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent — 해당 없음.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 기록된 개별 delta와 복합 조합 차이를 각각 재현
- 다음 작업: 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀
- 상위 항목: [B109](<07-formatting-and-styles.md#b109>) 문단 여백·첫줄 빠른키
- 근거: [38-paragraph-selection-state-result.md](<../38-paragraph-selection-state-result.md>)
- 원래 기록: `EXPLICIT_REMAINING_OR_AUDIT`

</details>

<details id="g113">
<summary>G113 · 새 글꼴 선언과 언어별 글꼴 참조 보존</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 사용자가 새로 추가한 TTF 글꼴의 HWP/HWPX 저장 및 언어별 font ID 대응. 기존 미지원 글꼴 종류 변환은 보호 차단 유지
- 다음 작업: 한글 2024 직접 비교 보류. 세부 범위의 구현·자동 검사만 완료이며 상위 기능 전체 완료는 아님.
- 상위 항목: [B096](<07-formatting-and-styles.md#b096>) 글자 모양
- 근거: [139-basic-editor-parallel-plan.md](<../139-basic-editor-parallel-plan.md>) · [manifest.json](<../evidence/basic-editor-2026-10-24/second/manifest.json>)
- 원래 기록: `SCOPED_BASIC_EDITOR_IMPLEMENTED_AUTOMATED_2026_10_24`

</details>

## 함께 보는 기능

- [본문 편집·입력·선택·찾기](<06-editing-and-selection.md>)
- [쪽·구역·용지·배경](<09-pages-and-sections.md>)
- [화면·메뉴·작업 창·단축키](<12-ui-and-shortcuts.md>)

이 파일은 자동 생성한다. 상태는 [CSV](<../jueony-work-checklist.csv>)에서, 기능 배치는 [분류 원본](<../checklist-features.json>)에서 수정한다.
