# 상태 저장·환경·선택 복원

[← 종합 진행 현황](<../jueony-progress.md>) · [전체 검색](<../jueony-work-checklist.html>) · [완료 규칙](<../97-master-work-checklist.md>)

문서·환경·세션의 저장 수명, 커서·선택·스크롤·탭·복구와 재시작.

## 진행 요약

실행 작업 **17개**, 상위 범위 **33개**. CSV의 기록을 기능별로 표시한 문서다.

| 축 | 실행 작업 상태 |
| --- | --- |
| 구현 | 완료 12/17 · 부분 1 · 미구현 1 · 재점검 3 |
| 검증 | 완료 0/17 · 부분 13 · 미검증 4 |
| Agent 연결 | 연결 1/1 · 부분 0 · 해당 없음 16 |

☑ 완료/연결 · ◐ 부분 · ☐ 대기 · ? 재점검 · — 해당 없음. 검증 완료에는 필요한 한글 직접 비교도 포함한다. 구현 완료만으로 세 축 완료가 되지 않는다.

상위 범위는 세 축 완료 **0/33개**다. 세부 작업 완료 수와 분리해서 읽는다.

| 축 | 상위 범위 상태 |
| --- | --- |
| 구현 | 완료 4/33 · 부분 3 · 재점검 26 |
| 검증 | 완료 0/33 · 부분 33 |
| Agent 연결 | 해당 없음 33 |

**현재 통합 중:** 머리말·각주 story의 서식·소유·문맥 지문을 강화하는 후속 코드를 통합 검증 중이다. 기존 완료 기록과 새 미검증 변경을 구분한다.

## 먼저 할 일

- **구현** [N014](<13-state-and-preferences.md#n014>) **글상자 내부 커서·선택 복원** — 평면 Rectangle story만 복원; 그룹·회전·중첩·캡션·표 내부와 기타 개체는 남음; 최종 한글 비교는 별도.
- **구현** [N015](<13-state-and-preferences.md#n015>) **다중 개체·그룹 선택 복원** — 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀
- **재점검** [N016](<13-state-and-preferences.md#n016>) **미주·나머지 특수 영역 선택 복원** — 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀

## 남은 실행 작업 (17)

항목 ID를 누르면 아래의 완료조건·근거를 펼쳐 확인할 수 있다.

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [G025](<13-state-and-preferences.md#g025>) P1 | 숫자 배율·쪽/폭 맞춤 복원 | ☑ 완료 | ◐ 부분 | — 해당 없음 |
| [G026](<13-state-and-preferences.md#g026>) P1 | 활성 문서 스크롤 복원 | ☑ 완료 | ◐ 부분 | — 해당 없음 |
| [G027](<13-state-and-preferences.md#g027>) P1 | 본문 커서·역방향 선택 복원 | ☑ 완료 | ◐ 부분 | — 해당 없음 |
| [G028](<13-state-and-preferences.md#g028>) P1 | 표 셀 커서·F5 셀 블록 복원 | ☑ 완료 | ◐ 부분 | — 해당 없음 |
| [G029](<13-state-and-preferences.md#g029>) P1 | 중첩 셀 경로의 선택 복원 | ☑ 완료 | ◐ 부분 | — 해당 없음 |
| [G030](<13-state-and-preferences.md#g030>) P1 | 본문 그림 선택 복원 | ☑ 완료 | ◐ 부분 | — 해당 없음 |
| [G031](<13-state-and-preferences.md#g031>) P1 | 머리말/꼬리말 선택·본문 복귀 위치 | ☑ 완료 | ◐ 부분 | — 해당 없음 |
| [G032](<13-state-and-preferences.md#g032>) P1 | 본문 각주 선택 복원 | ☑ 완료 | ◐ 부분 | — 해당 없음 |
| [G033](<13-state-and-preferences.md#g033>) P1 | 용지·글꼴 기본값은 새 문서에만 적용 | ☑ 완료 | ◐ 부분 | — 해당 없음 |
| [G034](<13-state-and-preferences.md#g034>) P1 | 환경 백업 JSON과 버전/손상 보호 | ☑ 완료 | ◐ 부분 | — 해당 없음 |
| [G035](<13-state-and-preferences.md#g035>) P1 | 문서 bytes·dirty의 미저장 workspace 복원 | ☑ 완료 | ◐ 부분 | ☑ 연결 |
| [N014](<13-state-and-preferences.md#n014>) P1 | 글상자 내부 커서·선택 복원 | ◐ 부분 | ◐ 부분 | — 해당 없음 |
| [N015](<13-state-and-preferences.md#n015>) P1 | 다중 개체·그룹 선택 복원 | ☐ 미구현 | ☐ 미검증 | — 해당 없음 |
| [N016](<13-state-and-preferences.md#n016>) P1 | 미주·나머지 특수 영역 선택 복원 | ? 재점검 | ☐ 미검증 | — 해당 없음 |
| [N017](<13-state-and-preferences.md#n017>) P1 | 전체 환경의 한글 기본값·저장 수명 실측 | ? 재점검 | ☐ 미검증 | — 해당 없음 |
| [N018](<13-state-and-preferences.md#n018>) P1 | undo/redo 이력의 재실행 지속 정책 | ? 재점검 | ☐ 미검증 | — 해당 없음 |
| [G091](<13-state-and-preferences.md#g091>) P0 | Rectangle 글상자 커서·선택·미저장 재시작 복원 | ☑ 완료 | ◐ 부분 | — 해당 없음 |

## 상위 기능·상태 범위 (33)

항목 ID를 누르면 아래의 완료조건·근거를 펼쳐 확인할 수 있다.

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [S001](<13-state-and-preferences.md#s001>) P1 | 본문/글자·문단/스타일/목록 | ? 재점검 | ◐ 부분 | — 해당 없음 |
| [S002](<13-state-and-preferences.md#s002>) P1 | 용지/여백/구역/머리말/다단 | ? 재점검 | ◐ 부분 | — 해당 없음 |
| [S003](<13-state-and-preferences.md#s003>) P1 | 표/개체/필드/자산 | ? 재점검 | ◐ 부분 | — 해당 없음 |
| [S004](<13-state-and-preferences.md#s004>) P1 | 문서 속성/보호/양식 | ? 재점검 | ◐ 부분 | — 해당 없음 |
| [S005](<13-state-and-preferences.md#s005>) P1 | 새 문서 편집용지/스타일/개요 기본값 | ◐ 부분 | ◐ 부분 | — 해당 없음 |
| [S006](<13-state-and-preferences.md#s006>) P1 | 사용자 대표 글꼴 세트 | ? 재점검 | ◐ 부분 | — 해당 없음 |
| [S007](<13-state-and-preferences.md#s007>) P1 | 최근 글꼴 표시 여부/개수 | ? 재점검 | ◐ 부분 | — 해당 없음 |
| [S008](<13-state-and-preferences.md#s008>) P1 | IME/자동교정/사전 | ? 재점검 | ◐ 부분 | — 해당 없음 |
| [S009](<13-state-and-preferences.md#s009>) P1 | 테마/스킨 | ? 재점검 | ◐ 부분 | — 해당 없음 |
| [S010](<13-state-and-preferences.md#s010>) P1 | 기본/서식 도구 상자 | ? 재점검 | ◐ 부분 | — 해당 없음 |
| [S011](<13-state-and-preferences.md#s011>) P1 | 스타일 작업 창 열림 | ? 재점검 | ◐ 부분 | — 해당 없음 |
| [S012](<13-state-and-preferences.md#s012>) P1 | 문단/조판 부호/짤림 보기 | ? 재점검 | ◐ 부분 | — 해당 없음 |
| [S013](<13-state-and-preferences.md#s013>) P1 | 격자/안내선/보기색 | ? 재점검 | ◐ 부분 | — 해당 없음 |
| [S014](<13-state-and-preferences.md#s014>) P1 | 쪽/폭 맞춤 모드 | ☑ 완료 | ◐ 부분 | — 해당 없음 |
| [S015](<13-state-and-preferences.md#s015>) P1 | 숫자 확대율 | ☑ 완료 | ◐ 부분 | — 해당 없음 |
| [S016](<13-state-and-preferences.md#s016>) P1 | 쪽 배열/이동 방향 | ? 재점검 | ◐ 부분 | — 해당 없음 |
| [S017](<13-state-and-preferences.md#s017>) P1 | 커서/현재 쪽/스크롤 | ◐ 부분 | ◐ 부분 | — 해당 없음 |
| [S018](<13-state-and-preferences.md#s018>) P1 | 본문/표/개체 선택과 모드 | ◐ 부분 | ◐ 부분 | — 해당 없음 |
| [S019](<13-state-and-preferences.md#s019>) P1 | 사용자 단축키 프로필 | ? 재점검 | ◐ 부분 | — 해당 없음 |
| [S020](<13-state-and-preferences.md#s020>) P1 | 그림 비율 유지/PDF 안내 | ? 재점검 | ◐ 부분 | — 해당 없음 |
| [S021](<13-state-and-preferences.md#s021>) P1 | 대화상자 나머지 탭/값/단위 | ? 재점검 | ◐ 부분 | — 해당 없음 |
| [S022](<13-state-and-preferences.md#s022>) P1 | 최근 문서/폴더/형식 | ? 재점검 | ◐ 부분 | — 해당 없음 |
| [S023](<13-state-and-preferences.md#s023>) P1 | 열린 탭 순서/활성 문서 | ? 재점검 | ◐ 부분 | — 해당 없음 |
| [S024](<13-state-and-preferences.md#s024>) P1 | 창 위치/최대화/DPI | ? 재점검 | ◐ 부분 | — 해당 없음 |
| [S025](<13-state-and-preferences.md#s025>) P1 | 업무 패널 분할 크기 | ? 재점검 | ◐ 부분 | — 해당 없음 |
| [S026](<13-state-and-preferences.md#s026>) P1 | 복구 enabled/interval/idle 설정 | ? 재점검 | ◐ 부분 | — 해당 없음 |
| [S027](<13-state-and-preferences.md#s027>) P1 | 복구 bytes/dirty/updatedAt | ? 재점검 | ◐ 부분 | — 해당 없음 |
| [S028](<13-state-and-preferences.md#s028>) P1 | 원본 handle/hash/revision | ? 재점검 | ◐ 부분 | — 해당 없음 |
| [S029](<13-state-and-preferences.md#s029>) P1 | 일반 undo/redo | ? 재점검 | ◐ 부분 | — 해당 없음 |
| [S030](<13-state-and-preferences.md#s030>) P1 | AI 요청 receipt | ? 재점검 | ◐ 부분 | — 해당 없음 |
| [S031](<13-state-and-preferences.md#s031>) P1 | 인쇄/PDF 옵션/장치 | ? 재점검 | ◐ 부분 | — 해당 없음 |
| [S032](<13-state-and-preferences.md#s032>) P1 | workspace/chat/folders/models/runs/macros/agent options | ☑ 완료 | ◐ 부분 | — 해당 없음 |
| [S033](<13-state-and-preferences.md#s033>) P1 | 날짜/시간 마지막 성공 형식 | ☑ 완료 | ◐ 부분 | — 해당 없음 |

## 항목별 완료조건·근거

각 항목은 펼쳐서 읽는다. 상태와 근거는 CSV에서 관리한다.

<details id="s001">
<summary>S001 · 본문/글자·문단/스타일/목록</summary>

- 종류: 상태 수명 상위 항목 · 우선순위: P1.
- 상태: 구현 ? 재점검 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 저장 범위: document; 소유: WASM; 한글과 같은 기본값/저장·복원/초기화 정책까지 확인.
- 다음 작업: 실제 한글 두 형식 재열기로 보존 확인 필요
- 근거: [editor-state-contract.csv](<../editor-state-contract.csv>) · [44-editor-stages-result.md](<../44-editor-stages-result.md>)
- 원래 기록: `S01;STATIC_AUDIT;BLOCKED_REFERENCE`

</details>

<details id="s002">
<summary>S002 · 용지/여백/구역/머리말/다단</summary>

- 종류: 상태 수명 상위 항목 · 우선순위: P1.
- 상태: 구현 ? 재점검 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 저장 범위: document/section; 소유: WASM; 한글과 같은 기본값/저장·복원/초기화 정책까지 확인.
- 다음 작업: REF-NEWPAPER;현재 문서와 새 문서 기본값 구분
- 근거: [editor-state-contract.csv](<../editor-state-contract.csv>) · [44-editor-stages-result.md](<../44-editor-stages-result.md>)
- 원래 기록: `S02;STATIC_AUDIT;BLOCKED_REFERENCE`

</details>

<details id="s003">
<summary>S003 · 표/개체/필드/자산</summary>

- 종류: 상태 수명 상위 항목 · 우선순위: P1.
- 상태: 구현 ? 재점검 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 저장 범위: document; 소유: WASM; 한글과 같은 기본값/저장·복원/초기화 정책까지 확인.
- 다음 작업: 참조·anchor·이미지 보존은 독립 재열기 필요
- 근거: [editor-state-contract.csv](<../editor-state-contract.csv>) · [44-editor-stages-result.md](<../44-editor-stages-result.md>)
- 원래 기록: `S03;STATIC_AUDIT;BLOCKED_REFERENCE`

</details>

<details id="s004">
<summary>S004 · 문서 속성/보호/양식</summary>

- 종류: 상태 수명 상위 항목 · 우선순위: P1.
- 상태: 구현 ? 재점검 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 저장 범위: document/user 구분 필요; 소유: WASM/host; 한글과 같은 기본값/저장·복원/초기화 정책까지 확인.
- 다음 작업: 읽기전용·암호 문서 원본 보존 추가 실사
- 근거: [editor-state-contract.csv](<../editor-state-contract.csv>) · [44-editor-stages-result.md](<../44-editor-stages-result.md>)
- 원래 기록: `S04;STATIC_AUDIT;BLOCKED_REFERENCE`

</details>

<details id="s005">
<summary>S005 · 새 문서 편집용지/스타일/개요 기본값</summary>

- 종류: 상태 수명 상위 항목 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PARTIAL** / 한글 **NOT_RUN**.
- 완료 범위: 저장 범위: user template;기존 문서 제외; 소유: document-defaults/new document generator; 한글과 같은 기본값/저장·복원/초기화 정책까지 확인.
- 다음 작업: 용지/여백/글꼴/크기 구현;스타일/개요 템플릿 및 한글 실측은 후속
- 근거: [editor-state-contract.csv](<../editor-state-contract.csv>) · [44-editor-stages-result.md](<../44-editor-stages-result.md>)
- 원래 기록: `S05;PARTIAL_IMPLEMENTED_TESTED;BLOCKED_REFERENCE`

</details>

<details id="s006">
<summary>S006 · 사용자 대표 글꼴 세트</summary>

- 종류: 상태 수명 상위 항목 · 우선순위: P1.
- 상태: 구현 ? 재점검 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 저장 범위: user profile; 소유: UserSettingsService; 한글과 같은 기본값/저장·복원/초기화 정책까지 확인.
- 다음 작업: REF-OPTIONS;S-001;S-002
- 근거: [editor-state-contract.csv](<../editor-state-contract.csv>) · [44-editor-stages-result.md](<../44-editor-stages-result.md>)
- 원래 기록: `S06;STATIC_AUDIT;BLOCKED_REFERENCE`

</details>

<details id="s007">
<summary>S007 · 최근 글꼴 표시 여부/개수</summary>

- 종류: 상태 수명 상위 항목 · 우선순위: P1.
- 상태: 구현 ? 재점검 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 저장 범위: user profile; 소유: UserSettingsService; 한글과 같은 기본값/저장·복원/초기화 정책까지 확인.
- 다음 작업: 실제 최근 사용 목록 저장은 별도 조사
- 근거: [editor-state-contract.csv](<../editor-state-contract.csv>) · [44-editor-stages-result.md](<../44-editor-stages-result.md>)
- 원래 기록: `S06;STATIC_AUDIT;BLOCKED_REFERENCE`

</details>

<details id="s008">
<summary>S008 · IME/자동교정/사전</summary>

- 종류: 상태 수명 상위 항목 · 우선순위: P1.
- 상태: 구현 ? 재점검 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 저장 범위: OS/user/document 구분 필요; 소유: OS/Studio; 한글과 같은 기본값/저장·복원/초기화 정책까지 확인.
- 다음 작업: OS 입력기와 엔진 자동교정 분리 후 실사
- 근거: [editor-state-contract.csv](<../editor-state-contract.csv>) · [44-editor-stages-result.md](<../44-editor-stages-result.md>)
- 원래 기록: `S07;STATIC_AUDIT;BLOCKED_REFERENCE`

</details>

<details id="s009">
<summary>S009 · 테마/스킨</summary>

- 종류: 상태 수명 상위 항목 · 우선순위: P1.
- 상태: 구현 ? 재점검 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 저장 범위: user profile; 소유: UserSettingsService/boot; 한글과 같은 기본값/저장·복원/초기화 정책까지 확인.
- 다음 작업: REF-OPTIONS;S-001;S-002
- 근거: [editor-state-contract.csv](<../editor-state-contract.csv>) · [44-editor-stages-result.md](<../44-editor-stages-result.md>)
- 원래 기록: `S08;STATIC_AUDIT;BLOCKED_REFERENCE`

</details>

<details id="s010">
<summary>S010 · 기본/서식 도구 상자</summary>

- 종류: 상태 수명 상위 항목 · 우선순위: P1.
- 상태: 구현 ? 재점검 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 저장 범위: user profile 가정;기준 관찰 필요; 소유: UserSettingsService; 한글과 같은 기본값/저장·복원/초기화 정책까지 확인.
- 다음 작업: S-001;설정값 존재와 화면 적용 구분
- 근거: [editor-state-contract.csv](<../editor-state-contract.csv>) · [44-editor-stages-result.md](<../44-editor-stages-result.md>)
- 원래 기록: `S08;STATIC_AUDIT;BLOCKED_REFERENCE`

</details>

<details id="s011">
<summary>S011 · 스타일 작업 창 열림</summary>

- 종류: 상태 수명 상위 항목 · 우선순위: P1.
- 상태: 구현 ? 재점검 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 저장 범위: user profile 가정;기준 관찰 필요; 소유: chrome-2024; 한글과 같은 기본값/저장·복원/초기화 정책까지 확인.
- 다음 작업: 다른 열린 탭 즉시 동기화 미연결
- 근거: [editor-state-contract.csv](<../editor-state-contract.csv>) · [44-editor-stages-result.md](<../44-editor-stages-result.md>)
- 원래 기록: `S08;STATIC_AUDIT;BLOCKED_REFERENCE`

</details>

<details id="s012">
<summary>S012 · 문단/조판 부호/짤림 보기</summary>

- 종류: 상태 수명 상위 항목 · 우선순위: P1.
- 상태: 구현 ? 재점검 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 저장 범위: user profile 가정;기준 관찰 필요; 소유: UserSettingsService/WASM view; 한글과 같은 기본값/저장·복원/초기화 정책까지 확인.
- 다음 작업: S-001;S-002
- 근거: [editor-state-contract.csv](<../editor-state-contract.csv>) · [44-editor-stages-result.md](<../44-editor-stages-result.md>)
- 원래 기록: `S09;STATIC_AUDIT;BLOCKED_REFERENCE`

</details>

<details id="s013">
<summary>S013 · 격자/안내선/보기색</summary>

- 종류: 상태 수명 상위 항목 · 우선순위: P1.
- 상태: 구현 ? 재점검 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 저장 범위: REFERENCE_PENDING; 소유: Studio; 한글과 같은 기본값/저장·복원/초기화 정책까지 확인.
- 다음 작업: 범위 미확정
- 근거: [editor-state-contract.csv](<../editor-state-contract.csv>) · [44-editor-stages-result.md](<../44-editor-stages-result.md>)
- 원래 기록: `S09;STATIC_AUDIT;BLOCKED_REFERENCE`

</details>

<details id="s014">
<summary>S014 · 쪽/폭 맞춤 모드</summary>

- 종류: 상태 수명 상위 항목 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 저장 범위: recovered document session;참조 동작은 관찰 대기; 소유: document-view/viewport; 한글과 같은 기본값/저장·복원/초기화 정책까지 확인.
- 다음 작업: 실제 한글의 문서별/사용자별 배율 수명 대조
- 근거: [editor-state-contract.csv](<../editor-state-contract.csv>) · [44-editor-stages-result.md](<../44-editor-stages-result.md>)
- 원래 기록: `S10;IMPLEMENTED_TESTED;BLOCKED_REFERENCE`

</details>

<details id="s015">
<summary>S015 · 숫자 확대율</summary>

- 종류: 상태 수명 상위 항목 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 저장 범위: recovered document session;참조 동작은 관찰 대기; 소유: document-view/viewport; 한글과 같은 기본값/저장·복원/초기화 정책까지 확인.
- 다음 작업: 실제 한글의 문서별/사용자별 배율 수명 대조
- 근거: [editor-state-contract.csv](<../editor-state-contract.csv>) · [44-editor-stages-result.md](<../44-editor-stages-result.md>)
- 원래 기록: `S10;IMPLEMENTED_TESTED;BLOCKED_REFERENCE`

</details>

<details id="s016">
<summary>S016 · 쪽 배열/이동 방향</summary>

- 종류: 상태 수명 상위 항목 · 우선순위: P1.
- 상태: 구현 ? 재점검 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 저장 범위: user profile 현재 구현;기준 관찰 필요; 소유: UserSettingsService; 한글과 같은 기본값/저장·복원/초기화 정책까지 확인.
- 다음 작업: S-001;S-002
- 근거: [editor-state-contract.csv](<../editor-state-contract.csv>) · [44-editor-stages-result.md](<../44-editor-stages-result.md>)
- 원래 기록: `S10;STATIC_AUDIT;BLOCKED_REFERENCE`

</details>

<details id="s017">
<summary>S017 · 커서/현재 쪽/스크롤</summary>

- 종류: 상태 수명 상위 항목 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PARTIAL** / 한글 **NOT_RUN**.
- 완료 범위: 저장 범위: 문서 세션;수명 기준 관찰 필요; 소유: preferences document-view/session-cursor/journal facade;rhwp adapter; 한글과 같은 기본값/저장·복원/초기화 정책까지 확인.
- 다음 작업: 본문/평면·중첩 셀/블록/표·그림 개체/머리말·꼬리말/본문 각주 선택과 viewport 재실행 검수. 단일 구역 일반 본문 HWPX 파일 캐럿 읽기/쓰기와 안전 저장도 검증(60번 문서). 다중 구역·중첩 목록의 파일 캐럿·글상자·다중/그룹 개체·일부 특수 영역과 한글 상태 수명 비교는 남음.
- 근거: [editor-state-contract.csv](<../editor-state-contract.csv>) · [44-editor-stages-result.md](<../44-editor-stages-result.md>)
- 원래 기록: `S11;PARTIAL_IMPLEMENTED_TESTED;REFERENCE_PENDING`

</details>

<details id="s018">
<summary>S018 · 본문/표/개체 선택과 모드</summary>

- 종류: 상태 수명 상위 항목 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PARTIAL** / 한글 **NOT_RUN**.
- 완료 범위: 저장 범위: 문서 세션;수명 기준 관찰 필요; 소유: preferences facade / rhwp session-cursor adapter; 한글과 같은 기본값/저장·복원/초기화 정책까지 확인.
- 다음 작업: 본문/평면·중첩 셀/블록/표·그림 개체/머리말·꼬리말/본문 각주 선택과 viewport 재실행 검수. 글상자·다중/그룹 개체·일부 특수 영역과 한글 상태 수명 비교는 남음.; 이번 좁은 하위 범위만 구현, 전체 옵션/한글 검증은 미완료.
- 근거: [editor-state-contract.csv](<../editor-state-contract.csv>) · [44-editor-stages-result.md](<../44-editor-stages-result.md>) · [104-parallel-editor-integration.md](<../104-parallel-editor-integration.md>)
- 원래 기록: `S12;PARTIAL_IMPLEMENTED_TESTED;REFERENCE_PENDING`

</details>

<details id="s019">
<summary>S019 · 사용자 단축키 프로필</summary>

- 종류: 상태 수명 상위 항목 · 우선순위: P1.
- 상태: 구현 ? 재점검 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 저장 범위: user profile; 소유: shortcut installer; 한글과 같은 기본값/저장·복원/초기화 정책까지 확인.
- 다음 작업: 정의 존재와 사용자 프로필 기능 구분
- 근거: [editor-state-contract.csv](<../editor-state-contract.csv>) · [44-editor-stages-result.md](<../44-editor-stages-result.md>)
- 원래 기록: `S13;STATIC_AUDIT;BLOCKED_REFERENCE`

</details>

<details id="s020">
<summary>S020 · 그림 비율 유지/PDF 안내</summary>

- 종류: 상태 수명 상위 항목 · 우선순위: P1.
- 상태: 구현 ? 재점검 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 저장 범위: user profile 현재 구현;명령별 관찰 필요; 소유: UserSettingsService; 한글과 같은 기본값/저장·복원/초기화 정책까지 확인.
- 다음 작업: S-001;S-002
- 근거: [editor-state-contract.csv](<../editor-state-contract.csv>) · [44-editor-stages-result.md](<../44-editor-stages-result.md>)
- 원래 기록: `S14;STATIC_AUDIT;BLOCKED_REFERENCE`

</details>

<details id="s021">
<summary>S021 · 대화상자 나머지 탭/값/단위</summary>

- 종류: 상태 수명 상위 항목 · 우선순위: P1.
- 상태: 구현 ? 재점검 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 저장 범위: 명령마다 관찰 필요; 소유: 각 dialog; 한글과 같은 기본값/저장·복원/초기화 정책까지 확인.
- 다음 작업: 미검증 항목을 임의로 영구보존하지 않음
- 근거: [editor-state-contract.csv](<../editor-state-contract.csv>) · [44-editor-stages-result.md](<../44-editor-stages-result.md>)
- 원래 기록: `S14;STATIC_AUDIT;BLOCKED_REFERENCE`

</details>

<details id="s022">
<summary>S022 · 최근 문서/폴더/형식</summary>

- 종류: 상태 수명 상위 항목 · 우선순위: P1.
- 상태: 구현 ? 재점검 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 저장 범위: user/document 구분 필요; 소유: history/host/shell; 한글과 같은 기본값/저장·복원/초기화 정책까지 확인.
- 다음 작업: 복원 파일 handle 없음;S-005
- 근거: [editor-state-contract.csv](<../editor-state-contract.csv>) · [44-editor-stages-result.md](<../44-editor-stages-result.md>)
- 원래 기록: `S15;STATIC_AUDIT;BLOCKED_REFERENCE`

</details>

<details id="s023">
<summary>S023 · 열린 탭 순서/활성 문서</summary>

- 종류: 상태 수명 상위 항목 · 우선순위: P1.
- 상태: 구현 ? 재점검 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 저장 범위: workspace 추가상태+Hancom 기준 관찰; 소유: shell/WorkspaceStore; 한글과 같은 기본값/저장·복원/초기화 정책까지 확인.
- 다음 작업: S-006;getAll key 순서이며 생성/정렬 순서 필드 없음
- 근거: [editor-state-contract.csv](<../editor-state-contract.csv>) · [44-editor-stages-result.md](<../44-editor-stages-result.md>)
- 원래 기록: `S16;STATIC_AUDIT;BLOCKED_REFERENCE`

</details>

<details id="s024">
<summary>S024 · 창 위치/최대화/DPI</summary>

- 종류: 상태 수명 상위 항목 · 우선순위: P1.
- 상태: 구현 ? 재점검 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 저장 범위: desktop profile; 소유: launcher/browser host; 한글과 같은 기본값/저장·복원/초기화 정책까지 확인.
- 다음 작업: 브라우저 및 OS 보존 여부 실제 런처 검사 필요
- 근거: [editor-state-contract.csv](<../editor-state-contract.csv>) · [44-editor-stages-result.md](<../44-editor-stages-result.md>)
- 원래 기록: `S17;STATIC_AUDIT;BLOCKED_REFERENCE`

</details>

<details id="s025">
<summary>S025 · 업무 패널 분할 크기</summary>

- 종류: 상태 수명 상위 항목 · 우선순위: P1.
- 상태: 구현 ? 재점검 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 저장 범위: workspace/app 추가상태; 소유: shell/pane-layout; 한글과 같은 기본값/저장·복원/초기화 정책까지 확인.
- 다음 작업: 한글 대응 아닌 Jueony 추가 상태
- 근거: [editor-state-contract.csv](<../editor-state-contract.csv>) · [44-editor-stages-result.md](<../44-editor-stages-result.md>)
- 원래 기록: `S17;STATIC_AUDIT;BLOCKED_REFERENCE`

</details>

<details id="s026">
<summary>S026 · 복구 enabled/interval/idle 설정</summary>

- 종류: 상태 수명 상위 항목 · 우선순위: P1.
- 상태: 구현 ? 재점검 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 저장 범위: user profile; 소유: UserSettingsService/autosaveManager; 한글과 같은 기본값/저장·복원/초기화 정책까지 확인.
- 다음 작업: shell의 1.4초 workspace snapshot은 이 설정과 별도;S-007
- 근거: [editor-state-contract.csv](<../editor-state-contract.csv>) · [44-editor-stages-result.md](<../44-editor-stages-result.md>)
- 원래 기록: `S18;STATIC_AUDIT;BLOCKED_REFERENCE`

</details>

<details id="s027">
<summary>S027 · 복구 bytes/dirty/updatedAt</summary>

- 종류: 상태 수명 상위 항목 · 우선순위: P1.
- 상태: 구현 ? 재점검 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 저장 범위: workspace/document; 소유: shell/WorkspaceStore; 한글과 같은 기본값/저장·복원/초기화 정책까지 확인.
- 다음 작업: S-008;S-009;S-010
- 근거: [editor-state-contract.csv](<../editor-state-contract.csv>) · [44-editor-stages-result.md](<../44-editor-stages-result.md>)
- 원래 기록: `S19;STATIC_AUDIT;BLOCKED_REFERENCE`

</details>

<details id="s028">
<summary>S028 · 원본 handle/hash/revision</summary>

- 종류: 상태 수명 상위 항목 · 우선순위: P1.
- 상태: 구현 ? 재점검 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 저장 범위: document session; 소유: save-guard/editor bridge; 한글과 같은 기본값/저장·복원/초기화 정책까지 확인.
- 다음 작업: S-005;재실행 후 재연결 미지원
- 근거: [editor-state-contract.csv](<../editor-state-contract.csv>) · [44-editor-stages-result.md](<../44-editor-stages-result.md>)
- 원래 기록: `S19;STATIC_AUDIT;BLOCKED_REFERENCE`

</details>

<details id="s029">
<summary>S029 · 일반 undo/redo</summary>

- 종류: 상태 수명 상위 항목 · 우선순위: P1.
- 상태: 구현 ? 재점검 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 저장 범위: engine document session;수명 관찰 필요; 소유: WASM; 한글과 같은 기본값/저장·복원/초기화 정책까지 확인.
- 다음 작업: 재시작 undo 유지 약속하지 않음
- 근거: [editor-state-contract.csv](<../editor-state-contract.csv>) · [44-editor-stages-result.md](<../44-editor-stages-result.md>)
- 원래 기록: `S20;STATIC_AUDIT;BLOCKED_REFERENCE`

</details>

<details id="s030">
<summary>S030 · AI 요청 receipt</summary>

- 종류: 상태 수명 상위 항목 · 우선순위: P1.
- 상태: 구현 ? 재점검 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 저장 범위: workspace/chat 기록+현재 session; 소유: shell/agent; 한글과 같은 기본값/저장·복원/초기화 정책까지 확인.
- 다음 작업: 기록 보존과 실행 가능성 분리
- 근거: [editor-state-contract.csv](<../editor-state-contract.csv>) · [44-editor-stages-result.md](<../44-editor-stages-result.md>)
- 원래 기록: `S20;STATIC_AUDIT;BLOCKED_REFERENCE`

</details>

<details id="s031">
<summary>S031 · 인쇄/PDF 옵션/장치</summary>

- 종류: 상태 수명 상위 항목 · 우선순위: P1.
- 상태: 구현 ? 재점검 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 저장 범위: document/user/driver; 소유: browser print/Studio; 한글과 같은 기본값/저장·복원/초기화 정책까지 확인.
- 다음 작업: 프린터 설치/한글 비교 필요한 외부 의존
- 근거: [editor-state-contract.csv](<../editor-state-contract.csv>) · [44-editor-stages-result.md](<../44-editor-stages-result.md>)
- 원래 기록: `S21;STATIC_AUDIT;BLOCKED_REFERENCE`

</details>

<details id="s032">
<summary>S032 · workspace/chat/folders/models/runs/macros/agent options</summary>

- 종류: 상태 수명 상위 항목 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 저장 범위: Jueony app profile; 소유: WorkspaceStore; 한글과 같은 기본값/저장·복원/초기화 정책까지 확인.
- 다음 작업: 검색/검토 단계 및 workspace별 반복 작업 복원 검사 통과;일반 도구 journal crash 복원은 후속
- 근거: [editor-state-contract.csv](<../editor-state-contract.csv>) · [44-editor-stages-result.md](<../44-editor-stages-result.md>)
- 원래 기록: `S22;IMPLEMENTED_TESTED;JUEONY_SPECIFIC`

</details>

<details id="s033">
<summary>S033 · 날짜/시간 마지막 성공 형식</summary>

- 종류: 상태 수명 상위 항목 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 저장 범위: user profile / app origin; 소유: browser calendar-format-preference adapter; 한글과 같은 기본값/저장·복원/초기화 정책까지 확인.
- 다음 작업: 한글의 저장 시점/형식 종류/재실행 정책을 대조
- 근거: [editor-state-contract.csv](<../editor-state-contract.csv>) · [44-editor-stages-result.md](<../44-editor-stages-result.md>)
- 원래 기록: `S23;IMPLEMENTED_TESTED_REFERENCE_PENDING`

</details>

<details id="g025">
<summary>G025 · 숫자 배율·쪽/폭 맞춤 복원</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 문서별 보기 상태; 실제 한글 수명 비교 남음
- 다음 작업: 정의한 범위 회귀 유지; 한글 비교 대기
- 근거: [28-continuation-implementation.md](<../28-continuation-implementation.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g026">
<summary>G026 · 활성 문서 스크롤 복원</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 최종 화면 높이 확정 뒤 복원
- 다음 작업: 정의한 범위 회귀 유지; 한글 비교 대기
- 근거: [44-editor-stages-result.md](<../44-editor-stages-result.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g027">
<summary>G027 · 본문 커서·역방향 선택 복원</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 문맥·문서 버전 검사와 오래된 선택 거절
- 다음 작업: 정의한 범위 회귀 유지; 한글 비교 대기
- 근거: [38-paragraph-selection-state-result.md](<../38-paragraph-selection-state-result.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g028">
<summary>G028 · 표 셀 커서·F5 셀 블록 복원</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 지원 셀 주소·범위·구조 확인
- 다음 작업: 정의한 범위 회귀 유지; 한글 비교 대기
- 근거: [38-paragraph-selection-state-result.md](<../38-paragraph-selection-state-result.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g029">
<summary>G029 · 중첩 셀 경로의 선택 복원</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 검증된 중첩 경로; 모든 중첩 원본 제외
- 다음 작업: 정의한 범위 회귀 유지; 한글 비교 대기
- 근거: [44-editor-stages-result.md](<../44-editor-stages-result.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g030">
<summary>G030 · 본문 그림 선택 복원</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 자산 hash·문맥 검사; 다중/그룹 선택 제외
- 다음 작업: 정의한 범위 회귀 유지; 한글 비교 대기
- 근거: [44-editor-stages-result.md](<../44-editor-stages-result.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g031">
<summary>G031 · 머리말/꼬리말 선택·본문 복귀 위치</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 지원 story 선택과 포커스 복원
- 다음 작업: 정의한 범위 회귀 유지; 한글 비교 대기
- 근거: [44-editor-stages-result.md](<../44-editor-stages-result.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g032">
<summary>G032 · 본문 각주 선택 복원</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 검증된 각주 문맥; 모든 특수 영역 제외
- 다음 작업: 정의한 범위 회귀 유지; 한글 비교 대기
- 근거: [44-editor-stages-result.md](<../44-editor-stages-result.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g033">
<summary>G033 · 용지·글꼴 기본값은 새 문서에만 적용</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 기존 파일·복구 문서·dirty 유지
- 다음 작업: 정의한 범위 회귀 유지; 한글 비교 대기
- 근거: [28-continuation-implementation.md](<../28-continuation-implementation.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g034">
<summary>G034 · 환경 백업 JSON과 버전/손상 보호</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PARTIAL** / 한글 **NA**.
- 완료 범위: 기록된 설정 교환·부분 저장 실패 복원 범위
- 다음 작업: 기록된 범위 유지·관련 변경 시 회귀 검사
- 근거: [47-remaining-editor-implementation.md](<../47-remaining-editor-implementation.md>) · [basic-text-browser.json](<../evidence/remaining-editor-2026-10-13/basic-text-browser.json>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g035">
<summary>G035 · 문서 bytes·dirty의 미저장 workspace 복원</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 실제 병합 결과·재시작 복원; 이력 영구 저장 제외
- 다음 작업: 정의한 범위 회귀 유지; 한글 비교 대기
- 근거: [96-agent-table-merge.md](<../96-agent-table-merge.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="n014">
<summary>N014 · 글상자 내부 커서·선택 복원</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 문단 경로·문맥 hash·원본 확인·포커스
- 다음 작업: 평면 Rectangle story만 복원; 그룹·회전·중첩·캡션·표 내부와 기타 개체는 남음; 최종 한글 비교는 별도.
- 상위 항목: [S018](<13-state-and-preferences.md#s018>) 본문/표/개체 선택과 모드
- 근거: [103-textbox-state-and-storage.md](<../103-textbox-state-and-storage.md>) · [verification-summary.json](<../evidence/parallel-editor-2026-10-15/verification-summary.json>)
- 원래 기록: `EXPLICIT_REMAINING_OR_AUDIT`

</details>

<details id="n015">
<summary>N015 · 다중 개체·그룹 선택 복원</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☐ 미구현 / 검증 ☐ 미검증 / Agent — 해당 없음.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NA**.
- 완료 범위: 그룹 자산/소유·좌표·검증 실패 시 안전 초기화
- 다음 작업: 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀
- 상위 항목: [S018](<13-state-and-preferences.md#s018>) 본문/표/개체 선택과 모드
- 근거: [44-editor-stages-result.md](<../44-editor-stages-result.md>)
- 원래 기록: `EXPLICIT_REMAINING_OR_AUDIT`

</details>

<details id="n016">
<summary>N016 · 미주·나머지 특수 영역 선택 복원</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ? 재점검 / 검증 ☐ 미검증 / Agent — 해당 없음.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NA**.
- 완료 범위: 영역별 수명·본문 복귀·문서 버전·재시작
- 다음 작업: 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀
- 상위 항목: [S018](<13-state-and-preferences.md#s018>) 본문/표/개체 선택과 모드
- 근거: [44-editor-stages-result.md](<../44-editor-stages-result.md>)
- 원래 기록: `EXPLICIT_REMAINING_OR_AUDIT`

</details>

<details id="n017">
<summary>N017 · 전체 환경의 한글 기본값·저장 수명 실측</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ? 재점검 / 검증 ☐ 미검증 / Agent — 해당 없음.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 사용자/업무/문서/구역/임시 scope·reset·dirty·undo 구분
- 다음 작업: 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀
- 상위 항목: [B151](<12-ui-and-shortcuts.md#b151>) 환경 설정
- 근거: [25-hangul-parity-and-state-plan.md](<../25-hangul-parity-and-state-plan.md>)
- 원래 기록: `EXPLICIT_REMAINING_OR_AUDIT`

</details>

<details id="n018">
<summary>N018 · undo/redo 이력의 재실행 지속 정책</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ? 재점검 / 검증 ☐ 미검증 / Agent — 해당 없음.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NA**.
- 완료 범위: 원본 bytes/revision과 atomic recipe 수명; 한글 기준 확인
- 다음 작업: 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀
- 상위 항목: [S029](<13-state-and-preferences.md#s029>) 일반 undo/redo
- 근거: [44-editor-stages-result.md](<../44-editor-stages-result.md>)
- 원래 기록: `EXPLICIT_REMAINING_OR_AUDIT`

</details>

<details id="g091">
<summary>G091 · Rectangle 글상자 커서·선택·미저장 재시작 복원</summary>

- 종류: 실행 작업 · 우선순위: P0.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 단일 root Rectangle의 정체성/전체 story 텍스트·서식·문맥/Unicode 선택·실제 cursor rect; 탭/workspace/dirty 복원·채팅 focus 유지
- 다음 작업: 자체 예제로 최종 한글 2024 비교; 복합 원본은 별도 작업.
- 상위 항목: [N014](<13-state-and-preferences.md#n014>) 글상자 내부 커서·선택 복원
- 근거: [103-textbox-state-and-storage.md](<../103-textbox-state-and-storage.md>) · [verification-summary.json](<../evidence/parallel-editor-2026-10-15/verification-summary.json>)
- 원래 기록: `SCOPED_PARALLEL_EDITOR_STATE_STORAGE`

</details>

## 함께 보는 기능

- [파일·저장·복구·형식 보존](<05-files-storage-recovery.md>)
- [화면·메뉴·작업 창·단축키](<12-ui-and-shortcuts.md>)
- [머리말·각주·필드·책갈피](<10-headers-notes-fields.md>)

이 파일은 자동 생성한다. 상태는 [CSV](<../jueony-work-checklist.csv>)에서, 기능 배치는 [분류 원본](<../checklist-features.json>)에서 수정한다.
