# 모듈·실행 기반·배포·최종 검수

[← 종합 진행 현황](<../jueony-progress.md>) · [전체 검색](<../jueony-work-checklist.html>) · [완료 규칙](<../97-master-work-checklist.md>)

레이어·facade·계약·엔진·고지·실행 묶음과 최종 한글·OS·오프라인 검수.

## 진행 요약

실행 작업 **25개**, 상위 범위 **0개**. CSV의 기록을 기능별로 표시한 문서다.

| 구분 | 실행 작업 | 상위 범위 |
| :--- | :---: | :---: |
| 구현 | 완료 8/25 · 부분 17 | — 상위 범위 없음 |
| 검증 | 완료 8/25 · 부분 17 | — 상위 범위 없음 |
| Agent 연결 | 해당 없음 25 | — 상위 범위 없음 |

☑ 완료/연결 · ◐ 부분 · ☐ 대기 · ? 재점검 · — 해당 없음. 검증 완료에는 필요한 한글 직접 비교도 포함한다. 구현 완료만으로 세 축 완료가 되지 않는다.

## 먼저 할 일

- **구현** [N041](<16-architecture-and-validation.md#n041>) **독립 한글에서 복합 코퍼스 일괄 검수** — 합성 5종×HWP/HWPX 10/10과 manifest 계약 3/3을 통과했다. 같은 Jueony Rust/WASM 엔진의 기술 검수이며 실제 한글 2024 화면·인쇄·복구 경고, 기관 실문서와 공개 문서 코퍼스의 독립 비교는 남아 부분이다.
- **구현** [N042](<16-architecture-and-validation.md#n042>) **한글·Jueony 인쇄/PDF 조판 비교** — A4 가로 PDF 두 장에 합성 문서 5쪽을 모아찍고 용지 크기와 원본 바이트를 확인했다. Jueony의 HWP/HWPX 조판 기준 2건 통과. 독립 한글 PDF·폰트·실물 출력 비교가 남았다.
- **구현** [N043](<16-architecture-and-validation.md#n043>) **실제 Windows 파일 picker·권한·외부 수정** — Windows 파일의 권한·잠금·외부 수정·HWP/HWPX/HWT 사본 보존 11건을 검증했다. 개발판의 실제 파일 선택창에서 합성 HWP·HWPX를 열고 사본의 바이트 또는 XML 본문을 확인했다. Chrome과 변경된 Windows 개발판에서 외부 수정 원인과 다른 이름 저장·재열기 안내를 확인했다. Windows 저장 선택창으로 편집 내용을 별도 HWPX에 저장했고 디스크 원본과 사본의 본문이 각각 보존됐다. 기관 ACL과 서명 설치본은 별도다.

## 기능별 작업표

관련된 상위 기능과 실행 작업을 함께 묶었다. 각 표는 최대 8개 항목이며, 완료된 항목도 같은 표에 유지한다. ID를 누르면 아래의 완료조건·근거로 이동한다. **범위** 행은 상위 점검, **작업** 행은 실행 작업으로 중복 집계하지 않는다.

- [기반·모듈 · 독립 실행 작업 (1)](<#work-1>)
- [기반·모듈 · 독립 실행 작업 (2)](<#work-2>)
- [기반·모듈 · 독립 실행 작업 (3)](<#work-3>)
- [저장·호환성 · 독립 실행 작업](<#work-4>)

<a id="work-1"></a>

### 기반·모듈 · 독립 실행 작업 (1)

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [R00](<16-architecture-and-validation.md#r00>) · 작업 | 현재 동작과 데이터 기준 고정 | ☑ 완료 | ☑ 완료 | — 해당 없음 |
| [R01](<16-architecture-and-validation.md#r01>) · 작업 | 모듈별 공개 계약과 상태 소유권 고정 | ◐ 부분 | ◐ 부분 | — 해당 없음 |
| [R02](<16-architecture-and-validation.md#r02>) · 작업 | 모듈 경계와 계약 검사 기반 | ☑ 완료 | ☑ 완료 | — 해당 없음 |
| [R03](<16-architecture-and-validation.md#r03>) · 작업 | Composition Root와 호환 진입점 준비 | ◐ 부분 | ◐ 부분 | — 해당 없음 |
| [R04](<16-architecture-and-validation.md#r04>) · 작업 | Document facade와 rhwp adapter 분리 | ◐ 부분 | ◐ 부분 | — 해당 없음 |
| [R05](<16-architecture-and-validation.md#r05>) · 작업 | 파일 저장과 복구 유스케이스 분리 | ◐ 부분 | ◐ 부분 | — 해당 없음 |
| [R06](<16-architecture-and-validation.md#r06>) · 작업 | 업무와 채팅 모델 및 저장 Port 분리 | ◐ 부분 | ◐ 부분 | — 해당 없음 |
| [R07](<16-architecture-and-validation.md#r07>) · 작업 | 자료와 검색 경계 분리 | ◐ 부분 | ◐ 부분 | — 해당 없음 |

<a id="work-2"></a>

### 기반·모듈 · 독립 실행 작업 (2)

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [R08](<16-architecture-and-validation.md#r08>) · 작업 | 환경과 보기 상태 모듈 분리 | ◐ 부분 | ◐ 부분 | — 해당 없음 |
| [R09](<16-architecture-and-validation.md#r09>) · 작업 | 모델 연결과 제공자 adapter 경계 분리 | ☑ 완료 | ☑ 완료 | — 해당 없음 |
| [R10](<16-architecture-and-validation.md#r10>) · 작업 | Agent 실행과 context 조립 분리 | ◐ 부분 | ◐ 부분 | — 해당 없음 |
| [R11](<16-architecture-and-validation.md#r11>) · 작업 | 매크로와 업무 템플릿 경계 분리 | ☑ 완료 | ☑ 완료 | — 해당 없음 |
| [R12](<16-architecture-and-validation.md#r12>) · 작업 | Session과 UI controller로 shell 해체 | ◐ 부분 | ◐ 부분 | — 해당 없음 |
| [R13](<16-architecture-and-validation.md#r13>) · 작업 | iframe와 빌드 패치 의존을 adapter로 격리 | ◐ 부분 | ◐ 부분 | — 해당 없음 |
| [R14](<16-architecture-and-validation.md#r14>) · 작업 | 기존 상태와 자격증명 호환 최종 검수 | ◐ 부분 | ◐ 부분 | — 해당 없음 |
| [R15](<16-architecture-and-validation.md#r15>) · 작업 | 통합 회귀와 모듈별 변경 영향 검증 | ◐ 부분 | ◐ 부분 | — 해당 없음 |

<a id="work-3"></a>

### 기반·모듈 · 독립 실행 작업 (3)

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [G001](<16-architecture-and-validation.md#g001>) · 작업 | rhwp 고정 소스·Rust/WASM 검수 빌드 | ☑ 완료 | ☑ 완료 | — 해당 없음 |
| [G002](<16-architecture-and-validation.md#g002>) · 작업 | 제3자 고지와 실행 묶음 고지 포함 | ☑ 완료 | ☑ 완료 | — 해당 없음 |
| [G003](<16-architecture-and-validation.md#g003>) · 작업 | Windows 독립 검수 실행기·포트 분리 | ☑ 완료 | ☑ 완료 | — 해당 없음 |
| [G004](<16-architecture-and-validation.md#g004>) · 작업 | 앱/엔진 소스와 검수 자산 해시 대조 | ☑ 완료 | ☑ 완료 | — 해당 없음 |

<a id="work-4"></a>

### 저장·호환성 · 독립 실행 작업

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [N041](<16-architecture-and-validation.md#n041>) · 작업 | 독립 한글에서 복합 코퍼스 일괄 검수 | ◐ 부분 | ◐ 부분 | — 해당 없음 |
| [N042](<16-architecture-and-validation.md#n042>) · 작업 | 한글·Jueony 인쇄/PDF 조판 비교 | ◐ 부분 | ◐ 부분 | — 해당 없음 |
| [N043](<16-architecture-and-validation.md#n043>) · 작업 | 실제 Windows 파일 picker·권한·외부 수정 | ◐ 부분 | ◐ 부분 | — 해당 없음 |
| [N044](<16-architecture-and-validation.md#n044>) · 작업 | 비정상 종료·저장 실패·복구 통합 | ◐ 부분 | ◐ 부분 | — 해당 없음 |
| [N045](<16-architecture-and-validation.md#n045>) · 작업 | 기관 배포용 완전 오프라인 자산/허용 서버 정책 | ◐ 부분 | ◐ 부분 | — 해당 없음 |

## 항목별 완료조건·근거

각 항목은 펼쳐서 읽는다. 상태와 근거는 CSV에서 관리한다.

<details id="r00">
<summary>R00 · 현재 동작과 데이터 기준 고정</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 원본 프로필 변경 없이 열기/편집/저장/되돌리기/복원/Agent 기준을 기록하고 기존 결함과 새 회귀를 구분
- 다음 작업: 유지·회귀 검사
- 근거: [refactor-work-plan.csv](<../refactor-work-plan.csv>) · [32-modular-refactor-result.md](<../32-modular-refactor-result.md>)
- 원래 기록: `DONE`

</details>

<details id="r01">
<summary>R01 · 모듈별 공개 계약과 상태 소유권 고정</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PARTIAL** / 한글 **NA**.
- 완료 범위: Document 계약이 Agent/매크로/provider 구현을 참조하지 않고 scope/epoch/revision/단위/결과 의미가 명시됨
- 다음 작업: 9개 모듈 DTO/facade 및 canonical schema 적용; epoch/lifecycle/save receipt 확장 남음
- 선행 작업: [R00](<16-architecture-and-validation.md#r00>)
- 근거: [refactor-work-plan.csv](<../refactor-work-plan.csv>) · [32-modular-refactor-result.md](<../32-modular-refactor-result.md>)
- 원래 기록: `PARTIAL`

</details>

<details id="r02">
<summary>R02 · 모듈 경계와 계약 검사 기반</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 테스트용 경계 위반을 탐지하고 기존 예외마다 소유자/제거 단계가 있으며 새 위반을 허용하지 않음
- 다음 작업: 유지·회귀 검사
- 선행 작업: [R01](<16-architecture-and-validation.md#r01>)
- 근거: [refactor-work-plan.csv](<../refactor-work-plan.csv>) · [32-modular-refactor-result.md](<../32-modular-refactor-result.md>)
- 원래 기록: `DONE`

</details>

<details id="r03">
<summary>R03 · Composition Root와 호환 진입점 준비</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PARTIAL** / 한글 **NA**.
- 완료 범위: 기존 경로만 한 번 실행;이중 저장/이중 명령 없음;현재 동작과 persisted v1을 유지
- 다음 작업: host/model/agent 조립과 legacy 재수출 적용; Studio bootstrap 완전 이관 남음
- 선행 작업: [R01](<16-architecture-and-validation.md#r01>) · [R02](<16-architecture-and-validation.md#r02>)
- 근거: [refactor-work-plan.csv](<../refactor-work-plan.csv>) · [32-modular-refactor-result.md](<../32-modular-refactor-result.md>)
- 원래 기록: `PARTIAL`

</details>

<details id="r04">
<summary>R04 · Document facade와 rhwp adapter 분리</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PARTIAL** / 한글 **NA**.
- 완료 범위: 현재 AI 46종 명령과 기존 수동 history/revision 유지;engine/Studio/any 노출 제거;target/충돌/부분 실패 적합성 통과
- 다음 작업: query/edit/interaction와 engine adapter 적용; lifecycle 전체 및 기능별 handler 세분화 남음
- 선행 작업: [R03](<16-architecture-and-validation.md#r03>)
- 근거: [refactor-work-plan.csv](<../refactor-work-plan.csv>) · [32-modular-refactor-result.md](<../32-modular-refactor-result.md>)
- 원래 기록: `PARTIAL`

</details>

<details id="r05">
<summary>R05 · 파일 저장과 복구 유스케이스 분리</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PARTIAL** / 한글 **NA**.
- 완료 범위: 저장 성공 revision만 확인;외부 변경/취소/download 확인/암호 평문 복구 차단/기존 복구본 보존 회귀 통과
- 다음 작업: 주입형 저장/복구 정책 적용; 전체 open/close/save orchestration 이관 남음
- 선행 작업: [R04](<16-architecture-and-validation.md#r04>) · [R08](<16-architecture-and-validation.md#r08>)
- 근거: [refactor-work-plan.csv](<../refactor-work-plan.csv>) · [32-modular-refactor-result.md](<../32-modular-refactor-result.md>)
- 원래 기록: `PARTIAL`

</details>

<details id="r06">
<summary>R06 · 업무와 채팅 모델 및 저장 Port 분리</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PARTIAL** / 한글 **NA**.
- 완료 범위: 다른 업무 차단;업무/채팅 기록 유지;단일 writer와 부분 갱신으로 다른 영역을 덮어쓰지 않음
- 다음 작업: 업무 facade·v1 단일 writer 적용; slice repository/부분 갱신 계약 남음
- 선행 작업: [R03](<16-architecture-and-validation.md#r03>)
- 근거: [refactor-work-plan.csv](<../refactor-work-plan.csv>) · [32-modular-refactor-result.md](<../32-modular-refactor-result.md>)
- 원래 기록: `PARTIAL`

</details>

<details id="r07">
<summary>R07 · 자료와 검색 경계 분리</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PARTIAL** / 한글 **NA**.
- 완료 범위: 현재 HWP/HWPX/TXT/MD와 선택 범위/한도/임시 수명 유지;열린 미저장 자료 우선;다른 업무 자료 차단
- 다음 작업: 선택 자료 조회와 백그라운드 색인에 공통 읽기 경로를 적용했다. Chrome에서 선택한 HWPX를 열어 미저장 내용을 모델 요청에서 읽고 원본 파일을 바이트 단위로 보존했다. 다른 업무·닫힌 탭·연결 변경·취소 범위를 검사했다. 등록·추출 저장소와 파서 통합이 남았다.
- 선행 작업: [R04](<16-architecture-and-validation.md#r04>) · [R06](<16-architecture-and-validation.md#r06>)
- 근거: [refactor-work-plan.csv](<../refactor-work-plan.csv>) · [32-modular-refactor-result.md](<../32-modular-refactor-result.md>) · [workspace-reference-reader.ts](<../../apps/editor/src/composition/workspace-reference-reader.ts>) · [workspace-reference-reader.test.ts](<../../apps/editor/tests/workspace-reference-reader.test.ts>) · [manifest.json](<../evidence/checklist-completion-2026-11-21/manifest.json>)
- 원래 기록: `PARTIAL`

</details>

<details id="r08">
<summary>R08 · 환경과 보기 상태 모듈 분리</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PARTIAL** / 한글 **NA**.
- 완료 범위: 현재 key와 기본값/설정 보존;손상/미래 버전 자료 자동 덮어쓰기 금지;탭 간 변경 병합 유지
- 다음 작업: 환경 domain/Port/facade·설정 창 분리; host layout 저장은 v1 aggregate
- 선행 작업: [R03](<16-architecture-and-validation.md#r03>) · [R06](<16-architecture-and-validation.md#r06>)
- 근거: [refactor-work-plan.csv](<../refactor-work-plan.csv>) · [32-modular-refactor-result.md](<../32-modular-refactor-result.md>)
- 원래 기록: `PARTIAL`

</details>

<details id="r09">
<summary>R09 · 모델 연결과 제공자 adapter 경계 분리</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 4개 제공자+호환 adapter 계약 유지;키 재등록 없이 복원;canonical schema 투영;인증/origin/Host 정책 유지
- 다음 작업: 유지·회귀 검사
- 선행 작업: [R03](<16-architecture-and-validation.md#r03>)
- 근거: [refactor-work-plan.csv](<../refactor-work-plan.csv>) · [32-modular-refactor-result.md](<../32-modular-refactor-result.md>)
- 원래 기록: `DONE`

</details>

<details id="r10">
<summary>R10 · Agent 실행과 context 조립 분리</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PARTIAL** / 한글 **NA**.
- 완료 범위: single/bounded 동작 유지;최종 한 번 적용;취소/문서 변경/새 문서/부분 실패/실행 기록 검증;DOM/provider 직접 의존 없음
- 다음 작업: 장문 조회 조건·선택 자료와 검색·편집 기록의 입력값 가림을 문맥 조립 코드에 이관했다. AI와 반복 작업 실행 기록의 추가·조회는 같은 업무 상태에 연결한 저장소 계약을 사용한다. Chrome에서 문서 저장·재열기·되돌리기 및 편집기를 다시 열 때 채팅별 기록의 보존과 분리를 확인했다. 화면의 실행 상태 조정 추가 이관이 남았다.
- 선행 작업: [R04](<16-architecture-and-validation.md#r04>) · [R06](<16-architecture-and-validation.md#r06>) · [R07](<16-architecture-and-validation.md#r07>) · [R09](<16-architecture-and-validation.md#r09>)
- 근거: [refactor-work-plan.csv](<../refactor-work-plan.csv>) · [32-modular-refactor-result.md](<../32-modular-refactor-result.md>) · [agent-context.ts](<../../apps/editor/src/composition/agent-context.ts>) · [workspace-run-repository.ts](<../../apps/editor/src/adapters/storage/workspace-run-repository.ts>) · [agent-context.test.ts](<../../apps/editor/tests/agent-context.test.ts>) · [workspace-run-repository.test.ts](<../../apps/editor/tests/workspace-run-repository.test.ts>) · [manifest.json](<../evidence/checklist-completion-2026-11-21/manifest.json>)
- 원래 기록: `PARTIAL`

</details>

<details id="r11">
<summary>R11 · 매크로와 업무 템플릿 경계 분리</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 현행 7명령/대상 유일성/한 요청 undo 유지;독자 엔진 실행 없음;기존 macro v1 자료 유지
- 다음 작업: 명령과 수동 기록의 업무별 저장 경계 및 변수·대상 화면을 분리했다. Chrome에서 AI 편집으로 반복 작업을 생성하고 대상에 재생했다. 이름 변경과 삭제를 다시 열어 확인했고 다른 업무에 나타나지 않았다. 기존 형식의 본문 반복 작업도 재생했다. 저장 실패 뒤 이전 기록과 다음 저장을 보존한다.
- 선행 작업: [R04](<16-architecture-and-validation.md#r04>) · [R06](<16-architecture-and-validation.md#r06>)
- 근거: [refactor-work-plan.csv](<../refactor-work-plan.csv>) · [32-modular-refactor-result.md](<../32-modular-refactor-result.md>) · [147-checklist-completion.md](<../147-checklist-completion.md>) · [workspace-macro-repository.ts](<../../apps/editor/src/adapters/storage/workspace-macro-repository.ts>) · [command-macros.ts](<../../apps/editor/src/ui/command-macros.ts>) · [workspace-macro-repository.test.ts](<../../apps/editor/tests/workspace-macro-repository.test.ts>) · [manifest.json](<../evidence/checklist-completion-2026-11-21/manifest.json>)
- 원래 기록: `SCOPED_MACRO_REPOSITORY_VERIFIED_2026_11_22`

</details>

<details id="r12">
<summary>R12 · Session과 UI controller로 shell 해체</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PARTIAL** / 한글 **NA**.
- 완료 범위: shell은 조립/화면 연결만 소유;UI의 DB/LLM/WASM 직접 호출 없음;업무 전환/닫기/복구/포커스 흐름 유지
- 다음 작업: 업무 정렬·자료 폴더·임시 첨부·채팅 결과·종료 확인·문서 열기와 저장·인용 위치 이동을 분리했다. Chrome에서 같은 원본의 탭 재사용과 로컬 AI가 인용한 PDF 쪽·Word 문단·Excel 셀을 확인했다. 변경된 Windows 개발판에서 원본 충돌 안내와 두 파일 버전 보존을 확인했다. 이전 Windows 종료 확인에서 취소·복구본 보관·재실행을 검증했다. 문서 수명과 화면 상태 처리의 추가 이관이 남았다.
- 선행 작업: [R05](<16-architecture-and-validation.md#r05>) · [R06](<16-architecture-and-validation.md#r06>) · [R07](<16-architecture-and-validation.md#r07>) · [R08](<16-architecture-and-validation.md#r08>) · [R10](<16-architecture-and-validation.md#r10>) · [R11](<16-architecture-and-validation.md#r11>)
- 근거: [refactor-work-plan.csv](<../refactor-work-plan.csv>) · [32-modular-refactor-result.md](<../32-modular-refactor-result.md>) · [alignment-macros.ts](<../../apps/editor/src/ui/alignment-macros.ts>) · [reference-index-refresh.ts](<../../apps/editor/src/composition/reference-index-refresh.ts>) · [reference-panel.ts](<../../apps/editor/src/ui/reference-panel.ts>) · [chat-messages.ts](<../../apps/editor/src/ui/chat-messages.ts>) · [native-exit-dialog.ts](<../../apps/editor/src/ui/native-exit-dialog.ts>) · [workspace-recovery.ts](<../../apps/editor/src/composition/workspace-recovery.ts>) · [document-file-actions.ts](<../../apps/editor/src/composition/document-file-actions.ts>) · [reference-citations.ts](<../../apps/editor/src/composition/reference-citations.ts>) · [reference-citation-dialog.ts](<../../apps/editor/src/ui/reference-citation-dialog.ts>) · [document-file-actions.test.ts](<../../apps/editor/tests/document-file-actions.test.ts>) · [manifest.json](<../evidence/checklist-completion-2026-11-21/manifest.json>)
- 원래 기록: `PARTIAL`

</details>

<details id="r13">
<summary>R13 · iframe와 빌드 패치 의존을 adapter로 격리</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PARTIAL** / 한글 **NA**.
- 완료 범위: UI/application에서 contentWindow/global/Studio private import 제거;패치 대상/횟수/hash 불일치 시 빌드 실패;생성물 직접 수정 없음
- 다음 작업: bridgeVersion/메서드 검사·build patch 파일 분리; 완전 transport/Studio hook 최소화 남음
- 선행 작업: [R12](<16-architecture-and-validation.md#r12>)
- 근거: [refactor-work-plan.csv](<../refactor-work-plan.csv>) · [32-modular-refactor-result.md](<../32-modular-refactor-result.md>)
- 원래 기록: `PARTIAL`

</details>

<details id="r14">
<summary>R14 · 기존 상태와 자격증명 호환 최종 검수</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 업무/채팅/탭/설정/매크로/키를 초기화 없이 유지;모듈 간 영역 보존;미지원 새 버전 거부;평문 fallback 없음
- 다음 작업: 실제 Windows DPAPI 키 저장·복원·교체·삭제를 검증했다. 이름 없는 한글 제어 문자가 기록된 기존 업무 상태도 다시 열 수 있게 수정했다. 남은 모듈의 기존 데이터 검사가 필요하다.
- 선행 작업: [R12](<16-architecture-and-validation.md#r12>) · [R13](<16-architecture-and-validation.md#r13>)
- 근거: [refactor-work-plan.csv](<../refactor-work-plan.csv>) · [32-modular-refactor-result.md](<../32-modular-refactor-result.md>) · [147-checklist-completion.md](<../147-checklist-completion.md>) · [connection-store.test.mjs](<../../apps/launcher/tests/connection-store.test.mjs>) · [connection-persistence.test.mjs](<../../apps/launcher/tests/connection-persistence.test.mjs>) · [workspace-state.test.ts](<../../apps/editor/tests/workspace-state.test.ts>)
- 원래 기록: `VERIFIED_BASE;SCOPED_CHECKLIST_COMPLETION_2026_11_21`

</details>

<details id="r15">
<summary>R15 · 통합 회귀와 모듈별 변경 영향 검증</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 경계 위반 신규 0;기존 검증 동작 회귀 없음;문서·데이터 보존;가짜와 실제 adapter 계약 일치;미검증 한글 항목 별도 공개
- 다음 작업: 편집기와 실행기·파일 저장 검증 및 11개 모듈 경계를 재검사했다. 독립 한글과 미이관 모듈의 최종 통합은 남았다.
- 선행 작업: [R14](<16-architecture-and-validation.md#r14>)
- 근거: [refactor-work-plan.csv](<../refactor-work-plan.csv>) · [32-modular-refactor-result.md](<../32-modular-refactor-result.md>) · [147-checklist-completion.md](<../147-checklist-completion.md>) · [manifest.json](<../evidence/checklist-completion-2026-11-21/manifest.json>)
- 원래 기록: `VERIFIED_BASE;SCOPED_CHECKLIST_COMPLETION_2026_11_21`

</details>

<details id="g001">
<summary>G001 · rhwp 고정 소스·Rust/WASM 검수 빌드</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 고정 SHA와 추적 패치·실제 WASM 자산 기록
- 다음 작업: 기록된 범위 유지·관련 변경 시 회귀 검사
- 근거: [93-storage-table-and-memo-ownership.md](<../93-storage-table-and-memo-ownership.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g002">
<summary>G002 · 제3자 고지와 실행 묶음 고지 포함</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 현재 실행 구성의 고지 보존; 최종 배포 전체 법무 완료 아님
- 다음 작업: 기록된 범위 유지·관련 변경 시 회귀 검사
- 근거: [09-licensing.md](<../09-licensing.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g003">
<summary>G003 · Windows 독립 검수 실행기·포트 분리</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 기존 서버/사용자 문서를 유지하는 새 검수본
- 다음 작업: 기록된 범위 유지·관련 변경 시 회귀 검사
- 근거: [96-agent-table-merge.md](<../96-agent-table-merge.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g004">
<summary>G004 · 앱/엔진 소스와 검수 자산 해시 대조</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: Git LF 정규화·엔진 raw SHA·배포 자산 일치
- 다음 작업: 기록된 범위 유지·관련 변경 시 회귀 검사
- 근거: [96-agent-table-merge.md](<../96-agent-table-merge.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="n041">
<summary>N041 · 독립 한글에서 복합 코퍼스 일괄 검수</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 합성 본문·쪽 경계·표·그림·필드·명시 글꼴의 HWP/HWPX open→같은 형식 save→reopen·production preservation evidence·published layout·기능 최소조건·입력 SHA 불변
- 다음 작업: 합성 5종×HWP/HWPX 10/10과 manifest 계약 3/3을 통과했다. 같은 Jueony Rust/WASM 엔진의 기술 검수이며 실제 한글 2024 화면·인쇄·복구 경고, 기관 실문서와 공개 문서 코퍼스의 독립 비교는 남아 부분이다.
- 근거: [04-compatibility-validation.md](<../04-compatibility-validation.md>) · [143-non-agent-parallel-2026-11-08.md](<../143-non-agent-parallel-2026-11-08.md>)
- 원래 기록: `EXPLICIT_REMAINING_OR_AUDIT;SYNTHETIC_ENGINE_CORPUS_RUNNER_2026_11_09`

</details>

<details id="n042">
<summary>N042 · 한글·Jueony 인쇄/PDF 조판 비교</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 같은 글꼴·DPI·용지와 실제 page definition을 봉인한 Jueony published layout baseline·쪽 수/텍스트 재조판/개체 위치 결함 분류·교차 생산자와 글꼴 지문 fail-closed
- 다음 작업: A4 가로 PDF 두 장에 합성 문서 5쪽을 모아찍고 용지 크기와 원본 바이트를 확인했다. Jueony의 HWP/HWPX 조판 기준 2건 통과. 독립 한글 PDF·폰트·실물 출력 비교가 남았다.
- 상위 항목: [B019](<15-output-and-tools.md#b019>) 인쇄 미리 보기
- 근거: [04-compatibility-validation.md](<../04-compatibility-validation.md>) · [143-non-agent-parallel-2026-11-08.md](<../143-non-agent-parallel-2026-11-08.md>) · [147-checklist-completion.md](<../147-checklist-completion.md>)
- 원래 기록: `EXPLICIT_REMAINING_OR_AUDIT;JUEONY_PRINT_LAYOUT_BASELINE_2026_11_09`

</details>

<details id="n043">
<summary>N043 · 실제 Windows 파일 picker·권한·외부 수정</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: picker 취소 no-op와 봉인 증거 preflight 뒤 temp write/flush·final probe/revalidate·atomic compare-replace/readback을 순서화하고 race에는 replace 0회·실패에는 cleanup을 요구하며 committed 뒤 readback 문제는 save-state-uncertain과 reopen으로 분류해 원본 불변을 주장하지 않음
- 다음 작업: Windows 파일의 권한·잠금·외부 수정·HWP/HWPX/HWT 사본 보존 11건을 검증했다. 개발판의 실제 파일 선택창에서 합성 HWP·HWPX를 열고 사본의 바이트 또는 XML 본문을 확인했다. Chrome과 변경된 Windows 개발판에서 외부 수정 원인과 다른 이름 저장·재열기 안내를 확인했다. Windows 저장 선택창으로 편집 내용을 별도 HWPX에 저장했고 디스크 원본과 사본의 본문이 각각 보존됐다. 기관 ACL과 서명 설치본은 별도다.
- 상위 항목: [B010](<05-files-storage-recovery.md#b010>) 저장
- 근거: [12-mvp-implementation.md](<../12-mvp-implementation.md>) · [143-non-agent-parallel-2026-11-08.md](<../143-non-agent-parallel-2026-11-08.md>) · [147-checklist-completion.md](<../147-checklist-completion.md>) · [manifest.json](<../evidence/checklist-completion-2026-11-21/manifest.json>) · [verify-native-file-storage.mjs](<../../apps/editor/scripts/verify-native-file-storage.mjs>) · [verify-agent-files.mjs](<../../apps/editor/scripts/verify-agent-files.mjs>)
- 원래 기록: `EXPLICIT_REMAINING_OR_AUDIT;WINDOWS_FILE_PREFLIGHT_POLICY_2026_11_09;WINDOWS_ATOMIC_SAVE_COORDINATOR_2026_11_09;SCOPED_CHECKLIST_COMPLETION_2026_11_21`

</details>

<details id="n044">
<summary>N044 · 비정상 종료·저장 실패·복구 통합</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 별도 v1 checkpoint·IndexedDB CAS와 document lifecycle을 실제 설치 Edge 157의 격리 IndexedDB에서 commit·strict transaction complete·CAS conflict·blocked/versionchange fail-closed 분류까지 검증 실제 앱 업무 저장소의 복구본 쓰기·삭제와 창 종료도 최신 기록 대조 및 엄격한 트랜잭션 완료에 연결.
- 다음 작업: Chrome·고정 WebView2·Windows Tauri에서 종료 뒤 복구를 검증했다. Tauri 강제 종료 후 HWPX 미저장 글자와 무결성 값이 복원됐다. 실제 Windows 종료 확인창에서 취소와 복구본 보관 종료를 통과했고 재실행 뒤 글자와 원본 바이트를 확인했다. 전체 OS·저장 장치 장애가 남았다.
- 상위 항목: [B010](<05-files-storage-recovery.md#b010>) 저장
- 근거: [37-basic-editing-state-result.md](<../37-basic-editing-state-result.md>) · [143-non-agent-parallel-2026-11-08.md](<../143-non-agent-parallel-2026-11-08.md>) · [indexeddb-recovery-checkpoint-n044.ts](<../../apps/editor/src/adapters/storage/indexeddb-recovery-checkpoint-n044.ts>) · [recovery-checkpoint-lifecycle-n044.ts](<../../apps/editor/src/composition/recovery-checkpoint-lifecycle-n044.ts>) · [verify-recovery-checkpoint-browser-n044.mjs](<../../apps/editor/scripts/verify-recovery-checkpoint-browser-n044.mjs>) · [recovery-checkpoint-browser-n044.ts](<../../apps/editor/scripts/fixtures/recovery-checkpoint-browser-n044.ts>) · [147-checklist-completion.md](<../147-checklist-completion.md>) · [verify-recovery-integrity.mjs](<../../apps/editor/scripts/verify-recovery-integrity.mjs>) · [verify-close-recovery.mjs](<../../apps/editor/scripts/verify-close-recovery.mjs>) · [indexeddb-workspace.ts](<../../apps/editor/src/adapters/storage/indexeddb-workspace.ts>) · [verify-document-lifecycle.mjs](<../../apps/editor/scripts/verify-document-lifecycle.mjs>) · [verify-workspace-checkpoint-webview.mjs](<../../apps/editor/scripts/verify-workspace-checkpoint-webview.mjs>) · [106-recovery-integrity.md](<../106-recovery-integrity.md>) · [manifest.json](<../evidence/checklist-completion-2026-11-21/manifest.json>)
- 원래 기록: `EXPLICIT_REMAINING_OR_AUDIT;RECOVERY_CHECKPOINT_TRANSACTION_2026_11_09;INDEXEDDB_RECOVERY_CHECKPOINT_CAS_2026_11_09;RECOVERY_CHECKPOINT_LIFECYCLE_2026_11_09;EDGE_INDEXEDDB_RECOVERY_VERIFICATION_2026_11_09;SCOPED_CHECKLIST_COMPLETION_2026_11_21;WORKSPACE_STRICT_CHECKPOINT_2026_11_22`

</details>

<details id="n045">
<summary>N045 · 기관 배포용 완전 오프라인 자산/허용 서버 정책</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 로컬 WASM·런타임·폰트·third-party notices·hash와 기관 endpoint allowlist를 fail-closed 검사하고 외부 URL을 분류하는 오프라인 번들 감사 계약
- 다음 작업: 기관 오프라인 빌드의 로컬 파일 305개와 공식 WebView2 고정 런타임·약관·고지를 검증했다. 실제 Windows WebView2 검수 창에서 HWPX와 외부 모델 기본 거절을 확인했다. 기관 서명 설치본과 실제 기관망이 남았다.
- 근거: [06-license-inventory.md](<../06-license-inventory.md>) · [143-non-agent-parallel-2026-11-08.md](<../143-non-agent-parallel-2026-11-08.md>) · [offline-font-source-patches.mjs](<../../apps/editor/scripts/integration/offline-font-source-patches.mjs>) · [offline-font-source-patches.test.ts](<../../apps/editor/tests/offline-font-source-patches.test.ts>) · [n045-offline-contract.mjs](<../../apps/editor/scripts/lib/n045-offline-contract.mjs>) · [n045-offline-contract.test.ts](<../../apps/editor/tests/n045-offline-contract.test.ts>) · [146-ieumoffice-followup.md](<../146-ieumoffice-followup.md>) · [manifest.json](<../evidence/ieum-followup-2026-11-21/manifest.json>) · [147-checklist-completion.md](<../147-checklist-completion.md>) · [manifest.json](<../evidence/checklist-completion-2026-11-21/manifest.json>)
- 원래 기록: `EXPLICIT_REMAINING_OR_AUDIT;OFFLINE_BUNDLE_AUDIT_2026_11_09;CDN_FONT_LITERALS_REMOVED_256;EXTERNAL_ENDPOINTS_REMAINING_5;WEBVIEW2_FIXED_RUNTIME_MANIFEST_2026_11_09;FAIL_OFFLINE_BUNDLE;SCOPED_IEUM_FOLLOWUP_2026_11_21`

</details>

## 함께 보는 기능

- [파일·저장·복구·형식 보존](<05-files-storage-recovery.md>)
- [AI 연결·Agent 실행](<02-agent-and-models.md>)
- [상태 저장·환경·선택 복원](<13-state-and-preferences.md>)

이 파일은 자동 생성한다. 상태는 [CSV](<../jueony-work-checklist.csv>)에서, 기능 배치는 [분류 원본](<../checklist-features.json>)에서 수정한다.
