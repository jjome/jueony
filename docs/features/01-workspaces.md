# 업무·채팅·폴더 관리

[← 종합 진행 현황](<../jueony-progress.md>) · [전체 검색](<../jueony-work-checklist.html>) · [완료 규칙](<../97-master-work-checklist.md>)

업무별 workspace, 독립 채팅, 로컬 폴더 연결과 원본 유지.

## 진행 요약

실행 작업 **4개**, 상위 범위 **0개**. CSV의 기록을 기능별로 표시한 문서다.

| 구분 | 실행 작업 | 상위 범위 |
| :--- | :---: | :---: |
| 구현 | 완료 🟢 **4/4** · 부분 0 | — 상위 범위 없음 |
| 검증 | 완료 🟢 **4/4** · 부분 0 | — 상위 범위 없음 |
| Agent 연결 | 해당 없음 4 | — 상위 범위 없음 |

☑ 완료/연결 · ◐ 부분 · ☐ 대기 · ? 재점검 · — 해당 없음. 검증 완료에는 필요한 한글 직접 비교도 포함한다. 구현 완료만으로 세 축 완료가 되지 않는다.

## 기능별 작업표

관련된 상위 기능과 실행 작업을 함께 묶었다. 각 표는 최대 8개 항목이며, 완료된 항목도 같은 표에 유지한다. ID를 누르면 아래의 완료조건·근거로 이동한다. **범위** 행은 상위 점검, **작업** 행은 실행 작업으로 중복 집계하지 않는다.

- [업무·자료 · 독립 실행 작업](<#work-1>)

<a id="work-1"></a>

### 업무·자료 · 독립 실행 작업

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [G005](<01-workspaces.md#g005>) · 작업 | 업무 생성·전환·이름 변경 | ☑ 완료 | ☑ 완료 | — 해당 없음 |
| [G006](<01-workspaces.md#g006>) · 작업 | 업무별 독립 채팅 생성·전환·이름 변경 | ☑ 완료 | ☑ 완료 | — 해당 없음 |
| [G007](<01-workspaces.md#g007>) · 작업 | 여러 로컬 폴더 연결과 계층 트리 | ☑ 완료 | ☑ 완료 | — 해당 없음 |
| [G008](<01-workspaces.md#g008>) · 작업 | 폴더 연결 해제 시 원본 유지 | ☑ 완료 | ☑ 완료 | — 해당 없음 |

## 항목별 완료조건·근거

각 항목은 펼쳐서 읽는다. 상태와 근거는 CSV에서 관리한다.

<details id="g005">
<summary>G005 · 업무 생성·전환·이름 변경</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 업무별 독립 데이터와 선택 UI; Chrome에서 전환·재열기와 이전 업무 저장 실패 후 보존을 확인
- 다음 작업: 관련 변경 시 업무 전환·저장 실패 회귀 검사
- 근거: [12-mvp-implementation.md](<../12-mvp-implementation.md>) · [147-checklist-completion.md](<../147-checklist-completion.md>) · [manifest.json](<../evidence/checklist-completion-2026-11-21/manifest.json>)
- 원래 기록: `CHROME_WORKSPACE_SWITCH_RENAME_AND_FAILED_CHECKPOINT_PASS_2026_11_22`

</details>

<details id="g006">
<summary>G006 · 업무별 독립 채팅 생성·전환·이름 변경</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 채팅별 메시지·실행 이력 분리; Chrome에서 비활성 채팅을 두 번 눌러 이름을 바꾸고 재열기 확인
- 다음 작업: 관련 변경 시 채팅 전환과 실행 이력 회귀 검사
- 근거: [12-mvp-implementation.md](<../12-mvp-implementation.md>) · [147-checklist-completion.md](<../147-checklist-completion.md>) · [manifest.json](<../evidence/checklist-completion-2026-11-21/manifest.json>)
- 원래 기록: `CHROME_CHAT_RENAME_HISTORY_AND_RELOAD_PASS_2026_11_22`

</details>

<details id="g007">
<summary>G007 · 여러 로컬 폴더 연결과 계층 트리</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 원본 복사·이동 없는 읽기 전용 연결; Chrome 검수용 폴더 두 개·하위 폴더·중복 차단·업무별 분리 확인
- 다음 작업: 관련 변경 시 폴더 연결과 계층 표시 회귀 검사
- 근거: [12-mvp-implementation.md](<../12-mvp-implementation.md>) · [147-checklist-completion.md](<../147-checklist-completion.md>) · [manifest.json](<../evidence/checklist-completion-2026-11-21/manifest.json>)
- 원래 기록: `CHROME_READ_ONLY_MULTI_FOLDER_TREE_AND_WORKSPACE_ISOLATION_PASS_2026_11_22`

</details>

<details id="g008">
<summary>G008 · 폴더 연결 해제 시 원본 유지</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 실제 Windows 검수 폴더의 이동과 읽기 권한 차단 후 연결 해제·원본 바이트 보존·재실행 확인. 설정 저장 실패 시 연결 상태 유지
- 다음 작업: 관련 변경 시 Windows 폴더 이동·권한 차단·연결 상태 저장·원본 보존 검사
- 근거: [12-mvp-implementation.md](<../12-mvp-implementation.md>) · [147-checklist-completion.md](<../147-checklist-completion.md>) · [verify-windows-folder-unlink.mjs](<../../apps/editor/scripts/verify-windows-folder-unlink.mjs>) · [manifest.json](<../evidence/checklist-completion-2026-11-21/manifest.json>)
- 원래 기록: `WINDOWS_DIRECTORY_MOVE_ACL_AND_UNLINK_PERSISTENCE_PASS_2026_11_22`

</details>

## 함께 보는 기능

- [참고 자료·검색·RAG](<03-references-and-rag.md>)
- [AI 연결·Agent 실행](<02-agent-and-models.md>)
- [상태 저장·환경·선택 복원](<13-state-and-preferences.md>)

이 파일은 자동 생성한다. 상태는 [CSV](<../jueony-work-checklist.csv>)에서, 기능 배치는 [분류 원본](<../checklist-features.json>)에서 수정한다.
