# 파일·저장·복구·형식 보존

[← 종합 진행 현황](<../jueony-progress.md>) · [전체 검색](<../jueony-work-checklist.html>) · [완료 규칙](<../97-master-work-checklist.md>)

열기·저장·재열기, 버전 충돌과 원복, HWP/HWPX 직렬화 결함과 보존.

**현재 합본96:** 문서별 격리 이력·정확한 저장 날짜 보존·문서 story 정보·제한 XSD·실제 WASM HWT 읽기와 표 셀 줄바꿈을 추가했다. 공식 동일 빌드324/324·단위1008·기존 단표24·Windows저장10·실행묶음7 통과. 원MCST/Python3 최초 조판과 글 방향 매핑은 남아 파트 전체 부분 상태를 유지한다. [이번 수정·검수·잔여 표](../117-file-storage-closure.md).

## 진행 요약

실행 작업 **24개**, 상위 범위 **10개**. CSV의 기록을 기능별로 표시한 문서다.

| 구분 | 실행 작업 | 상위 범위 |
| --- | --- | --- |
| 구현 | 완료 23/24 · 부분 1 | 완료 0/10 · 부분 10 |
| 검증 | 완료 22/24 · 부분 2 | 완료 0/10 · 부분 10 |
| Agent 연결 | 연결 6/6 · 부분 0 · 해당 없음 18 | 연결 0/10 · 부분 5 · 미연결 5 |

☑ 완료/연결 · ◐ 부분 · ☐ 대기 · ? 재점검 · — 해당 없음. 검증 완료에는 필요한 한글 직접 비교도 포함한다. 구현 완료만으로 세 축 완료가 되지 않는다.

상위 범위는 세 축 완료 **0/10개**다. 세부 작업 완료 수와 분리해서 읽는다.

## 먼저 할 일

- **구현** [N001](<05-files-storage-recovery.md#n001>) **HWP 겹침 표의 복잡 배치·불명확 원점 저장 보존** — 96에서 실제 원본 셀 폭의 정수 HWP 단위 손실과 과밀 BREAK 셀 줄 경계를 수정. Python3 공개 비교731→680(319개는서식ID, 실제지면361차이). 원MCST/Python3 최초 조판·복합 프레임은 계속 수정 중. 저장/원본행/undo/redo 보호 유지.117참조; 한글 직접 비교 보류.
- **검증** [N002](<05-files-storage-recovery.md#n002>) **공개 형식 변환의 필드 보존 차이 4건** — 107패치 합본에서 표준 날짜·정확 OLE summary 정보까지 보존 읽기/양형식 왕복·손상 거절 추가. 명시 textDir HWP5 매핑과 최초 조판 차이는 별도 잔여이며 손실 변환 차단 유지.117참조; 한글 직접 비교 보류.

## 기능별 작업표

관련된 상위 기능과 실행 작업을 함께 묶었다. 각 표는 최대 8개 항목이며, 완료된 항목도 같은 표에 유지한다. ID를 누르면 아래의 완료조건·근거로 이동한다. **범위** 행은 상위 점검, **작업** 행은 실행 작업으로 중복 집계하지 않는다.

- [파일 · 상위 기능 점검](<#work-1>)
- [저장](<#work-2>)
- [다른 이름 저장](<#work-3>)
- [문서 닫기](<#work-4>)
- [프로그램 종료](<#work-5>)
- [저장·호환성 · 독립 실행 작업 (1)](<#work-6>)
- [저장·호환성 · 독립 실행 작업 (2)](<#work-7>)
- [HWP 겹침 표의 복잡 배치·불명확 원점 저장 보존](<#work-8>)
- [공개 형식 변환의 필드 보존 차이 4건](<#work-9>)

<a id="work-1"></a>

### 파일 · 상위 기능 점검

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B001](<05-files-storage-recovery.md#b001>) · 범위 | 새 문서 | ◐ 부분 | ◐ 부분 | ◐ 부분 |
| [B002](<05-files-storage-recovery.md#b002>) · 범위 | 새 탭 | ◐ 부분 | ◐ 부분 | ◐ 부분 |
| [B005](<05-files-storage-recovery.md#b005>) · 범위 | 불러오기 | ◐ 부분 | ◐ 부분 | ☐ 미연결 |
| [B006](<05-files-storage-recovery.md#b006>) · 범위 | 최근 문서 | ◐ 부분 | ◐ 부분 | ☐ 미연결 |
| [B009](<05-files-storage-recovery.md#b009>) · 범위 | XML 탭·서식·문서 입출력 | ◐ 부분 | ◐ 부분 | ☐ 미연결 |
| [B014](<05-files-storage-recovery.md#b014>) · 범위 | 문서 정보 | ◐ 부분 | ◐ 부분 | ◐ 부분 |

<a id="work-2"></a>

### 저장

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B010](<05-files-storage-recovery.md#b010>) · 범위 | 저장 | ◐ 부분 | ◐ 부분 | ◐ 부분 |
| [G093](<05-files-storage-recovery.md#g093>) · 작업 | 실제 저장 파일 readback 후 성공 확인 | ☑ 완료 | ☑ 완료 | — 해당 없음 |
| [G101](<05-files-storage-recovery.md#g101>) · 작업 | 복구본 내용·업무 지문 검증과 강제 종료 복원 | ☑ 완료 | ☑ 완료 | — 해당 없음 |
| [G102](<05-files-storage-recovery.md#g102>) · 작업 | Windows Rust 저장 기준·실제 바이트·잠금 보호 | ☑ 완료 | ☑ 완료 | — 해당 없음 |

<a id="work-3"></a>

### 다른 이름 저장

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B011](<05-files-storage-recovery.md#b011>) · 범위 | 다른 이름 저장 | ◐ 부분 | ◐ 부분 | ☐ 미연결 |
| [G094](<05-files-storage-recovery.md#g094>) · 작업 | 다른 형식 저장 뒤 출력 형식 유지·취소·재저장 | ☑ 완료 | ☑ 완료 | — 해당 없음 |
| [G103](<05-files-storage-recovery.md#g103>) · 작업 | 다운로드 최종 승인·출력 형식·원본 연결 수명 | ☑ 완료 | ☑ 완료 | — 해당 없음 |

<a id="work-4"></a>

### 문서 닫기

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B021](<05-files-storage-recovery.md#b021>) · 범위 | 문서 닫기 | ◐ 부분 | ◐ 부분 | ◐ 부분 |
| [G104](<05-files-storage-recovery.md#g104>) · 작업 | 복구본 폐기 실패 시 열린 문서 상태 보존 | ☑ 완료 | ☑ 완료 | — 해당 없음 |

<a id="work-5"></a>

### 프로그램 종료

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B022](<05-files-storage-recovery.md#b022>) · 범위 | 프로그램 종료 | ◐ 부분 | ◐ 부분 | ☐ 미연결 |
| [G107](<05-files-storage-recovery.md#g107>) · 작업 | 네이티브 파일 선택·저장·복구 후 실제 창 종료 | ☑ 완료 | ☑ 완료 | — 해당 없음 |

<a id="work-6"></a>

### 저장·호환성 · 독립 실행 작업 (1)

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [G065](<05-files-storage-recovery.md#g065>) · 작업 | 문서 사본에서 적용→저장→재열기 사전 검사 | ☑ 완료 | ☑ 완료 | ☑ 연결 |
| [G066](<05-files-storage-recovery.md#g066>) · 작업 | 오래된 문서 버전 결과의 덮어쓰기 거절 | ☑ 완료 | ☑ 완료 | ☑ 연결 |
| [G067](<05-files-storage-recovery.md#g067>) · 작업 | 부분 Native 변경·재렌더 실패의 요청 원복 | ☑ 완료 | ☑ 완료 | ☑ 연결 |
| [G068](<05-files-storage-recovery.md#g068>) · 작업 | 복구 렌더와 새 변경 검증의 분리 | ☑ 완료 | ☑ 완료 | ☑ 연결 |
| [G069](<05-files-storage-recovery.md#g069>) · 작업 | HWPX 기본 탭 저장 값 보정 | ☑ 완료 | ☑ 완료 | ☑ 연결 |
| [G070](<05-files-storage-recovery.md#g070>) · 작업 | 숨김 끝 문단의 실제 페이지 소유 | ☑ 완료 | ☑ 완료 | ☑ 연결 |
| [G071](<05-files-storage-recovery.md#g071>) · 작업 | 겹침 금지 HWP 후속 표의 저장 앵커 소유 | ☑ 완료 | ☑ 완료 | — 해당 없음 |
| [G072](<05-files-storage-recovery.md#g072>) · 작업 | HWP 메모 carrier의 본문 소유 분리 | ☑ 완료 | ☑ 완료 | — 해당 없음 |

<a id="work-7"></a>

### 저장·호환성 · 독립 실행 작업 (2)

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [G073](<05-files-storage-recovery.md#g073>) · 작업 | 표 바깥 여백의 HWP/HWPX 모델·저장 일치 | ☑ 완료 | ☑ 완료 | — 해당 없음 |

<a id="work-8"></a>

### HWP 겹침 표의 복잡 배치·불명확 원점 저장 보존

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [G090](<05-files-storage-recovery.md#g090>) · 작업 | HWP 단순 겹침 표 tail의 저장 snapshot 원점 기록 | ☑ 완료 | ☑ 완료 | — 해당 없음 |
| [N001](<05-files-storage-recovery.md#n001>) · 작업 | HWP 겹침 표의 복잡 배치·불명확 원점 저장 보존 | ◐ 부분 | ◐ 부분 | — 해당 없음 |
| [G096](<05-files-storage-recovery.md#g096>) · 작업 | HWP 겹침 표 뒤 단일 본문 글줄의 저장 원점 보존 | ☑ 완료 | ☑ 완료 | — 해당 없음 |
| [G097](<05-files-storage-recovery.md#g097>) · 작업 | 알려진 HWP 겹침 배치 손상의 원본 쓰기 차단 | ☑ 완료 | ☑ 완료 | — 해당 없음 |
| [G105](<05-files-storage-recovery.md#g105>) · 작업 | 겹침 표 후속 여러 줄 본문·캡션 원점 보존 | ☑ 완료 | ☑ 완료 | — 해당 없음 |
| [G106](<05-files-storage-recovery.md#g106>) · 작업 | 후속 통째 표의 의미 흐름과 실제 양수 offset 보존 | ☑ 완료 | ☑ 완료 | — 해당 없음 |

<a id="work-9"></a>

### 공개 형식 변환의 필드 보존 차이 4건

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [N002](<05-files-storage-recovery.md#n002>) · 작업 | 공개 형식 변환의 필드 보존 차이 4건 | ☑ 완료 | ◐ 부분 | — 해당 없음 |
| [G092](<05-files-storage-recovery.md#g092>) · 작업 | HWP 글상자 알려진 세로 정렬과 raw list 비트 동기화 | ☑ 완료 | ☑ 완료 | — 해당 없음 |

## 항목별 완료조건·근거

각 항목은 펼쳐서 읽는다. 상태와 근거는 CSV에서 관리한다.

<details id="b001">
<summary>B001 · 새 문서</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ◐ 부분.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 실제 Windows Alt+N 독립 창·Ctrl+Alt+T 새 탭·고유 저장소·복구 보관 종료·동일 UUID 재열기·OS 저장과 독립 readback 완료. 정식73 Native 창/파일29검사와 Agent6/Edge12 통과. 한글 전체 문맥·서식·대화상자 동등성은 별도 검수.
- UI 명령: `file:new-doc`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>) · [110-file-preservation-integration.md](<../110-file-preservation-integration.md>)
- 원래 기록: `PARTIAL;NOT_RUN;SCOPED_NATIVE_WINDOWS_AND_AGENT_FILE_PORT_REVIEWED_2026_10_18`

</details>

<details id="b002">
<summary>B002 · 새 탭</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ◐ 부분.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 실제 Windows Alt+N 독립 창·Ctrl+Alt+T 새 탭·고유 저장소·복구 보관 종료·동일 UUID 재열기·OS 저장과 독립 readback 완료. 정식73 Native 창/파일29검사와 Agent6/Edge12 통과. 한글 전체 문맥·서식·대화상자 동등성은 별도 검수.
- UI 명령: `file:new-doc`
- Agent 명령: `list_document_tabs;new_document_tab;activate_document_tab`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>) · [110-file-preservation-integration.md](<../110-file-preservation-integration.md>)
- 원래 기록: `WIRED;NOT_RUN;SCOPED_NATIVE_WINDOWS_AND_AGENT_FILE_PORT_REVIEWED_2026_10_18`

</details>

<details id="b005">
<summary>B005 · 불러오기</summary>

- 종류: 한글 상위 기능 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ☐ 미연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: HWP/HWPX 대상
- UI 명령: `file:open`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>) · [109-file-preservation-hancom-followup.md](<../109-file-preservation-hancom-followup.md>)
- 원래 기록: `WIRED;NOT_RUN`

</details>

<details id="b006">
<summary>B006 · 최근 문서</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ☐ 미연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 최근 원본 재연결 구현: 업무별 native app-data 목록·opaque ID·재시작 새 token·변경 동의/재변경 거절·중복 탭 방지. TS30/Windows Rust18/실제 Edge+합성 native IPC9 통과. 실제 Windows 픽커/프로세스 재시작 UI·한글 동작 대조·Agent 파일 명령은 남음. 최근 목록1MiB 쓰기 선검사 추가: 기존 읽을 수 있는 목록 보존과 아래 상한 저장을 Windows library에서 확인(112번).
- UI 명령: `file:open-recent`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>) · [109-file-preservation-hancom-followup.md](<../109-file-preservation-hancom-followup.md>) · [native-recents-completion.json](<../evidence/file-completion-2026-10-17/engine65/application/native-recents-completion.json>)
- 원래 기록: `SCOPED_NATIVE_RECENTS_IMPLEMENTED;FULL_NATIVE_GUI_AND_AGENT_PENDING_2026_10_17`

</details>

<details id="b009">
<summary>B009 · XML 탭·서식·문서 입출력</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ☐ 미연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 제한 XSD named/inline 단순형·문자열/정수/소수/boolean 제약과 지속 복구를 연결. 실제 Rust/WASM HWT 고정 스트림 추출·읽기 전용 DOM 화면을 추가했고 부모→iframe 실제 엔진 연결도 검사했다. HWT 본문 필드 쓰기·재저장·XSL·일반 XSD·Agent 편집은 남음. 상세 범위·검사 결과는117참조. 한글 직접 비교 보류.
- UI 명령: `file:xml-workspace`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>) · [110-file-preservation-integration.md](<../110-file-preservation-integration.md>) · [handoff-summary.json](<../evidence/file-completion-2026-10-18/xml76b/handoff-summary.json>) · [112-file-recovery-implementation.md](<../112-file-recovery-implementation.md>) · [117-file-storage-closure.md](<../117-file-storage-closure.md>)
- 원래 기록: `MISSING;NOT_RUN;SCOPED_NATIVE_WINDOWS_AND_AGENT_FILE_PORT_REVIEWED_2026_10_18;SCOPED_XML_SEQUENCE_WORKSPACE_EDGE20_PASS_HWT_XSL_AND_AGENT_UNSUPPORTED_2026_10_18;XML_WORKSPACE_PERSISTENT_RECOVERY_IMPLEMENTED_HEADLESS_VERIFIED_2026_10_18;FILE_STORAGE96_COMBINED324_UNIT1008_WINDOWS10_PASS_2026_10_18`

</details>

<details id="b010">
<summary>B010 · 저장</summary>

- 종류: 한글 상위 기능 · 우선순위: P0.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ◐ 부분.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 기존 저장·readback·버전/원본 충돌 보호에 현재 승인된 활성 연결 Agent 저장을 추가했다. HWP/HWPX 실제 엔진 payload·기존 writer·재읽기와 동시 사용자 수정 거절을 headless 앱에서 확인. 파일 명령은 단독 요청·경로/권한요청/픽커/형식변경 없음. Native 새 빌드 완료. 전체 한글 저장 문맥과 직접 비교는 사용자 요청으로 보류.
- UI 명령: `file:save`
- Agent 명령: `save_active_document`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>) · [105-file-storage-preservation.md](<../105-file-storage-preservation.md>) · [verification-summary.json](<../evidence/state-storage-2026-10-16/verification-summary.json>) · [108-file-preservation-completion.md](<../108-file-preservation-completion.md>) · [verification-summary.json](<../evidence/file-preservation-2026-10-17/verification-summary.json>) · [109-file-preservation-hancom-followup.md](<../109-file-preservation-hancom-followup.md>) · [112-file-recovery-implementation.md](<../112-file-recovery-implementation.md>) · [113-file-format-preservation.md](<../113-file-format-preservation.md>) · [README.md](<../evidence/file-completion-2026-10-18/package91/README.md>) · [114-native-row-storage.md](<../114-native-row-storage.md>) · [README.md](<../evidence/file-completion-2026-10-18/native-rows92/README.md>) · [115-column-width-storage.md](<../115-column-width-storage.md>) · [README.md](<../evidence/file-completion-2026-10-18/columns93/README.md>)
- 원래 기록: `WIRED;NOT_RUN;BOUND_ACTIVE_SAVE_IMPLEMENTED_HWP_HWPX_HEADLESS_VERIFIED_2026_10_18`

</details>

<details id="b011">
<summary>B011 · 다른 이름 저장</summary>

- 종류: 한글 상위 기능 · 우선순위: P0.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ☐ 미연결.
- 검증 구분: 자동 **PARTIAL** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 최종 저장/다운로드/다른 형식 재저장/취소·실패/복구 및 실제 Windows 읽기 전용·공유 잠금 검증. 실제 picker GUI·전체 ACL·전원/디스크 장애·한글 직접 검수는 남음.
- UI 명령: `file:save-as`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>) · [105-file-storage-preservation.md](<../105-file-storage-preservation.md>) · [verification-summary.json](<../evidence/state-storage-2026-10-16/verification-summary.json>) · [108-file-preservation-completion.md](<../108-file-preservation-completion.md>) · [verification-summary.json](<../evidence/file-preservation-2026-10-17/verification-summary.json>) · [113-file-format-preservation.md](<../113-file-format-preservation.md>) · [README.md](<../evidence/file-completion-2026-10-18/package91/README.md>) · [114-native-row-storage.md](<../114-native-row-storage.md>) · [README.md](<../evidence/file-completion-2026-10-18/native-rows92/README.md>) · [115-column-width-storage.md](<../115-column-width-storage.md>) · [README.md](<../evidence/file-completion-2026-10-18/columns93/README.md>)
- 원래 기록: `WIRED;NOT_RUN`

</details>

<details id="b014">
<summary>B014 · 문서 정보</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ◐ 부분.
- 검증 구분: 자동 **PARTIAL** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 저장된 작성/수정/인쇄일·편집 시간을 실제 OLE/OPF에서 정확한100ns 단위로 읽고 양형식 보존·UI·Agent 문맥 연결. 문서별 CAS 이력과 본문/표/글상자/머리말/각주 등 모델 통계 추가. 현재 시각 갱신·편집 시간 누적·한글 통계 동등성은 미완료. 기존5속성 수정·Undo/Redo·엄격 저장 유지.117참조.
- UI 명령: `file:document-info`
- Agent 명령: `set_document_metadata`
- 근거: [parity-result.json](<../evidence/features-2026-10-11/parity-result.json>) · [editor-tests.txt](<../evidence/features-2026-10-11/editor-tests.txt>) · [109-file-preservation-hancom-followup.md](<../109-file-preservation-hancom-followup.md>) · [README.md](<../evidence/file-completion-2026-10-17/engine68/metadata/README.md>) · [110-file-preservation-integration.md](<../110-file-preservation-integration.md>) · [113-file-format-preservation.md](<../113-file-format-preservation.md>) · [README.md](<../evidence/file-completion-2026-10-18/package91/README.md>) · [117-file-storage-closure.md](<../117-file-storage-closure.md>)
- 원래 기록: `PARTIAL;FIVE_FIELD_METADATA_EDIT_AND_ROUNDTRIP_VERIFIED_FULL_INFORMATION_PARITY_PENDING_2026_10_17;SCOPED_NATIVE_WINDOWS_AND_AGENT_FILE_PORT_REVIEWED_2026_10_18;FILE_STORAGE96_COMBINED324_UNIT1008_WINDOWS10_PASS_2026_10_18`

</details>

<details id="b021">
<summary>B021 · 문서 닫기</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ◐ 부분.
- 검증 구분: 자동 **PARTIAL** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 사용자 UI의 저장/폐기/복구 보관/취소와 실패 원복 유지. Agent는 현재 업무의 조회한 clean 탭만 CAS로 닫고 신규 복구본/다른 업무/dirty 탭/부분 실패를 거절. 전체 OS 종료·dirty 폐기 Agent 권한과 모든 한글 문맥 검수는 남음.
- UI 명령: `ext:jueony-close`
- Agent 명령: `close_document_tab`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>) · [108-file-preservation-completion.md](<../108-file-preservation-completion.md>) · [verification-summary.json](<../evidence/file-preservation-2026-10-17/verification-summary.json>) · [completion.json](<../evidence/file-completion-2026-10-17/engine68/lifecycle/completion.json>) · [110-file-preservation-integration.md](<../110-file-preservation-integration.md>)
- 원래 기록: `PARTIAL;HOST_MENU_CLOSE_AND_EXIT_LIFECYCLE_VERIFIED_NATIVE_HANCOM_AGENT_PENDING_2026_10_17;SCOPED_NATIVE_WINDOWS_AND_AGENT_FILE_PORT_REVIEWED_2026_10_18`

</details>

<details id="b022">
<summary>B022 · 프로그램 종료</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ☐ 미연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 실제 Windows 종료 취소·복구 보관 종료·프로세스 재실행과 독립 창만 종료/같은 UUID 재열기 검수 완료. 원본 파일 불변·최신 dirty 복원·별도 OS 저장 readback 확인. 전체 다창 종료 정책·모든 저장 실패/한글 비교·Agent OS 종료는 남음.
- UI 명령: `file:exit`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>) · [109-file-preservation-hancom-followup.md](<../109-file-preservation-hancom-followup.md>) · [completion.json](<../evidence/file-completion-2026-10-17/engine68/lifecycle/completion.json>) · [110-file-preservation-integration.md](<../110-file-preservation-integration.md>)
- 원래 기록: `PARTIAL;ATOMIC_SAVE_DISCARD_RECOVERY_CANCEL_IMPLEMENTED_DIRECT_NATIVE_AND_AGENT_PENDING_2026_10_17;SCOPED_NATIVE_WINDOWS_AND_AGENT_FILE_PORT_REVIEWED_2026_10_18`

</details>

<details id="g065">
<summary>G065 · 문서 사본에서 적용→저장→재열기 사전 검사</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 같은 형식의 사전 보존 검사; 실제 한글 조판 보장은 아님
- 다음 작업: 기록된 범위 유지·관련 변경 시 회귀 검사
- 근거: [28-continuation-implementation.md](<../28-continuation-implementation.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g066">
<summary>G066 · 오래된 문서 버전 결과의 덮어쓰기 거절</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 지연 응답 중 사용자 편집·다음 요청
- 다음 작업: 기록된 범위 유지·관련 변경 시 회귀 검사
- 근거: [96-agent-table-merge.md](<../96-agent-table-merge.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g067">
<summary>G067 · 부분 Native 변경·재렌더 실패의 요청 원복</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 정확한 bytes·history·dirty·cursor 복구
- 다음 작업: 기록된 범위 유지·관련 변경 시 회귀 검사
- 근거: [96-agent-table-merge.md](<../96-agent-table-merge.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g068">
<summary>G068 · 복구 렌더와 새 변경 검증의 분리</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 첫 렌더 실패 후 원본 복구에 새 높이 강요하지 않음
- 다음 작업: 기록된 범위 유지·관련 변경 시 회귀 검사
- 근거: [95-agent-row-heights.md](<../95-agent-row-heights.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g069">
<summary>G069 · HWPX 기본 탭 저장 값 보정</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **DONE**.
- 완료 범위: 기록된 기본 탭/구역 합치기 및 20/40/60pt 구역. 폭 미정 탭과 유효 LINE_SEG가 함께 남는 HWPX 저장 결함도 포함. HWP 바이너리 모델 저장의 미정 탭 캐시도 포함; 기존 무편집 raw BodyText 보존.
- 다음 작업: 기록된 기본 탭·구역 합치기 및 20/40/60pt 저장 검수 마감. 정식63의 HWP/HWPX 반복 저장·실제 한글 재저장 의미/지면0차이. 무편집 legacy raw 원본은 보존하며 복잡 사용자 탭은 별도 항목으로 관리.
- 근거: [36-native-section-comparison.md](<../36-native-section-comparison.md>) · [109-file-preservation-hancom-followup.md](<../109-file-preservation-hancom-followup.md>) · [manifest.json](<../evidence/file-completion-2026-10-17/engine63/manifest.json>)
- 원래 기록: `SCOPED_DONE;FORMAL63_AND_ACTUAL_HANCOM_HWP_HWPX_PASS_2026_10_17`

</details>

<details id="g070">
<summary>G070 · 숨김 끝 문단의 실제 페이지 소유</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 긴 표 재배치·후속 본문 조회·저장 원복
- 다음 작업: 기록된 범위 유지·관련 변경 시 회귀 검사
- 근거: [92-terminal-paragraph-page-owner.md](<../92-terminal-paragraph-page-owner.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g071">
<summary>G071 · 겹침 금지 HWP 후속 표의 저장 앵커 소유</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **DONE**.
- 완료 범위: 실제 앞 표 occupied flow 증거에 한정; 겹침 허용 제외
- 다음 작업: 마감: 기존 두/세 표·긴 내용 회귀와 실제 한글2024가 별도 저장한 HWP/HWPX 3개 비겹침 표를 정식65에서 전체 의미·공개 배치 차이0으로 확인. 반복 저장/재열기2회 통과. 겹침 허용·복잡 원점은 N001로 남긴다.
- 근거: [93-storage-table-and-memo-ownership.md](<../93-storage-table-and-memo-ownership.md>) · [109-file-preservation-hancom-followup.md](<../109-file-preservation-hancom-followup.md>) · [following-table-hancom-formal65.json](<../evidence/file-completion-2026-10-17/engine65/results/following-table-hancom-formal65.json>)
- 원래 기록: `SCOPED_COMPLETE;INDEPENDENT_HANCOM_RECHECK_FORMAL65_2026_10_17`

</details>

<details id="g072">
<summary>G072 · HWP 메모 carrier의 본문 소유 분리</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 유일한 Memo 필드 소유 증거·진짜 빈 문단 유지
- 다음 작업: 기록된 범위 유지·관련 변경 시 회귀 검사
- 근거: [93-storage-table-and-memo-ownership.md](<../93-storage-table-and-memo-ownership.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g073">
<summary>G073 · 표 바깥 여백의 HWP/HWPX 모델·저장 일치</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **DONE**.
- 완료 범위: 네 방향 semantic/common/raw cache·취소·undo·재열기
- 다음 작업: 정식68에서 마감: 실제 한글 양형식 사본의 표·전체 공개 지면 차이0, 실제 fresh/loaded4경로·Undo·보존 재열기 통과. 제목1개 자동부여 차이는 raw oracle로 별도 보고하고 지우지 않음. 보호 음성·본문 및 unknown bytes 보존 유지.
- 근거: [94-table-width-and-outer-margins.md](<../94-table-width-and-outer-margins.md>) · [109-file-preservation-hancom-followup.md](<../109-file-preservation-hancom-followup.md>) · [contract31-bom-preserving.json](<../evidence/file-completion-2026-10-17/engine68/outer/contract31-bom-preserving.json>) · [result.json](<../evidence/file-completion-2026-10-17/engine68/regressions/outer-native/result.json>) · [README.md](<../evidence/file-completion-2026-10-17/engine68/metadata/README.md>)
- 원래 기록: `DONE;FORMAL68_OUTER_ORIGIN_LIVE_SAVE_AND_HANCOM_PAIRS_VERIFIED_2026_10_17`

</details>

<details id="g090">
<summary>G090 · HWP 단순 겹침 표 tail의 저장 snapshot 원점 기록</summary>

- 종류: 실행 작업 · 우선순위: P0.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **DONE**.
- 완료 범위: 한 쪽·한 단·통째 object-only 표 tail 및 고유 단일 줄 빈 후속 본문; live불변/snapshot/반복저장/배치보존
- 다음 작업: 한 쪽·한 단·허용 object-only 표 tail 범위: 정식76 실제 한글11쌍 전체 의미·지면0과 엄격 양형식 반복 저장을 확인했다. 두 단 별도24검수와 실제 Edge 편집·Undo/Redo·사본 저장5검수도 분리 기록한다. 범위 밖 임의 배치는 N001에 유지.
- 상위 항목: [N001](<05-files-storage-recovery.md#n001>) HWP 겹침 표의 복잡 배치·불명확 원점 저장 보존
- 근거: [100-storage-conversion-and-overlap.md](<../100-storage-conversion-and-overlap.md>) · [verification-summary.json](<../evidence/overlap-table-tail-2026-10-15/verification-summary.json>) · [108-file-preservation-completion.md](<../108-file-preservation-completion.md>) · [verification-summary.json](<../evidence/file-preservation-2026-10-17/verification-summary.json>) · [actual11-formal68.json](<../evidence/file-completion-2026-10-17/hancom-current68/actual11-formal68.json>) · [110-file-preservation-integration.md](<../110-file-preservation-integration.md>) · [summary.json](<../evidence/file-completion-2026-10-18/engine75/summary.json>) · [summary.json](<../evidence/file-completion-2026-10-18/engine76/summary.json>)
- 원래 기록: `SCOPED_STORAGE_TAIL_WRITEBACK;SCOPED_TAIL_ACTUAL_HANCOM_FORMAL76_AND_STRICT_STORAGE_PASS_2026_10_18`

</details>

<details id="n001">
<summary>N001 · HWP 겹침 표의 복잡 배치·불명확 원점 저장 보존</summary>

- 종류: 실행 작업 · 우선순위: P0.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PARTIAL** / 한글 **PARTIAL**.
- 완료 범위: 확인한 단일 단 HWP 겹침 표·직접 본문 줄·혼합 서식·읽기 전용 책갈피/필드 표시의 흐름·저장 소유를 보강했다. bare LINE_SEG 캐시와 실제 여백/offset을 구분한다. 다단·복합/불명확 원점의 지원 확대는 완료로 표시하지 않는다.
- 다음 작업: 96에서 실제 원본 셀 폭의 정수 HWP 단위 손실과 과밀 BREAK 셀 줄 경계를 수정. Python3 공개 비교731→680(319개는서식ID, 실제지면361차이). 원MCST/Python3 최초 조판·복합 프레임은 계속 수정 중. 저장/원본행/undo/redo 보호 유지.117참조; 한글 직접 비교 보류.
- 상위 항목: [B153](<08-tables.md#b153>) 셀 속성
- 근거: [100-storage-conversion-and-overlap.md](<../100-storage-conversion-and-overlap.md>) · [verification-summary.json](<../evidence/overlap-table-tail-2026-10-15/verification-summary.json>) · [105-file-storage-preservation.md](<../105-file-storage-preservation.md>) · [verification-summary.json](<../evidence/state-storage-2026-10-16/verification-summary.json>) · [108-file-preservation-completion.md](<../108-file-preservation-completion.md>) · [verification-summary.json](<../evidence/file-preservation-2026-10-17/verification-summary.json>) · [109-file-preservation-hancom-followup.md](<../109-file-preservation-hancom-followup.md>) · [summary.json](<../evidence/file-completion-2026-10-17/engine51/summary.json>) · [actual11-formal68.json](<../evidence/file-completion-2026-10-17/hancom-current68/actual11-formal68.json>) · [110-file-preservation-integration.md](<../110-file-preservation-integration.md>) · [summary.json](<../evidence/file-completion-2026-10-18/engine75/summary.json>) · [summary.json](<../evidence/file-completion-2026-10-18/engine76/summary.json>) · [README.md](<../evidence/file-completion-2026-10-18/engine80/README.md>) · [README.md](<../evidence/file-completion-2026-10-18/engine82/README.md>) · [README.md](<../evidence/file-completion-2026-10-18/engine83/README.md>) · [111-file-storage-final-review.md](<../111-file-storage-final-review.md>) · [README.md](<../evidence/file-completion-2026-10-18/engine86/README.md>) · [112-file-recovery-implementation.md](<../112-file-recovery-implementation.md>) · [113-file-format-preservation.md](<../113-file-format-preservation.md>) · [README.md](<../evidence/file-completion-2026-10-18/package91/README.md>) · [114-native-row-storage.md](<../114-native-row-storage.md>) · [README.md](<../evidence/file-completion-2026-10-18/native-rows92/README.md>) · [115-column-width-storage.md](<../115-column-width-storage.md>) · [README.md](<../evidence/file-completion-2026-10-18/columns93/README.md>) · [116-reflowed-native-storage.md](<../116-reflowed-native-storage.md>) · [README.md](<../evidence/file-completion-2026-10-18/reflow94/README.md>) · [117-file-storage-closure.md](<../117-file-storage-closure.md>)
- 원래 기록: `PARTIAL;INDEPENDENT_HANCOM_FAILURES_FOUND_AND_FOLLOWUP_2026_10_17;FORMAL80_SCOPED_REGRESSIONS_PASS_CROSS_FORMAT_AND_NATIVE_LINE_FIT_OPEN;FORMAL82_STRICT_ROUNDTRIP_PASS_NATIVE_INTEROP_FOLLOWUP_OPEN;FORMAL83_NOTE_SUMMARY_NATIVE_ROUNDTRIP_INITIAL_PARITY_OPEN;FORMAL86_SAFE_STORAGE_UNSUPPORTED_DIRECTIONS_BLOCKED_NATIVE_GUI_PENDING;COMPUTED_PREFIX94_AUTOMATED_CLOSURE_PASS_NATIVE_PARITY_OPEN;FILE_STORAGE96_COMBINED324_UNIT1008_WINDOWS10_PASS_2026_10_18`

</details>

<details id="n002">
<summary>N002 · 공개 형식 변환의 필드 보존 차이 4건</summary>

- 종류: 실행 작업 · 우선순위: P0.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **PARTIAL**.
- 완료 범위: 기록된 공개5문서10변환의4개 차이; common배치조회·영어단위·Lock·표셀메모 소유; 보존검사 유지
- 다음 작업: 107패치 합본에서 표준 날짜·정확 OLE summary 정보까지 보존 읽기/양형식 왕복·손상 거절 추가. 명시 textDir HWP5 매핑과 최초 조판 차이는 별도 잔여이며 손실 변환 차단 유지.117참조; 한글 직접 비교 보류.
- 상위 항목: [B077](<10-headers-notes-fields.md#b077>) 필드
- 근거: [100-storage-conversion-and-overlap.md](<../100-storage-conversion-and-overlap.md>) · [summary.json](<../evidence/format-conversion-2026-10-15/summary.json>) · [109-file-preservation-hancom-followup.md](<../109-file-preservation-hancom-followup.md>) · [README.md](<../evidence/file-completion-2026-10-18/engine82/README.md>) · [README.md](<../evidence/file-completion-2026-10-18/engine83/README.md>) · [111-file-storage-final-review.md](<../111-file-storage-final-review.md>) · [README.md](<../evidence/file-completion-2026-10-18/engine86/README.md>) · [112-file-recovery-implementation.md](<../112-file-recovery-implementation.md>) · [113-file-format-preservation.md](<../113-file-format-preservation.md>) · [README.md](<../evidence/file-completion-2026-10-18/package91/README.md>) · [114-native-row-storage.md](<../114-native-row-storage.md>) · [README.md](<../evidence/file-completion-2026-10-18/native-rows92/README.md>) · [115-column-width-storage.md](<../115-column-width-storage.md>) · [README.md](<../evidence/file-completion-2026-10-18/columns93/README.md>) · [116-reflowed-native-storage.md](<../116-reflowed-native-storage.md>) · [README.md](<../evidence/file-completion-2026-10-18/reflow94/README.md>) · [117-file-storage-closure.md](<../117-file-storage-closure.md>)
- 원래 기록: `EXPLICIT_SCOPED_FIX;INDEPENDENT_HANCOM_GEOMETRY_FAILURES_FOUND_2026_10_17;FORMAL82_STRICT_ROUNDTRIP_PASS_NATIVE_INTEROP_FOLLOWUP_OPEN;FORMAL83_NOTE_SUMMARY_NATIVE_ROUNDTRIP_INITIAL_PARITY_OPEN;FORMAL86_SAFE_STORAGE_UNSUPPORTED_DIRECTIONS_BLOCKED_NATIVE_GUI_PENDING;COMPUTED_PREFIX94_AUTOMATED_CLOSURE_PASS_NATIVE_PARITY_OPEN;FILE_STORAGE96_COMBINED324_UNIT1008_WINDOWS10_PASS_2026_10_18`

</details>

<details id="g092">
<summary>G092 · HWP 글상자 알려진 세로 정렬과 raw list 비트 동기화</summary>

- 종류: 실행 작업 · 우선순위: P0.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **DONE**.
- 완료 범위: 알려진 Top/Center/Bottom만 동기화; 예약 raw3/기타 비트 보존·관측 known=false·명시 setter·미표현 HWPX 변환 거절
- 다음 작업: 알려진 세 정렬의 두 형식 저장 검수 마감. 새 HWP 글상자 플래그 손상과 HWPX NONE 그림자 누락 수정. 실제 한글 HWP 세 사본 의미·배치0, 공식63 생성 원본과 SHA 동일. 예약 비트/미표현 정렬 보호 유지.
- 상위 항목: [N002](<05-files-storage-recovery.md#n002>) 공개 형식 변환의 필드 보존 차이 4건
- 근거: [103-textbox-state-and-storage.md](<../103-textbox-state-and-storage.md>) · [verification-summary.json](<../evidence/parallel-editor-2026-10-15/verification-summary.json>) · [109-file-preservation-hancom-followup.md](<../109-file-preservation-hancom-followup.md>) · [manifest.json](<../evidence/file-completion-2026-10-17/textbox42-heading43/manifest.json>) · [manifest.json](<../evidence/file-completion-2026-10-17/engine63/manifest.json>)
- 원래 기록: `SCOPED_DONE;NEW_TEXTBOX_STORAGE_FIXED;ACTUAL_HANCOM_AND_FORMAL63_PASS_2026_10_17`

</details>

<details id="g093">
<summary>G093 · 실제 저장 파일 readback 후 성공 확인</summary>

- 종류: 실행 작업 · 우선순위: P0.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 파일 연결의 close 뒤 실제 commit 바이트를 읽어 SHA-256 일치 전에는 saved/clean 또는 기준 지문 갱신을 하지 않는다. open/write/close 전후/abort 실패·불일치·IO·동시성 수명을 검증한다.
- 다음 작업: Windows 실제 picker/ACL·공유 잠금·디스크 장애 검수는 별도. 다운로드 방식은 사용자 확인 유지.
- 상위 항목: [B010](<05-files-storage-recovery.md#b010>) 저장
- UI 명령: `file:save`
- 근거: [105-file-storage-preservation.md](<../105-file-storage-preservation.md>) · [verification-summary.json](<../evidence/state-storage-2026-10-16/verification-summary.json>)
- 원래 기록: `SCOPED_IMPLEMENTED;ENGINE_BROWSER_VERIFIED_2026_10_16`

</details>

<details id="g094">
<summary>G094 · 다른 형식 저장 뒤 출력 형식 유지·취소·재저장</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: HWP/HWPX 네 SaveAs 조합, 기본 SaveAs 형식, 다음 Ctrl+S, 명시 재열기와 동일 handle 외부 형식 변경을 검증. 성공한 연결의 형식만 기록하고 취소·실패는 기존 연결/dirty/name 유지.
- 다음 작업: 실제 Windows 파일 선택·권한과 한글 형식 호환성 전체 비교는 별도.
- 상위 항목: [B011](<05-files-storage-recovery.md#b011>) 다른 이름 저장
- UI 명령: `file:save-as;file:save-as-hwp;file:save-as-hwpx`
- 근거: [105-file-storage-preservation.md](<../105-file-storage-preservation.md>) · [verification-summary.json](<../evidence/state-storage-2026-10-16/verification-summary.json>)
- 원래 기록: `SCOPED_IMPLEMENTED;ENGINE_BROWSER_VERIFIED_2026_10_16`

</details>

<details id="g096">
<summary>G096 · HWP 겹침 표 뒤 단일 본문 글줄의 저장 원점 보존</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **DONE**.
- 완료 범위: Native HWP5 한 쪽·한 단 인접 겹침 표의 고유한 단일 본문 줄: 원문/서식/전체 공개 기하·Unicode·위첨자·동일 번호 표 셀 소유 구분, undo/redo·안전 저장·UI 재열기를 검증한다.
- 다음 작업: 정식68 최신 편집·저장 출력과 실제 한글 2024 별도 재저장본의 전체 의미·0.2 기준 지면 일치, 양형식 엄격 재저장·재열기까지 완료. 옛 캐시 줄 경계와 복잡 배치 전체는 N001에서 추적한다.
- 상위 항목: [N001](<05-files-storage-recovery.md#n001>) HWP 겹침 표의 복잡 배치·불명확 원점 저장 보존
- UI 명령: `table:cell-props`
- 근거: [105-file-storage-preservation.md](<../105-file-storage-preservation.md>) · [verification-summary.json](<../evidence/state-storage-2026-10-16/verification-summary.json>) · [108-file-preservation-completion.md](<../108-file-preservation-completion.md>) · [verification-summary.json](<../evidence/file-preservation-2026-10-17/verification-summary.json>) · [actual11-formal68.json](<../evidence/file-completion-2026-10-17/hancom-current68/actual11-formal68.json>) · [SHA256-MANIFEST.json](<../evidence/file-completion-2026-10-17/hancom-current68/SHA256-MANIFEST.json>)
- 원래 기록: `SCOPED_IMPLEMENTED;CURRENT_EDIT_SAVE_AND_ACTUAL_HANCOM_VERIFIED_2026_10_17;OLD_CACHE_N001_PARTIAL`

</details>

<details id="g097">
<summary>G097 · 알려진 HWP 겹침 배치 손상의 원본 쓰기 차단</summary>

- 종류: 실행 작업 · 우선순위: P0.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 지원 HWP/HWPX 저장 전체에 쪽 수와 공개 control/text 응답의 필수 보존 검사. 알려진 좌표만0.2, 나머지 필드·순서·ID는 정확 비교. 읽기 실패·한도·source alias·공유 DTO 변경을 쓰기 전 거절하고 원본/복구본/Canvas 모드를 유지한다. 원시 미관측 레코드와 실제 한글 출력 동일성은 별도다.
- 다음 작업: 최종86 의미·공개전체지면·0.2·한도·alias 보호 유지. XML 잘못된namespace/폰트유형 추측·명시글방향 HWP손실을 쓰기전 차단. unit933/44군/화면133 통과; 실제OS/한글 최신검수와 구별.
- 상위 항목: [N001](<05-files-storage-recovery.md#n001>) HWP 겹침 표의 복잡 배치·불명확 원점 저장 보존
- UI 명령: `file:save`
- 근거: [105-file-storage-preservation.md](<../105-file-storage-preservation.md>) · [verification-summary.json](<../evidence/state-storage-2026-10-16/verification-summary.json>) · [108-file-preservation-completion.md](<../108-file-preservation-completion.md>) · [verification-summary.json](<../evidence/file-preservation-2026-10-17/verification-summary.json>) · [110-file-preservation-integration.md](<../110-file-preservation-integration.md>) · [README.md](<../evidence/file-completion-2026-10-18/engine80/README.md>) · [README.md](<../evidence/file-completion-2026-10-18/engine82/README.md>) · [README.md](<../evidence/file-completion-2026-10-18/engine83/README.md>) · [111-file-storage-final-review.md](<../111-file-storage-final-review.md>) · [README.md](<../evidence/file-completion-2026-10-18/engine86/README.md>) · [113-file-format-preservation.md](<../113-file-format-preservation.md>) · [README.md](<../evidence/file-completion-2026-10-18/package91/README.md>) · [114-native-row-storage.md](<../114-native-row-storage.md>) · [README.md](<../evidence/file-completion-2026-10-18/native-rows92/README.md>) · [115-column-width-storage.md](<../115-column-width-storage.md>) · [README.md](<../evidence/file-completion-2026-10-18/columns93/README.md>)
- 원래 기록: `SCOPED_IMPLEMENTED;ENGINE_BROWSER_VERIFIED_2026_10_16;MANDATORY_PUBLISHED_LAYOUT_PROOF_FORMAL80;FORMAL82_STRICT_ROUNDTRIP_PASS_NATIVE_INTEROP_FOLLOWUP_OPEN;FORMAL83_NOTE_SUMMARY_NATIVE_ROUNDTRIP_INITIAL_PARITY_OPEN;FORMAL86_SAFE_STORAGE_UNSUPPORTED_DIRECTIONS_BLOCKED_NATIVE_GUI_PENDING`

</details>

<details id="g101">
<summary>G101 · 복구본 내용·업무 지문 검증과 강제 종료 복원</summary>

- 종류: 실행 작업 · 우선순위: P0.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 새 IDB 복구본의 문서/workspace/이름/dirty/시각/문서 바이트를 SHA-256으로 묶고 복원 전에 검증한다. 손상·미지원 지문은 격리하며 원본 기록을 유지한다. 실제 별도 Edge 프로세스 강제 종료 후 HWP/HWPX 미저장 복원·UI 저장을 검증한다.
- 다음 작업: 지문 없는 과거 기록은 기존 구조 검사로 읽으며 다음 정상 쓰기에서 지문 추가. checksum은 서명/공격 방지가 아니며 Windows 전체/전원 장애·ACL·한글 비교는 별도.
- 상위 항목: [B010](<05-files-storage-recovery.md#b010>) 저장
- 근거: [106-recovery-integrity.md](<../106-recovery-integrity.md>) · [verification-summary.json](<../evidence/recovery-integrity-2026-10-16/verification-summary.json>)
- 원래 기록: `SCOPED_IMPLEMENTED;ACTUAL_EDGE_CRASH_RECOVERY_VERIFIED_2026_10_16`

</details>

<details id="g102">
<summary>G102 · Windows Rust 저장 기준·실제 바이트·잠금 보호</summary>

- 종류: 실행 작업 · 우선순위: P0.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 파일 읽기가 외부 수정/선점 파일을 새 기준으로 채택하지 않고, 교체 후 실제 바이트 검증 뒤에만 기준 갱신. 실제 Windows 읽기 전용·독점/교체 잠금·실제 엔진 두 형식 신규/교체·실패 복구 10개 및 Tauri 전체 컴파일 검사.
- 다음 작업: Windows picker GUI·전체 ACL·디스크/전원 장애는 별도. 외부 쓰기를 원자적 CAS로 직렬화하는 보장은 없음. 추가로 Native Blob 준비 중 abort 완료 뒤 IPC 쓰기가 진행되는 경합을 수정. 전송 전 쓰기0·전송 후 거짓 취소 거절 확인(112번).
- 상위 항목: [B010](<05-files-storage-recovery.md#b010>) 저장
- 근거: [108-file-preservation-completion.md](<../108-file-preservation-completion.md>) · [verification-summary.json](<../evidence/file-preservation-2026-10-17/verification-summary.json>)
- 원래 기록: `SCOPED_IMPLEMENTED;FINAL_ENGINE_BROWSER_VERIFIED_2026_10_17`

</details>

<details id="g103">
<summary>G103 · 다운로드 최종 승인·출력 형식·원본 연결 수명</summary>

- 종류: 실행 작업 · 우선순위: P0.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 최종 확인 취소/dispatch 오류에서는 이름·dirty·undo·원본 handle 유지. 다운로드 승인 후만 옛 원본 연결/형식 기억 해제하고 generation/이름에 출력 형식을 연결. HWP/HWPX 4조합 실제 다운로드·재저장·복구 바이트 재열기 검증.
- 다음 작업: 브라우저는 실제 디스크 commit을 보증하지 않으므로 사용자 저장 확인 유지. 전체 파일 대화상자와 한글 직접 비교는 상위 범위에서 별도.
- 상위 항목: [B011](<05-files-storage-recovery.md#b011>) 다른 이름 저장
- 근거: [108-file-preservation-completion.md](<../108-file-preservation-completion.md>) · [verification-summary.json](<../evidence/file-preservation-2026-10-17/verification-summary.json>)
- 원래 기록: `SCOPED_IMPLEMENTED;FINAL_ENGINE_BROWSER_VERIFIED_2026_10_17`

</details>

<details id="g104">
<summary>G104 · 복구본 폐기 실패 시 열린 문서 상태 보존</summary>

- 종류: 실행 작업 · 우선순위: P0.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: workspace 복구본 삭제를 폐기 commit으로 사용. 삭제 동기 오류/transaction abort에서 dirty·탭·undo·문서 바이트·기존 checkpoint·원본을 보존하고, 후속 편집·undo/redo·저장·재폐기로 회복. 실제 Edge 4개 검사.
- 다음 작업: 한글 전체 문서 닫기 메뉴/종료 수명과 OS 강제 종료는 별도 상위 검수.
- 상위 항목: [B021](<05-files-storage-recovery.md#b021>) 문서 닫기
- 근거: [108-file-preservation-completion.md](<../108-file-preservation-completion.md>) · [verification-summary.json](<../evidence/file-preservation-2026-10-17/verification-summary.json>)
- 원래 기록: `SCOPED_IMPLEMENTED;FINAL_ENGINE_BROWSER_VERIFIED_2026_10_17`

</details>

<details id="g105">
<summary>G105 · 겹침 표 후속 여러 줄 본문·캡션 원점 보존</summary>

- 종류: 실행 작업 · 우선순위: P0.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **DONE**.
- 완료 범위: 한쪽/한단·정확한 원시 호스트의 Native HWP5에서 직접 본문 줄의 index/vpos/Unicode·UTF16 시작/연속 원문 전체를 일대일 확인해 snapshot 줄 위치만 보정. 캡션 story 소유 분리, raw payload 차이·전체 배치·반복 저장·undo/재적용·실제 UI 저장/재열기 검증.
- 다음 작업: 정식68 최신 편집·저장 출력과 실제 한글 2024 별도 재저장본의 전체 의미·0.2 기준 지면 일치, 양형식 엄격 재저장·재열기까지 완료. 옛 캐시 줄 경계와 복잡 배치 전체는 N001에서 추적한다.
- 상위 항목: [N001](<05-files-storage-recovery.md#n001>) HWP 겹침 표의 복잡 배치·불명확 원점 저장 보존
- 근거: [108-file-preservation-completion.md](<../108-file-preservation-completion.md>) · [verification-summary.json](<../evidence/file-preservation-2026-10-17/verification-summary.json>) · [109-file-preservation-hancom-followup.md](<../109-file-preservation-hancom-followup.md>) · [baseline-failures.json](<../evidence/file-completion-2026-10-17/hancom/baseline-failures.json>) · [actual11-formal68.json](<../evidence/file-completion-2026-10-17/hancom-current68/actual11-formal68.json>) · [SHA256-MANIFEST.json](<../evidence/file-completion-2026-10-17/hancom-current68/SHA256-MANIFEST.json>)
- 원래 기록: `SCOPED_IMPLEMENTED;CURRENT_EDIT_SAVE_AND_ACTUAL_HANCOM_VERIFIED_2026_10_17;OLD_CACHE_N001_PARTIAL`

</details>

<details id="g106">
<summary>G106 · 후속 통째 표의 의미 흐름과 실제 양수 offset 보존</summary>

- 종류: 실행 작업 · 우선순위: P0.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **DONE**.
- 완료 범위: 실제 한글 재저장본에 따라 빈 표 host LINE_SEG의 양수 캐시를 사용자 간격으로 취급한 이전 기대를 정정. 확인한 Native 한 단 인접 통째 표의 현재 흐름을 사용하고 실제 문단 여백·명시 offset과 원시 바이트를 보존한다.
- 다음 작업: 확인한 한 단 양수 offset 원본과 실제 한글 사본: 정식73 의미·전체지면0 및 HWP/HWPX 엄격 재저장 통과. Native9쌍의72회 재열기와 실제 API 후속본문 history2 통과. 음수·두 단·불명확 원점은 N001에서 별도 추적.
- 상위 항목: [N001](<05-files-storage-recovery.md#n001>) HWP 겹침 표의 복잡 배치·불명확 원점 저장 보존
- 근거: [108-file-preservation-completion.md](<../108-file-preservation-completion.md>) · [verification-summary.json](<../evidence/file-preservation-2026-10-17/verification-summary.json>) · [109-file-preservation-hancom-followup.md](<../109-file-preservation-hancom-followup.md>) · [baseline-failures.json](<../evidence/file-completion-2026-10-17/hancom/baseline-failures.json>) · [actual11-formal68.json](<../evidence/file-completion-2026-10-17/hancom-current68/actual11-formal68.json>) · [110-file-preservation-integration.md](<../110-file-preservation-integration.md>) · [summary.json](<../evidence/file-completion-2026-10-18/engine73/summary.json>)
- 원래 기록: `SCOPED_POSITIVE_OFFSET_ACTUAL_HANCOM_AND_BOTH_FORMAT_RESAVE_PASS_2026_10_18`

</details>

<details id="g107">
<summary>G107 · 네이티브 파일 선택·저장·복구 후 실제 창 종료</summary>

- 종류: 실행 작업 · 우선순위: P0.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: Windows main과 iframe의 process-local 파일 adapter 공유·중복 picker 거절·OS 모달 owner 연결. 최신 복구본 commit/readback·버전 확인 후 실제 destroy; 실패/취소 시 편집 유지. 실제 앱 HWP/HWPX 열기·CtrlS·종료 취소·승인 후 창 소멸·재실행 HWPX 복구·새 파일 저장을 확인했다.
- 다음 작업: 이 행은 네이티브 OS 파일·종료 계약의 제한된 검수다. 전체 파일 메뉴·XML UI·모든 ACL/전원 장애 및 전체 한글 동일성을 포함하지 않는다.
- 상위 항목: [B022](<05-files-storage-recovery.md#b022>) 프로그램 종료
- 근거: [109-file-preservation-hancom-followup.md](<../109-file-preservation-hancom-followup.md>) · [actual-validation.json](<../evidence/file-completion-2026-10-17/native/actual-picker/actual-validation.json>) · [native-picker-result.json](<../evidence/file-completion-2026-10-17/native/native-picker-result.json>)
- 원래 기록: `SCOPED_IMPLEMENTED;REAL_WINDOWS_GUI_SAVE_EXIT_RESTART_VERIFIED_2026_10_17`

</details>

## 함께 보는 기능

- [상태 저장·환경·선택 복원](<13-state-and-preferences.md>)
- [표·셀·크기·계산](<08-tables.md>)
- [모듈·실행 기반·배포·최종 검수](<16-architecture-and-validation.md>)

이 파일은 자동 생성한다. 상태는 [CSV](<../jueony-work-checklist.csv>)에서, 기능 배치는 [분류 원본](<../checklist-features.json>)에서 수정한다.
