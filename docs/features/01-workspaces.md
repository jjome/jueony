# 업무·채팅·폴더 관리

[← 종합 진행 현황](<../jueony-progress.md>) · [전체 검색](<../jueony-work-checklist.html>) · [완료 규칙](<../97-master-work-checklist.md>)

업무별 workspace, 독립 채팅, 로컬 폴더 연결과 원본 유지.

## 진행 요약

실행 작업 **4개**, 상위 범위 **0개**. CSV의 기록을 기능별로 표시한 문서다.

| 축 | 실행 작업 상태 |
| --- | --- |
| 구현 | 완료 4/4 · 부분 0 |
| 검증 | 완료 0/4 · 부분 4 |
| Agent 연결 | 해당 없음 4 |

☑ 완료/연결 · ◐ 부분 · ☐ 대기 · ? 재점검 · — 해당 없음. 검증 완료에는 필요한 한글 직접 비교도 포함한다. 구현 완료만으로 세 축 완료가 되지 않는다.

## 먼저 할 일

- **검증** [G005](<01-workspaces.md#g005>) **업무 생성·전환·이름 변경** — 기록된 범위 유지·관련 변경 시 회귀 검사
- **검증** [G006](<01-workspaces.md#g006>) **업무별 독립 채팅 생성·전환·이름 변경** — 기록된 범위 유지·관련 변경 시 회귀 검사
- **검증** [G007](<01-workspaces.md#g007>) **여러 로컬 폴더 연결과 계층 트리** — 기록된 범위 유지·관련 변경 시 회귀 검사

## 남은 실행 작업 (4)

항목 ID를 누르면 아래의 완료조건·근거를 펼쳐 확인할 수 있다.

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [G005](<01-workspaces.md#g005>) P1 | 업무 생성·전환·이름 변경 | ☑ 완료 | ◐ 부분 | — 해당 없음 |
| [G006](<01-workspaces.md#g006>) P1 | 업무별 독립 채팅 생성·전환·이름 변경 | ☑ 완료 | ◐ 부분 | — 해당 없음 |
| [G007](<01-workspaces.md#g007>) P1 | 여러 로컬 폴더 연결과 계층 트리 | ☑ 완료 | ◐ 부분 | — 해당 없음 |
| [G008](<01-workspaces.md#g008>) P1 | 폴더 연결 해제 시 원본 유지 | ☑ 완료 | ◐ 부분 | — 해당 없음 |

## 항목별 완료조건·근거

각 항목은 펼쳐서 읽는다. 상태와 근거는 CSV에서 관리한다.

<details id="g005">
<summary>G005 · 업무 생성·전환·이름 변경</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PARTIAL** / 한글 **NA**.
- 완료 범위: 업무별 독립 데이터와 선택 UI; 최초 통합 표본 범위
- 다음 작업: 기록된 범위 유지·관련 변경 시 회귀 검사
- 근거: [12-mvp-implementation.md](<../12-mvp-implementation.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g006">
<summary>G006 · 업무별 독립 채팅 생성·전환·이름 변경</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PARTIAL** / 한글 **NA**.
- 완료 범위: 채팅별 메시지·실행 이력 분리
- 다음 작업: 기록된 범위 유지·관련 변경 시 회귀 검사
- 근거: [12-mvp-implementation.md](<../12-mvp-implementation.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g007">
<summary>G007 · 여러 로컬 폴더 연결과 계층 트리</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PARTIAL** / 한글 **NA**.
- 완료 범위: 원본 복사/이동 없는 연결 방식
- 다음 작업: 기록된 범위 유지·관련 변경 시 회귀 검사
- 근거: [12-mvp-implementation.md](<../12-mvp-implementation.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g008">
<summary>G008 · 폴더 연결 해제 시 원본 유지</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PARTIAL** / 한글 **NA**.
- 완료 범위: 해제 처리 구현; OS 권한·이동 종합 검증 추가
- 다음 작업: 기록된 범위 유지·관련 변경 시 회귀 검사
- 근거: [12-mvp-implementation.md](<../12-mvp-implementation.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

## 함께 보는 기능

- [참고 자료·검색·RAG](<03-references-and-rag.md>)
- [AI 연결·Agent 실행](<02-agent-and-models.md>)
- [상태 저장·환경·선택 복원](<13-state-and-preferences.md>)

이 파일은 자동 생성한다. 상태는 [CSV](<../jueony-work-checklist.csv>)에서, 기능 배치는 [분류 원본](<../checklist-features.json>)에서 수정한다.
