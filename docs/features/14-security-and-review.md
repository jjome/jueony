# 보안·개인정보·검토·메모

[← 종합 진행 현황](<../jueony-progress.md>) · [전체 검색](<../jueony-work-checklist.html>) · [완료 규칙](<../97-master-work-checklist.md>)

암호·배포용·개인정보, 변경 추적·이력·문서 비교·메모의 전체 범위.

## 진행 요약

실행 작업 **0개**, 상위 범위 **11개**. CSV의 기록을 기능별로 표시한 문서다.

| 축 | 실행 작업 상태 |
| --- | --- |
| 구현 | — 상세 작업 없음 |
| 검증 | — 상세 작업 없음 |
| Agent 연결 | — 상세 작업 없음 |

☑ 완료/연결 · ◐ 부분 · ☐ 대기 · ? 재점검 · — 해당 없음. 검증 완료에는 필요한 한글 직접 비교도 포함한다. 구현 완료만으로 세 축 완료가 되지 않는다.

상위 범위는 세 축 완료 **0/11개**다. 세부 작업 완료 수와 분리해서 읽는다.

| 축 | 상위 범위 상태 |
| --- | --- |
| 구현 | 완료 0/11 · 부분 3 · 미구현 6 · stub 2 |
| 검증 | 완료 0/11 · 부분 0 · 미검증 11 |
| Agent 연결 | 연결 0/11 · 부분 0 · 미연결 11 |

이 영역은 상위 기능의 점검 기록만 있다. 상세 실행 작업을 추가하고 완료조건을 확정해야 한다.

## 상위 기능·상태 범위 (11)

항목 ID를 누르면 아래의 완료조건·근거를 펼쳐 확인할 수 있다.

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B092](<14-security-and-review.md#b092>) P2 | 메모 | ☐ stub | ☐ 미검증 | ☐ 미연결 |
| [B128](<14-security-and-review.md#b128>) P1 | 문서 암호 설정·변경·해제 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |
| [B129](<14-security-and-review.md#b129>) P2 | 배포용 문서 저장·편집 | ☐ 미구현 | ☐ 미검증 | ☐ 미연결 |
| [B130](<14-security-and-review.md#b130>) P2 | 개인정보 보호·해제 | ☐ 미구현 | ☐ 미검증 | ☐ 미연결 |
| [B131](<14-security-and-review.md#b131>) P2 | 문서 보안 설정 | ☐ 미구현 | ☐ 미검증 | ☐ 미연결 |
| [B132](<14-security-and-review.md#b132>) P2 | 교정 부호·자료 연결 | ☐ 미구현 | ☐ 미검증 | ☐ 미연결 |
| [B133](<14-security-and-review.md#b133>) P1 | 변경 내용 추적·표시 | ☐ 미구현 | ☐ 미검증 | ☐ 미연결 |
| [B134](<14-security-and-review.md#b134>) P2 | 문서 이력 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |
| [B135](<14-security-and-review.md#b135>) P2 | 문서 비교 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |
| [B136](<14-security-and-review.md#b136>) P2 | 메모 넣기·모양·표시 | ☐ stub | ☐ 미검증 | ☐ 미연결 |
| [B146](<14-security-and-review.md#b146>) P2 | 개인 정보 변환 | ☐ 미구현 | ☐ 미검증 | ☐ 미연결 |

## 항목별 완료조건·근거

각 항목은 펼쳐서 읽는다. 상태와 근거는 CSV에서 관리한다.

<details id="b092">
<summary>B092 · 메모</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ☐ stub / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 등록된 insert:comment가 canExecute=false, 빈 execute. B136과 동일 메모 계열.
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `STUB;NOT_RUN`

</details>

<details id="b128">
<summary>B128 · 문서 암호 설정·변경·해제</summary>

- 종류: 한글 상위 기능 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 암호 열기와 다른 이름 저장의 암호화 export 존재. 변경/해제 통합 보안 UX·암호 복구 검증 필요.
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `PARTIAL;NOT_RUN`

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
- 상태: 구현 ☐ 미구현 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 검토 도구 미연결
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `MISSING;NOT_RUN`

</details>

<details id="b133">
<summary>B133 · 변경 내용 추적·표시</summary>

- 종류: 한글 상위 기능 · 우선순위: P1.
- 상태: 구현 ☐ 미구현 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: AI receipt와 파일 내부 추적 기능 구분
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `MISSING;NOT_RUN`

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
- 상태: 구현 ☐ stub / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 메모 실행 stub. B092와 같은 기능군의 검토 메뉴 범주로 중복 집계 주의.
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `STUB;NOT_RUN`

</details>

<details id="b146">
<summary>B146 · 개인 정보 변환</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ☐ 미구현 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 찾기·바로 바꾸기 대상별 검사
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `MISSING;NOT_RUN`

</details>

## 함께 보는 기능

- [파일·저장·복구·형식 보존](<05-files-storage-recovery.md>)
- [AI 연결·Agent 실행](<02-agent-and-models.md>)
- [모듈·실행 기반·배포·최종 검수](<16-architecture-and-validation.md>)

이 파일은 자동 생성한다. 상태는 [CSV](<../jueony-work-checklist.csv>)에서, 기능 배치는 [분류 원본](<../checklist-features.json>)에서 수정한다.
