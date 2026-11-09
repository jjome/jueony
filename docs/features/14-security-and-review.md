# 보안·개인정보·검토·메모

[← 종합 진행 현황](<../jueony-progress.md>) · [전체 검색](<../jueony-work-checklist.html>) · [완료 규칙](<../97-master-work-checklist.md>)

암호·배포용·개인정보, 변경 추적·이력·문서 비교·메모의 전체 범위.

## 진행 요약

실행 작업 **0개**, 상위 범위 **11개**. CSV의 기록을 기능별로 표시한 문서다.

| 구분 | 실행 작업 | 상위 범위 |
| :--- | :---: | :---: |
| 구현 | — 상세 작업 없음 | 완료 0/11 · 부분 7 · 미구현 4 |
| 검증 | — 상세 작업 없음 | 완료 0/11 · 부분 6 · 미검증 5 |
| Agent 연결 | — 상세 작업 없음 | 연결 0/11 · 부분 0 · 미연결 11 |

☑ 완료/연결 · ◐ 부분 · ☐ 대기 · ? 재점검 · — 해당 없음. 검증 완료에는 필요한 한글 직접 비교도 포함한다. 구현 완료만으로 세 축 완료가 되지 않는다.

상위 범위는 세 축 완료 **0/11개**다. 세부 작업 완료 수와 분리해서 읽는다.

이 영역은 상위 기능의 점검 기록만 있다. 상세 실행 작업을 추가하고 완료조건을 확정해야 한다.

## 기능별 작업표

관련된 상위 기능과 실행 작업을 함께 묶었다. 각 표는 최대 8개 항목이며, 완료된 항목도 같은 표에 유지한다. ID를 누르면 아래의 완료조건·근거로 이동한다. **범위** 행은 상위 점검, **작업** 행은 실행 작업으로 중복 집계하지 않는다.

- [입력 · 상위 기능 점검](<#work-1>)
- [보안 · 상위 기능 점검](<#work-2>)
- [검토 · 상위 기능 점검](<#work-3>)
- [도구 · 상위 기능 점검](<#work-4>)

<a id="work-1"></a>

### 입력 · 상위 기능 점검

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B092](<14-security-and-review.md#b092>) · 범위 | 메모 | ◐ 부분 | ◐ 부분 | ☐ 미연결 |

<a id="work-2"></a>

### 보안 · 상위 기능 점검

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B128](<14-security-and-review.md#b128>) · 범위 | 문서 암호 설정·변경·해제 | ◐ 부분 | ◐ 부분 | ☐ 미연결 |
| [B129](<14-security-and-review.md#b129>) · 범위 | 배포용 문서 저장·편집 | ☐ 미구현 | ☐ 미검증 | ☐ 미연결 |
| [B130](<14-security-and-review.md#b130>) · 범위 | 개인정보 보호·해제 | ☐ 미구현 | ☐ 미검증 | ☐ 미연결 |
| [B131](<14-security-and-review.md#b131>) · 범위 | 문서 보안 설정 | ☐ 미구현 | ☐ 미검증 | ☐ 미연결 |

<a id="work-3"></a>

### 검토 · 상위 기능 점검

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B132](<14-security-and-review.md#b132>) · 범위 | 교정 부호·자료 연결 | ◐ 부분 | ◐ 부분 | ☐ 미연결 |
| [B133](<14-security-and-review.md#b133>) · 범위 | 변경 내용 추적·표시 | ☐ 미구현 | ◐ 부분 | ☐ 미연결 |
| [B134](<14-security-and-review.md#b134>) · 범위 | 문서 이력 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |
| [B135](<14-security-and-review.md#b135>) · 범위 | 문서 비교 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |
| [B136](<14-security-and-review.md#b136>) · 범위 | 메모 넣기·모양·표시 | ◐ 부분 | ◐ 부분 | ☐ 미연결 |

<a id="work-4"></a>

### 도구 · 상위 기능 점검

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B146](<14-security-and-review.md#b146>) · 범위 | 개인 정보 변환 | ◐ 부분 | ◐ 부분 | ☐ 미연결 |

## 항목별 완료조건·근거

각 항목은 펼쳐서 읽는다. 상태와 근거는 CSV에서 관리한다.

<details id="b092">
<summary>B092 · 메모</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ☐ 미연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. 본문 단일 지점 메모만 실제 rhwp MEMO 필드로 생성·조회·삭제한다.
- 다음 작업: commit 5c71c6d3 기준 본문 단일 지점 메모의 보호·story·revision·목록 fingerprint 검사와 snapshot undo/redo를 구현했다. fresh Rust/WASM 선별 검사 3/3에서 HWP/HWPX 재열기 후 본문·앵커·작성자·내용·memoIndex 보존과 삭제 후 본문 보존을 확인했다. 기존 Studio insert:comment stub·범위 메모·표/글상자·여러 문단·모양/표시 UI·한글 비교는 남아 부분이다.
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>) · [document-comments-b092.ts](<../../apps/editor/src/adapters/rhwp/document-comments-b092.ts>) · [document-comments-b092.test.ts](<../../apps/editor/tests/document-comments-b092.test.ts>) · [zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz-b092-memo-comment-editing.patch](<../../engine/patches/zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz-b092-memo-comment-editing.patch>)
- 원래 기록: `PARTIAL;BODY_POINT_MEMO_HWP_HWPX_REOPEN_PASS_2026_11_09;STUDIO_UI_WIRING_PENDING`

</details>

<details id="b128">
<summary>B128 · 문서 암호 설정·변경·해제</summary>

- 종류: 한글 상위 기능 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ☐ 미연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: HWP/HWPX 암호 설정·변경·해제를 source identity/revision/fingerprint와 export 직후·재열기 검증으로 보호했다. 암호는 반환·저장하지 않으며 기존 키 폐기와 원본 불변을 확인했다. 정식 보안 UI·키 저장 정책·한글 비교는 남아 부분이다.
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>) · [password-transition-b128.ts](<../../apps/editor/src/adapters/files/password-transition-b128.ts>) · [password-transition-b128.test.ts](<../../apps/editor/tests/password-transition-b128.test.ts>)
- 원래 기록: `PARTIAL;SELECTED_PASSWORD_TRANSITION_REOPEN_2026_11_09`

</details>

<details id="b129">
<summary>B129 · 배포용 문서 저장·편집</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ☐ 미구현 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 권한/암호/내용 보존 요구
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `MISSING;NOT_RUN`

</details>

<details id="b130">
<summary>B130 · 개인정보 보호·해제</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ☐ 미구현 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 선택 및 검색·암호 변경 하위 항목
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `MISSING;NOT_RUN`

</details>

<details id="b131">
<summary>B131 · 문서 보안 설정</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ☐ 미구현 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 정책 적용 의미 별도 조사
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `MISSING;NOT_RUN`

</details>

<details id="b132">
<summary>B132 · 교정 부호·자료 연결</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ☐ 미연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 명시적 local source의 삽입·삭제·바꾸기·자리 바꿈·띄어쓰기·문장 부호 표식을 최상위 본문 범위에 검증하고 문서 identity·revision·원문·문단 fingerprint로 결정적 읽기 전용 overlay anchor를 만든다.
- 다음 작업: 커밋 213e1ef3에서 실제 HWP/HWPX export·재열기·기존 undo snapshot 불변 4/4 통과. 네이티브 교정부호 저장·자료 연결·Studio overlay UI·특수 story는 미구현.
- 근거: [proofreading-marks-b132.ts](<../../apps/editor/src/adapters/rhwp/proofreading-marks-b132.ts>) · [proofreading-marks-b132.test.ts](<../../apps/editor/tests/proofreading-marks-b132.test.ts>)
- 원래 기록: `PARTIAL;PASS;SAFE_LOCAL_PROOFREADING_MARK_OVERLAY_2026_11_09`

</details>

<details id="b133">
<summary>B133 · 변경 내용 추적·표시</summary>

- 종류: 한글 상위 기능 · 우선순위: P1.
- 상태: 구현 ☐ 미구현 / 검증 ◐ 부분 / Agent ☐ 미연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. 원시 TRACKCHANGE 보존과 불투명 레코드 진단은 의미 기반 변경 추적 기능의 구현으로 보지 않는다.
- 다음 작업: document-internal v1 계약과 revision/token CAS·사후 상태 검증 seam에 더해 HWP5 DocInfo +80/+81 레코드의 종류·크기만 최대 64개 읽는 진단 API를 추가하고 HWP 저장·재열기 및 HWPX 미지원 fail-close를 검증했다. payload 의미 모델·범위 파서·작성자 연결·표시·기록·승인·거절은 여전히 미구현이다.
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>) · [document-track-changes-b133.ts](<../../apps/editor/src/adapters/rhwp/document-track-changes-b133.ts>) · [document-track-changes-b133.test.ts](<../../apps/editor/tests/document-track-changes-b133.test.ts>) · [document-track-change-inventory-b133.ts](<../../apps/editor/src/adapters/rhwp/document-track-change-inventory-b133.ts>) · [document-track-change-inventory-b133.test.ts](<../../apps/editor/tests/document-track-change-inventory-b133.test.ts>)
- 원래 기록: `MISSING;OPAQUE_HWP_DOCINFO_INVENTORY_PASS_2026_11_09;SEMANTIC_TRACK_CHANGES_UNAVAILABLE`

</details>

<details id="b134">
<summary>B134 · 문서 이력</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 비교 세션 이력과 한글 파일 이력 의미 대조
- UI 명령: `edit:document-history`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `PARTIAL;NOT_RUN`

</details>

<details id="b135">
<summary>B135 · 문서 비교</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 보존·비교 범위·표/서식 검수
- UI 명령: `edit:compare-documents`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `WIRED;NOT_RUN`

</details>

<details id="b136">
<summary>B136 · 메모 넣기·모양·표시</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ☐ 미연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. B092와 같은 메모 계열이며 현재 본문 단일 지점 삽입 코어만 지원한다.
- 다음 작업: commit 5c71c6d3 기준 실제 MEMO 필드 삽입·조회·삭제·undo/redo와 HWP/HWPX 재열기 보존을 선별 검사 3/3으로 확인했다. 메모 모양·표시·범위 메모·특수 story와 기존 Studio insert:comment UI 연결은 구현하지 않았으므로 완료가 아니다.
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>) · [document-comments-b092.ts](<../../apps/editor/src/adapters/rhwp/document-comments-b092.ts>) · [document-comments-b092.test.ts](<../../apps/editor/tests/document-comments-b092.test.ts>) · [zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz-b092-memo-comment-editing.patch](<../../engine/patches/zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz-b092-memo-comment-editing.patch>)
- 원래 기록: `PARTIAL;BODY_POINT_MEMO_CORE_PASS_2026_11_09;SHAPE_DISPLAY_UI_PENDING`

</details>

<details id="b146">
<summary>B146 · 개인 정보 변환</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ☐ 미연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 단일 최상위 본문 선택에서 주민등록번호·국내 전화번호·전자우편을 명시적으로 선택해 길이와 구분자를 보존한 채 마스킹하고 문서·revision·선택·원문·계획 fingerprint를 재검증한다.
- 다음 작업: dbdb307f 선택 검사 4/4 및 실제 HWP/HWPX 재열기·정확한 undo/redo·stale/실패 바이트 불변 통과. 문서 전체 찾기·바로 바꾸기 UI와 사용자 패턴은 남음.
- 근거: [personal-info-conversion-b146.ts](<../../apps/editor/src/adapters/rhwp/personal-info-conversion-b146.ts>) · [personal-info-conversion-b146.test.ts](<../../apps/editor/tests/personal-info-conversion-b146.test.ts>)
- 원래 기록: `PARTIAL;PASS;SAFE_SELECTED_PERSONAL_INFO_MASKING_2026_11_09`

</details>

## 함께 보는 기능

- [파일·저장·복구·형식 보존](<05-files-storage-recovery.md>)
- [AI 연결·Agent 실행](<02-agent-and-models.md>)
- [모듈·실행 기반·배포·최종 검수](<16-architecture-and-validation.md>)

이 파일은 자동 생성한다. 상태는 [CSV](<../jueony-work-checklist.csv>)에서, 기능 배치는 [분류 원본](<../checklist-features.json>)에서 수정한다.
