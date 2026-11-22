# 반복 작업·공무원 업무 양식

[← 종합 진행 현황](<../jueony-progress.md>) · [전체 검색](<../jueony-work-checklist.html>) · [완료 규칙](<../97-master-work-checklist.md>)

문서마당·상용구·기관 양식, 반복 명령, 매크로 기록·재생과 메일 머지.

## 진행 요약

실행 작업 **7개**, 상위 범위 **5개**. CSV의 기록을 기능별로 표시한 문서다.

| 구분 | 실행 작업 | 상위 범위 |
| :--- | :---: | :---: |
| 구현 | 완료 4/7 · 부분 3 | 완료 0/5 · 부분 5 |
| 검증 | 완료 3/7 · 부분 4 | 완료 0/5 · 부분 5 |
| Agent 연결 | 연결 4/6 · 부분 2 · 해당 없음 1 | 연결 0/5 · 부분 1 · 미연결 4 |

☑ 완료/연결 · ◐ 부분 · ☐ 대기 · ? 재점검 · — 해당 없음. 검증 완료에는 필요한 한글 직접 비교도 포함한다. 구현 완료만으로 세 축 완료가 되지 않는다.

상위 범위는 세 축 완료 **0/5개**다. 세부 작업 완료 수와 분리해서 읽는다.

## 먼저 할 일

- **구현** [N038](<04-macros-and-business.md#n038>) **반복 작업의 표·개체 명령 확장** — 로컬 Qwen으로 HWP·HWPX의 중첩 표 셀·단순 도형의 색을 바꾸고 중첩 행·열을 추가하거나 삭제했다. 바깥 셀에 문장이 있는 HWP에서 행 삭제 후 바깥 높이를 다시 계산하도록 수정했다. 정밀 검사에서 두 형식의 첫 행과 끝 행 삭제 뒤 바깥 높이가 저장 전후 일치했다. 로컬 Qwen의 행·열 편집 9건을 반복 작업으로 저장하고 모델 재호출 없이 적용·저장·재열기했다. 한 번 되돌린 바이트가 원본과 일치했다. 병합·보호 표와 복합 개체 및 독립 한글 비교가 남았다.
- **구현** [N040](<04-macros-and-business.md#n040>) **기관별 공식 양식·공문 업무 흐름** — 기관 제공 HWP/HWPX 양식의 일반 본문과 단순 셀을 별도 사본에서 채운다. 표시한 본문 항목의 AI 초안과 실제 ZIP 다운로드에서 본문·붙임 보존을 확인했다. 실제 기관 결재와 장기 보존소 통합이 남았다.
- **구현** [N039](<04-macros-and-business.md#n039>) **수동 편집 동작의 매크로 기록·재생** — Chrome의 HWP·HWPX에서 키 입력·삭제, 같은 문단의 선택 교체, 한글 조합 확정, 정렬을 기록했다. JSON 가져오기와 업무 다시 열기, 로컬 Qwen에서 입력값 표식만 보내는 AI 재생, 저장·재열기와 한 번 되돌리기를 확인했다. 여러 문단의 삭제는 기록을 취소한다. 특수 영역·개체·문단 구조, 운영 모델과 독립 한글 비교는 남았다.

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
| [N040](<04-macros-and-business.md#n040>) · 작업 | 기관별 공식 양식·공문 업무 흐름 | ◐ 부분 | ◐ 부분 | ◐ 부분 |

<a id="work-2"></a>

### 파일 · 상위 기능 점검

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B004](<04-macros-and-business.md#b004>) · 범위 | 문서 시작 도우미 | ◐ 부분 | ◐ 부분 | ☐ 미연결 |

<a id="work-3"></a>

### 입력 · 상위 기능 점검

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B081](<04-macros-and-business.md#b081>) · 범위 | 상용구 | ◐ 부분 | ◐ 부분 | ☐ 미연결 |

<a id="work-4"></a>

### 도구 · 상위 기능 점검

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B141](<04-macros-and-business.md#b141>) · 범위 | 메일 머지 | ◐ 부분 | ◐ 부분 | ☐ 미연결 |

<a id="work-5"></a>

### 스크립트 매크로

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B142](<04-macros-and-business.md#b142>) · 범위 | 스크립트 매크로 | ◐ 부분 | ◐ 부분 | ◐ 부분 |
| [N039](<04-macros-and-business.md#n039>) · 작업 | 수동 편집 동작의 매크로 기록·재생 | ◐ 부분 | ◐ 부분 | ◐ 부분 |

<a id="work-6"></a>

### 검색·반복 · 독립 실행 작업

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [G087](<04-macros-and-business.md#g087>) · 작업 | 업무별 반복 명령 저장·변수·재실행 | ☑ 완료 | ☑ 완료 | ☑ 연결 |
| [G088](<04-macros-and-business.md#g088>) · 작업 | 구역·쪽·바탕쪽 반복 recipe 확장 | ☑ 완료 | ☑ 완료 | ☑ 연결 |
| [G089](<04-macros-and-business.md#g089>) · 작업 | 공문·계획·결과 보고 기본 초안 | ☑ 완료 | ☑ 완료 | ☑ 연결 |
| [N038](<04-macros-and-business.md#n038>) · 작업 | 반복 작업의 표·개체 명령 확장 | ◐ 부분 | ◐ 부분 | ☑ 연결 |
| [G133](<04-macros-and-business.md#g133>) · 작업 | 변수를 채운 기본 업무 양식 사본 | ☑ 완료 | ◐ 부분 | — 해당 없음 |

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
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ☐ 미연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. 빈 문서·정확한 recent fingerprint·승인된 로컬 HWP/HWPX 템플릿만 새 문서 owner로 열도록 제한한다.
- 다음 작업: catalog/workspace/choice fingerprint 재검증·단일 실행·취소·malformed completion 차단·불투명 최근 선택 저장과 실제 WASM HWP/HWPX 활성 문서 바이트 불변을 검증했다. 실제 시작 화면·recent/template host 배선·한글 직접 비교는 남음.
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>) · [document-start-assistant-b004.ts](<../../apps/editor/src/adapters/browser/document-start-assistant-b004.ts>) · [document-start-assistant-b004.test.ts](<../../apps/editor/tests/document-start-assistant-b004.test.ts>)
- 원래 기록: `PARTIAL;SAFE_START_ASSISTANT_CONTRACT_PASS_2026_11_09;UI_HOST_WIRING_PENDING`

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
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ☐ 미연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. 명시적 로컬 행과 검증된 필드로 독립 문서 사본을 만드는 안전 코어만 구현한다.
- 다음 작업: commit 91af64ca 기준 template revision·fingerprint·필드 스키마와 행/열/값/출력 이름 한도를 검증하고 각 행을 독립 clone에서 치환·재조회·export한 뒤 transactional stage·commit한다. 실제 WASM HWP/HWPX 두 사본 저장·재열기와 원본 바이트 불변·stale/중간 실패 전체 rollback을 4/4로 확인했다. 실제 파일시스템 transactional output port·UI·한글 비교는 미연결이라 부분이다.
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>) · [mail-merge-b141.ts](<../../apps/editor/src/modules/document/application/mail-merge-b141.ts>) · [mail-merge-b141.test.ts](<../../apps/editor/tests/mail-merge-b141.test.ts>)
- 원래 기록: `PARTIAL;TRANSACTIONAL_MAIL_MERGE_CORE_PASS_2026_11_09;FILESYSTEM_UI_WIRING_PENDING`

</details>

<details id="b142">
<summary>B142 · 스크립트 매크로</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ◐ 부분.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024의 스크립트 매크로 상위 항목. 일반 본문의 입력·삭제·선택 글자 교체와 정렬의 기록·재생을 연결했다.
- 다음 작업: Chrome의 HWP·HWPX에서 키 입력·삭제, 같은 문단의 선택 교체, 한글 조합 확정, 정렬을 기록했다. JSON 가져오기와 업무 다시 열기, 로컬 Qwen에서 입력값 표식만 보내는 AI 재생, 저장·재열기와 한 번 되돌리기를 확인했다. 여러 문단의 삭제는 기록을 취소한다. 특수 영역·개체·문단 구조, 운영 모델과 독립 한글 비교는 남았다.
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>) · [script-macro-b142.ts](<../../apps/editor/src/modules/script-macros/domain/script-macro-b142.ts>) · [script-macro-runtime-b142.ts](<../../apps/editor/src/adapters/rhwp/script-macro-runtime-b142.ts>) · [script-macro-runtime-b142.test.ts](<../../apps/editor/tests/script-macro-runtime-b142.test.ts>) · [147-checklist-completion.md](<../147-checklist-completion.md>) · [verify-ieum-first-slice.mjs](<../../apps/editor/scripts/verify-ieum-first-slice.mjs>) · [alignment-macros.ts](<../../apps/editor/src/ui/alignment-macros.ts>) · [manifest.json](<../evidence/checklist-completion-2026-11-21/manifest.json>) · [verify-manual-edit-macro.mjs](<../../apps/editor/scripts/verify-manual-edit-macro.mjs>)
- 원래 기록: `PARTIAL;SCOPED_SAFE_RECORD_REPLAY_CORE_PASS_2026_11_09;SCOPED_CHECKLIST_COMPLETION_2026_11_21`

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
- 다음 작업: 공문 초안 등 기본 양식의 필수값과 미리보기·일괄 서식을 추가했다. 원본 기관 서식 연동은 기관 파일과 적용 규칙이 필요하다.
- 근거: [28-continuation-implementation.md](<../28-continuation-implementation.md>) · [146-ieumoffice-followup.md](<../146-ieumoffice-followup.md>)
- 원래 기록: `SCOPED_IEUM_FOLLOWUP_2026_11_21`

</details>

<details id="n038">
<summary>N038 · 반복 작업의 표·개체 명령 확장</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 기존 평면 표의 셀·서식, 행·열 추가·삭제를 AI 실행 뒤 반복 작업으로 저장한다. 표 직접 선택과 원문·격자·서식 대조, 변수와 한 번 되돌리기를 제공한다.
- 다음 작업: 로컬 Qwen으로 HWP·HWPX의 중첩 표 셀·단순 도형의 색을 바꾸고 중첩 행·열을 추가하거나 삭제했다. 바깥 셀에 문장이 있는 HWP에서 행 삭제 후 바깥 높이를 다시 계산하도록 수정했다. 정밀 검사에서 두 형식의 첫 행과 끝 행 삭제 뒤 바깥 높이가 저장 전후 일치했다. 로컬 Qwen의 행·열 편집 9건을 반복 작업으로 저장하고 모델 재호출 없이 적용·저장·재열기했다. 한 번 되돌린 바이트가 원본과 일치했다. 병합·보호 표와 복합 개체 및 독립 한글 비교가 남았다.
- 근거: [64-section-repeat-work.md](<../64-section-repeat-work.md>) · [147-checklist-completion.md](<../147-checklist-completion.md>) · [manifest.json](<../evidence/checklist-completion-2026-11-21/manifest.json>) · [table-macros.test.ts](<../../apps/editor/tests/table-macros.test.ts>) · [shape-fill-macros.test.ts](<../../apps/editor/tests/shape-fill-macros.test.ts>) · [verify-ieum-first-slice.mjs](<../../apps/editor/scripts/verify-ieum-first-slice.mjs>)
- 원래 기록: `SCOPED_CHECKLIST_COMPLETION_2026_11_21`

</details>

<details id="n039">
<summary>N039 · 수동 편집 동작의 매크로 기록·재생</summary>

- 종류: 실행 작업 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ◐ 부분.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 일반 본문의 입력·삭제·선택 글자 교체와 다섯 정렬을 기록하고 같은 원문의 재생과 JSON 내보내기, AI 요청을 제공한다.
- 다음 작업: Chrome의 HWP·HWPX에서 키 입력·삭제, 같은 문단의 선택 교체, 한글 조합 확정, 정렬을 기록했다. JSON 가져오기와 업무 다시 열기, 로컬 Qwen에서 입력값 표식만 보내는 AI 재생, 저장·재열기와 한 번 되돌리기를 확인했다. 여러 문단의 삭제는 기록을 취소한다. 특수 영역·개체·문단 구조, 운영 모델과 독립 한글 비교는 남았다.
- 상위 항목: [B142](<04-macros-and-business.md#b142>) 스크립트 매크로
- 근거: [28-continuation-implementation.md](<../28-continuation-implementation.md>) · [147-checklist-completion.md](<../147-checklist-completion.md>) · [verify-ieum-first-slice.mjs](<../../apps/editor/scripts/verify-ieum-first-slice.mjs>) · [alignment-macros.ts](<../../apps/editor/src/ui/alignment-macros.ts>) · [manifest.json](<../evidence/checklist-completion-2026-11-21/manifest.json>) · [verify-manual-edit-macro.mjs](<../../apps/editor/scripts/verify-manual-edit-macro.mjs>)
- 원래 기록: `EXPLICIT_REMAINING_OR_AUDIT;SCOPED_CHECKLIST_COMPLETION_2026_11_21`

</details>

<details id="n040">
<summary>N040 · 기관별 공식 양식·공문 업무 흐름</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ◐ 부분.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 초안/결재/붙임/보존·기관 사실 입력·문서 유출 방지
- 다음 작업: 기관 제공 HWP/HWPX 양식의 일반 본문과 단순 셀을 별도 사본에서 채운다. 표시한 본문 항목의 AI 초안과 실제 ZIP 다운로드에서 본문·붙임 보존을 확인했다. 실제 기관 결재와 장기 보존소 통합이 남았다.
- 상위 항목: [B003](<04-macros-and-business.md#b003>) 문서마당
- 근거: [28-continuation-implementation.md](<../28-continuation-implementation.md>) · [146-ieumoffice-followup.md](<../146-ieumoffice-followup.md>) · [manifest.json](<../evidence/ieum-followup-2026-11-21/manifest.json>) · [147-checklist-completion.md](<../147-checklist-completion.md>) · [verify-ieum-first-slice.mjs](<../../apps/editor/scripts/verify-ieum-first-slice.mjs>) · [institution-template-copy.test.ts](<../../apps/editor/tests/institution-template-copy.test.ts>) · [institution-review-bundle.test.ts](<../../apps/editor/tests/institution-review-bundle.test.ts>)
- 원래 기록: `EXPLICIT_REMAINING_OR_AUDIT;SCOPED_IEUM_FOLLOWUP_2026_11_21;SCOPED_CHECKLIST_COMPLETION_2026_11_21`

</details>

<details id="g133">
<summary>G133 · 변수를 채운 기본 업무 양식 사본</summary>

- 종류: 실행 작업 · 우선순위: P2.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 양식별 필수값과 미리보기, 확인된 HWPX 새 탭과 반복 실행, 기존 문서와 기본 정의 보존.
- 다음 작업: 기관 서식 파일과 한글에서의 서식 대조는 남았다.
- 근거: [146-ieumoffice-followup.md](<../146-ieumoffice-followup.md>)
- 원래 기록: `SCOPED_IEUM_FOLLOWUP_2026_11_21`

</details>

## 함께 보는 기능

- [AI 연결·Agent 실행](<02-agent-and-models.md>)
- [참고 자료·검색·RAG](<03-references-and-rag.md>)
- [본문 편집·입력·선택·찾기](<06-editing-and-selection.md>)

이 파일은 자동 생성한다. 상태는 [CSV](<../jueony-work-checklist.csv>)에서, 기능 배치는 [분류 원본](<../checklist-features.json>)에서 수정한다.
