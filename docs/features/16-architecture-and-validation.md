# 모듈·실행 기반·배포·최종 검수

[← 종합 진행 현황](<../jueony-progress.md>) · [전체 검색](<../jueony-work-checklist.html>) · [완료 규칙](<../97-master-work-checklist.md>)

레이어·facade·계약·엔진·고지·실행 묶음과 최종 한글·OS·오프라인 검수.

## 진행 요약

실행 작업 **25개**, 상위 범위 **0개**. CSV의 기록을 기능별로 표시한 문서다.

| 구분 | 실행 작업 | 상위 범위 |
| --- | --- | --- |
| 구현 | 완료 7/25 · 부분 16 · 미구현 2 | — 상위 범위 없음 |
| 검증 | 완료 7/25 · 부분 13 · 미검증 5 | — 상위 범위 없음 |
| Agent 연결 | 해당 없음 25 | — 상위 범위 없음 |

☑ 완료/연결 · ◐ 부분 · ☐ 대기 · ? 재점검 · — 해당 없음. 검증 완료에는 필요한 한글 직접 비교도 포함한다. 구현 완료만으로 세 축 완료가 되지 않는다.

## 먼저 할 일

- **구현** [N041](<16-architecture-and-validation.md#n041>) **독립 한글에서 복합 코퍼스 일괄 검수** — 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀
- **구현** [N042](<16-architecture-and-validation.md#n042>) **한글·Jueony 인쇄/PDF 조판 비교** — 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀
- **구현** [N043](<16-architecture-and-validation.md#n043>) **실제 Windows 파일 picker·권한·외부 수정** — 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀

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
| [R11](<16-architecture-and-validation.md#r11>) · 작업 | 매크로와 업무 템플릿 경계 분리 | ◐ 부분 | ◐ 부분 | — 해당 없음 |
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
| [N041](<16-architecture-and-validation.md#n041>) · 작업 | 독립 한글에서 복합 코퍼스 일괄 검수 | ☐ 미구현 | ☐ 미검증 | — 해당 없음 |
| [N042](<16-architecture-and-validation.md#n042>) · 작업 | 한글·Jueony 인쇄/PDF 조판 비교 | ☐ 미구현 | ☐ 미검증 | — 해당 없음 |
| [N043](<16-architecture-and-validation.md#n043>) · 작업 | 실제 Windows 파일 picker·권한·외부 수정 | ◐ 부분 | ☐ 미검증 | — 해당 없음 |
| [N044](<16-architecture-and-validation.md#n044>) · 작업 | 비정상 종료·저장 실패·복구 통합 | ◐ 부분 | ☐ 미검증 | — 해당 없음 |
| [N045](<16-architecture-and-validation.md#n045>) · 작업 | 기관 배포용 완전 오프라인 자산/허용 서버 정책 | ◐ 부분 | ☐ 미검증 | — 해당 없음 |

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
- 다음 작업: 자료 adapter·검색 facade·hash Port 적용; 등록/추출 repository/Parser Port 통합 남음
- 선행 작업: [R04](<16-architecture-and-validation.md#r04>) · [R06](<16-architecture-and-validation.md#r06>)
- 근거: [refactor-work-plan.csv](<../refactor-work-plan.csv>) · [32-modular-refactor-result.md](<../32-modular-refactor-result.md>)
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
- 다음 작업: 문맥·single/bounded 실행 facade 적용; RunRepository 및 화면 기록 조정 이관 남음
- 선행 작업: [R04](<16-architecture-and-validation.md#r04>) · [R06](<16-architecture-and-validation.md#r06>) · [R07](<16-architecture-and-validation.md#r07>) · [R09](<16-architecture-and-validation.md#r09>)
- 근거: [refactor-work-plan.csv](<../refactor-work-plan.csv>) · [32-modular-refactor-result.md](<../32-modular-refactor-result.md>)
- 원래 기록: `PARTIAL`

</details>

<details id="r11">
<summary>R11 · 매크로와 업무 템플릿 경계 분리</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PARTIAL** / 한글 **NA**.
- 완료 범위: 현행 7명령/대상 유일성/한 요청 undo 유지;독자 엔진 실행 없음;기존 macro v1 자료 유지
- 다음 작업: Automation facade·명령 재생 적용; macro repository와 화면 조정 일부 남음
- 선행 작업: [R04](<16-architecture-and-validation.md#r04>) · [R06](<16-architecture-and-validation.md#r06>)
- 근거: [refactor-work-plan.csv](<../refactor-work-plan.csv>) · [32-modular-refactor-result.md](<../32-modular-refactor-result.md>)
- 원래 기록: `PARTIAL`

</details>

<details id="r12">
<summary>R12 · Session과 UI controller로 shell 해체</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PARTIAL** / 한글 **NA**.
- 완료 범위: shell은 조립/화면 연결만 소유;UI의 DB/LLM/WASM 직접 호출 없음;업무 전환/닫기/복구/포커스 흐름 유지
- 다음 작업: Session/설정 UI 분리·typed iframe client 적용; 자료/메시지/복원 UI 추가 분리 남음
- 선행 작업: [R05](<16-architecture-and-validation.md#r05>) · [R06](<16-architecture-and-validation.md#r06>) · [R07](<16-architecture-and-validation.md#r07>) · [R08](<16-architecture-and-validation.md#r08>) · [R10](<16-architecture-and-validation.md#r10>) · [R11](<16-architecture-and-validation.md#r11>)
- 근거: [refactor-work-plan.csv](<../refactor-work-plan.csv>) · [32-modular-refactor-result.md](<../32-modular-refactor-result.md>)
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
- 검증 구분: 자동 **PARTIAL** / 한글 **NA**.
- 완료 범위: 업무/채팅/탭/설정/매크로/키를 초기화 없이 유지;모듈 간 영역 보존;미지원 새 버전 거부;평문 fallback 없음
- 다음 작업: 기존 기록은 VERIFIED_BASE(첫 이관 기준선)만 확인했다. 남은 모듈 이관 후 최종 호환/통합 회귀를 다시 확인한다.
- 선행 작업: [R12](<16-architecture-and-validation.md#r12>) · [R13](<16-architecture-and-validation.md#r13>)
- 근거: [refactor-work-plan.csv](<../refactor-work-plan.csv>) · [32-modular-refactor-result.md](<../32-modular-refactor-result.md>)
- 원래 기록: `VERIFIED_BASE`

</details>

<details id="r15">
<summary>R15 · 통합 회귀와 모듈별 변경 영향 검증</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PARTIAL** / 한글 **NA**.
- 완료 범위: 경계 위반 신규 0;기존 검증 동작 회귀 없음;문서·데이터 보존;가짜와 실제 adapter 계약 일치;미검증 한글 항목 별도 공개
- 다음 작업: 기존 기록은 VERIFIED_BASE(첫 이관 기준선)만 확인했다. 남은 모듈 이관 후 최종 호환/통합 회귀를 다시 확인한다.
- 선행 작업: [R14](<16-architecture-and-validation.md#r14>)
- 근거: [refactor-work-plan.csv](<../refactor-work-plan.csv>) · [32-modular-refactor-result.md](<../32-modular-refactor-result.md>)
- 원래 기록: `VERIFIED_BASE`

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
- 상태: 구현 ☐ 미구현 / 검증 ☐ 미검증 / Agent — 해당 없음.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NA**.
- 완료 범위: 문서/쪽/표/그림/필드/폰트·저장/재열기·결함별 증거
- 다음 작업: 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀
- 근거: [04-compatibility-validation.md](<../04-compatibility-validation.md>)
- 원래 기록: `EXPLICIT_REMAINING_OR_AUDIT`

</details>

<details id="n042">
<summary>N042 · 한글·Jueony 인쇄/PDF 조판 비교</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☐ 미구현 / 검증 ☐ 미검증 / Agent — 해당 없음.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 같은 폰트/DPI/용지·쪽 수/줄바꿈/개체·차이 분류
- 다음 작업: 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀
- 상위 항목: [B019](<15-output-and-tools.md#b019>) 인쇄 미리 보기
- 근거: [04-compatibility-validation.md](<../04-compatibility-validation.md>)
- 원래 기록: `EXPLICIT_REMAINING_OR_AUDIT`

</details>

<details id="n043">
<summary>N043 · 실제 Windows 파일 picker·권한·외부 수정</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent — 해당 없음.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 취소·read-only·이동/삭제·외부 hash 충돌·원본 보존
- 다음 작업: 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀
- 상위 항목: [B010](<05-files-storage-recovery.md#b010>) 저장
- 근거: [12-mvp-implementation.md](<../12-mvp-implementation.md>)
- 원래 기록: `EXPLICIT_REMAINING_OR_AUDIT`

</details>

<details id="n044">
<summary>N044 · 비정상 종료·저장 실패·복구 통합</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent — 해당 없음.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: disk full·권한·손상·부분 write·원본/복구본 유지
- 다음 작업: 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀
- 상위 항목: [B010](<05-files-storage-recovery.md#b010>) 저장
- 근거: [37-basic-editing-state-result.md](<../37-basic-editing-state-result.md>)
- 원래 기록: `EXPLICIT_REMAINING_OR_AUDIT`

</details>

<details id="n045">
<summary>N045 · 기관 배포용 완전 오프라인 자산/허용 서버 정책</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent — 해당 없음.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NA**.
- 완료 범위: 폰트/WASM/런타임·외부 요청0·기관 endpoint allowlist·고지
- 다음 작업: 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀
- 근거: [06-license-inventory.md](<../06-license-inventory.md>)
- 원래 기록: `EXPLICIT_REMAINING_OR_AUDIT`

</details>

## 함께 보는 기능

- [파일·저장·복구·형식 보존](<05-files-storage-recovery.md>)
- [AI 연결·Agent 실행](<02-agent-and-models.md>)
- [상태 저장·환경·선택 복원](<13-state-and-preferences.md>)

이 파일은 자동 생성한다. 상태는 [CSV](<../jueony-work-checklist.csv>)에서, 기능 배치는 [분류 원본](<../checklist-features.json>)에서 수정한다.
