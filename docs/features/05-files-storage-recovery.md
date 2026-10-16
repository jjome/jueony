# 파일·저장·복구·형식 보존

[← 종합 진행 현황](<../jueony-progress.md>) · [전체 검색](<../jueony-work-checklist.html>) · [완료 규칙](<../97-master-work-checklist.md>)

열기·저장·재열기, 버전 충돌과 원복, HWP/HWPX 직렬화 결함과 보존.

## 진행 요약

실행 작업 **13개**, 상위 범위 **10개**. CSV의 기록을 기능별로 표시한 문서다.

| 구분 | 실행 작업 | 상위 범위 |
| --- | --- | --- |
| 구현 | 완료 12/13 · 부분 1 | 완료 0/10 · 부분 9 · 미구현 1 |
| 검증 | 완료 6/13 · 부분 7 | 완료 0/10 · 부분 1 · 미검증 9 |
| Agent 연결 | 연결 6/6 · 부분 0 · 해당 없음 7 | 연결 0/10 · 부분 1 · 미연결 9 |

☑ 완료/연결 · ◐ 부분 · ☐ 대기 · ? 재점검 · — 해당 없음. 검증 완료에는 필요한 한글 직접 비교도 포함한다. 구현 완료만으로 세 축 완료가 되지 않는다.

상위 범위는 세 축 완료 **0/10개**다. 세부 작업 완료 수와 분리해서 읽는다.

**현재 통합 중:** HWP 후속 본문 표 저장 보정과 관련 실제 브라우저 검사를 통합 중이다. 현재 CSV 완료 상태에는 추가 반영하지 않았다.

## 먼저 할 일

- **구현** [N001](<05-files-storage-recovery.md#n001>) **HWP 겹침 허용 후속 표의 화면/재열기 위치** — 남은 뒤 가시본문/양수 저장gap 원본 의미와 렌더/저장 관계 수정; 직접 브라우저·한글 비교
- **검증** [N002](<05-files-storage-recovery.md#n002>) **공개 형식 변환의 필드 보존 차이 4건** — 한글 직접 재열기·지면 검수; 더 넓은 원본/특수 story 지원은 별도
- **검증** [G090](<05-files-storage-recovery.md#g090>) **HWP 단순 겹침 표 tail의 저장 snapshot 원점 기록** — 지원된 좁은 원본의 직접 브라우저·한글 검증; N001 전체는부분유지

## 기능별 작업표

관련된 상위 기능과 실행 작업을 함께 묶었다. 각 표는 최대 8개 항목이며, 완료된 항목도 같은 표에 유지한다. ID를 누르면 아래의 완료조건·근거로 이동한다. **범위** 행은 상위 점검, **작업** 행은 실행 작업으로 중복 집계하지 않는다.

- [파일 · 상위 기능 점검 (1)](<#work-1>)
- [파일 · 상위 기능 점검 (2)](<#work-2>)
- [저장·호환성 · 독립 실행 작업 (1)](<#work-3>)
- [저장·호환성 · 독립 실행 작업 (2)](<#work-4>)
- [HWP 겹침 허용 후속 표의 화면/재열기 위치](<#work-5>)
- [공개 형식 변환의 필드 보존 차이 4건](<#work-6>)

<a id="work-1"></a>

### 파일 · 상위 기능 점검 (1)

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B001](<05-files-storage-recovery.md#b001>) · 범위 | 새 문서 | ◐ 부분 | ☐ 미검증 | ◐ 부분 |
| [B002](<05-files-storage-recovery.md#b002>) · 범위 | 새 탭 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |
| [B005](<05-files-storage-recovery.md#b005>) · 범위 | 불러오기 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |
| [B006](<05-files-storage-recovery.md#b006>) · 범위 | 최근 문서 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |
| [B009](<05-files-storage-recovery.md#b009>) · 범위 | XML 탭·서식·문서 입출력 | ☐ 미구현 | ☐ 미검증 | ☐ 미연결 |
| [B010](<05-files-storage-recovery.md#b010>) · 범위 | 저장 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |
| [B011](<05-files-storage-recovery.md#b011>) · 범위 | 다른 이름 저장 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |
| [B014](<05-files-storage-recovery.md#b014>) · 범위 | 문서 정보 | ◐ 부분 | ◐ 부분 | ☐ 미연결 |

<a id="work-2"></a>

### 파일 · 상위 기능 점검 (2)

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [B021](<05-files-storage-recovery.md#b021>) · 범위 | 문서 닫기 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |
| [B022](<05-files-storage-recovery.md#b022>) · 범위 | 프로그램 종료 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |

<a id="work-3"></a>

### 저장·호환성 · 독립 실행 작업 (1)

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [G065](<05-files-storage-recovery.md#g065>) · 작업 | 문서 사본에서 적용→저장→재열기 사전 검사 | ☑ 완료 | ☑ 완료 | ☑ 연결 |
| [G066](<05-files-storage-recovery.md#g066>) · 작업 | 오래된 문서 버전 결과의 덮어쓰기 거절 | ☑ 완료 | ☑ 완료 | ☑ 연결 |
| [G067](<05-files-storage-recovery.md#g067>) · 작업 | 부분 Native 변경·재렌더 실패의 요청 원복 | ☑ 완료 | ☑ 완료 | ☑ 연결 |
| [G068](<05-files-storage-recovery.md#g068>) · 작업 | 복구 렌더와 새 변경 검증의 분리 | ☑ 완료 | ☑ 완료 | ☑ 연결 |
| [G069](<05-files-storage-recovery.md#g069>) · 작업 | HWPX 기본 탭 저장 값 보정 | ☑ 완료 | ◐ 부분 | ☑ 연결 |
| [G070](<05-files-storage-recovery.md#g070>) · 작업 | 숨김 끝 문단의 실제 페이지 소유 | ☑ 완료 | ☑ 완료 | ☑ 연결 |
| [G071](<05-files-storage-recovery.md#g071>) · 작업 | 겹침 금지 HWP 후속 표의 저장 앵커 소유 | ☑ 완료 | ◐ 부분 | — 해당 없음 |
| [G072](<05-files-storage-recovery.md#g072>) · 작업 | HWP 메모 carrier의 본문 소유 분리 | ☑ 완료 | ☑ 완료 | — 해당 없음 |

<a id="work-4"></a>

### 저장·호환성 · 독립 실행 작업 (2)

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [G073](<05-files-storage-recovery.md#g073>) · 작업 | 표 바깥 여백의 HWP/HWPX 모델·저장 일치 | ☑ 완료 | ◐ 부분 | — 해당 없음 |

<a id="work-5"></a>

### HWP 겹침 허용 후속 표의 화면/재열기 위치

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [G090](<05-files-storage-recovery.md#g090>) · 작업 | HWP 단순 겹침 표 tail의 저장 snapshot 원점 기록 | ☑ 완료 | ◐ 부분 | — 해당 없음 |
| [N001](<05-files-storage-recovery.md#n001>) · 작업 | HWP 겹침 허용 후속 표의 화면/재열기 위치 | ◐ 부분 | ◐ 부분 | — 해당 없음 |

<a id="work-6"></a>

### 공개 형식 변환의 필드 보존 차이 4건

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [N002](<05-files-storage-recovery.md#n002>) · 작업 | 공개 형식 변환의 필드 보존 차이 4건 | ☑ 완료 | ◐ 부분 | — 해당 없음 |
| [G092](<05-files-storage-recovery.md#g092>) · 작업 | HWP 글상자 알려진 세로 정렬과 raw list 비트 동기화 | ☑ 완료 | ◐ 부분 | — 해당 없음 |

## 항목별 완료조건·근거

각 항목은 펼쳐서 읽는다. 상태와 근거는 CSV에서 관리한다.

<details id="b001">
<summary>B001 · 새 문서</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ◐ 부분.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 새 창과 새 탭 구분 관찰 필요
- UI 명령: `file:new-doc`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `PARTIAL;NOT_RUN`

</details>

<details id="b002">
<summary>B002 · 새 탭</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: shell 문서 탭으로 위임
- UI 명령: `file:new-doc`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `WIRED;NOT_RUN`

</details>

<details id="b005">
<summary>B005 · 불러오기</summary>

- 종류: 한글 상위 기능 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: HWP/HWPX 대상
- UI 명령: `file:open`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `WIRED;NOT_RUN`

</details>

<details id="b006">
<summary>B006 · 최근 문서</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 최근 문서/원본 파일 재연결은 구현됨. 브라우저 handle 권한 및 네이티브 경로 복원 대조.
- UI 명령: `file:open-recent`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `PARTIAL;NOT_RUN`

</details>

<details id="b009">
<summary>B009 · XML 탭·서식·문서 입출력</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ☐ 미구현 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 일반 XML 서식/스키마 UI 없음. HML 엔진·저장 경로는 존재하며 shell 열기 연결과 구분.
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `MISSING;NOT_RUN`

</details>

<details id="b010">
<summary>B010 · 저장</summary>

- 종류: 한글 상위 기능 · 우선순위: P0.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 형식·원본 저장 실패 검수는 상태 트랙
- UI 명령: `file:save`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `WIRED;NOT_RUN`

</details>

<details id="b011">
<summary>B011 · 다른 이름 저장</summary>

- 종류: 한글 상위 기능 · 우선순위: P0.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 취소·이름·형식 전환 검사 필요
- UI 명령: `file:save-as`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `WIRED;NOT_RUN`

</details>

<details id="b014">
<summary>B014 · 문서 정보</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ☐ 미연결.
- 검증 구분: 자동 **PARTIAL** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 미저장 내용의 읽기 전용 통계 구현. 개인 정보·이력 편집과 한글 통계 동등성은 남음.
- UI 명령: `file:document-info`
- 근거: [parity-result.json](<../evidence/features-2026-10-11/parity-result.json>) · [editor-tests.txt](<../evidence/features-2026-10-11/editor-tests.txt>)
- 원래 기록: `PARTIAL;BROWSER_TESTED_NATIVE_PENDING`

</details>

<details id="b021">
<summary>B021 · 문서 닫기</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: dirty·취소·마지막 탭은 상태 검수
- UI 명령: `ext:jueony-close`
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `WIRED;NOT_RUN`

</details>

<details id="b022">
<summary>B022 · 프로그램 종료</summary>

- 종류: 한글 상위 기능 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NOT_RUN**.
- 완료 범위: 한글 2024 전체 해당 기능·문맥·대화상자·저장 수명을 포함한 상위 항목. WIRED는 완료가 아님.
- 다음 작업: 파일 메뉴/종료 키 매핑 없음. 호스트 창 닫기와 dirty 보호는 구현됨.
- 근거: [editor-code-audit.md](<../evidence/hangul-comparison-2026-10-11/editor-code-audit.md>) · [engine-code-audit.md](<../evidence/hangul-comparison-2026-10-11/engine-code-audit.md>)
- 원래 기록: `PARTIAL;NOT_RUN`

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
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 기록된 기본 탭/구역 합치기 한글 비교 표본
- 다음 작업: 정의한 범위 회귀 유지; 한글 비교 대기
- 근거: [36-native-section-comparison.md](<../36-native-section-comparison.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

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
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 실제 앞 표 occupied flow 증거에 한정; 겹침 허용 제외
- 다음 작업: 정의한 범위 회귀 유지; 한글 비교 대기
- 근거: [93-storage-table-and-memo-ownership.md](<../93-storage-table-and-memo-ownership.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

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
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 네 방향 semantic/common/raw cache·취소·undo·재열기
- 다음 작업: 정의한 범위 회귀 유지; 한글 비교 대기
- 근거: [94-table-width-and-outer-margins.md](<../94-table-width-and-outer-margins.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g090">
<summary>G090 · HWP 단순 겹침 표 tail의 저장 snapshot 원점 기록</summary>

- 종류: 실행 작업 · 우선순위: P0.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 한 쪽·한 단·통째 object-only 표 tail 및 고유 단일 줄 빈 후속 본문; live불변/snapshot/반복저장/배치보존
- 다음 작업: 지원된 좁은 원본의 직접 브라우저·한글 검증; N001 전체는부분유지
- 상위 항목: [N001](<05-files-storage-recovery.md#n001>) HWP 겹침 허용 후속 표의 화면/재열기 위치
- 근거: [100-storage-conversion-and-overlap.md](<../100-storage-conversion-and-overlap.md>) · [verification-summary.json](<../evidence/overlap-table-tail-2026-10-15/verification-summary.json>)
- 원래 기록: `SCOPED_STORAGE_TAIL_WRITEBACK`

</details>

<details id="n001">
<summary>N001 · HWP 겹침 허용 후속 표의 화면/재열기 위치</summary>

- 종류: 실행 작업 · 우선순위: P0.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PARTIAL** / 한글 **NOT_RUN**.
- 완료 범위: 한 쪽·한 단의 편집된HWP 통째 표 tail/고유 단일 줄 빈 후속 본문만 수정; 뒤 가시본문·양수 저장gap 불일치2개 유지
- 다음 작업: 남은 뒤 가시본문/양수 저장gap 원본 의미와 렌더/저장 관계 수정; 직접 브라우저·한글 비교
- 상위 항목: [B153](<08-tables.md#b153>) 셀 속성
- 근거: [100-storage-conversion-and-overlap.md](<../100-storage-conversion-and-overlap.md>) · [verification-summary.json](<../evidence/overlap-table-tail-2026-10-15/verification-summary.json>)
- 원래 기록: `EXPLICIT_REMAINING_OR_AUDIT`

</details>

<details id="n002">
<summary>N002 · 공개 형식 변환의 필드 보존 차이 4건</summary>

- 종류: 실행 작업 · 우선순위: P0.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 기록된 공개5문서10변환의4개 차이; common배치조회·영어단위·Lock·표셀메모 소유; 보존검사 유지
- 다음 작업: 한글 직접 재열기·지면 검수; 더 넓은 원본/특수 story 지원은 별도
- 상위 항목: [B077](<10-headers-notes-fields.md#b077>) 필드
- 근거: [100-storage-conversion-and-overlap.md](<../100-storage-conversion-and-overlap.md>) · [summary.json](<../evidence/format-conversion-2026-10-15/summary.json>)
- 원래 기록: `EXPLICIT_REMAINING_OR_AUDIT`

</details>

<details id="g092">
<summary>G092 · HWP 글상자 알려진 세로 정렬과 raw list 비트 동기화</summary>

- 종류: 실행 작업 · 우선순위: P0.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 알려진 Top/Center/Bottom만 동기화; 예약 raw3/기타 비트 보존·관측 known=false·명시 setter·미표현 HWPX 변환 거절
- 다음 작업: 자체 예제로 최종 한글 2024 비교; 복합 원본은 별도 작업.
- 상위 항목: [N002](<05-files-storage-recovery.md#n002>) 공개 형식 변환의 필드 보존 차이 4건
- 근거: [103-textbox-state-and-storage.md](<../103-textbox-state-and-storage.md>) · [verification-summary.json](<../evidence/parallel-editor-2026-10-15/verification-summary.json>)
- 원래 기록: `SCOPED_PARALLEL_EDITOR_STATE_STORAGE`

</details>

## 함께 보는 기능

- [상태 저장·환경·선택 복원](<13-state-and-preferences.md>)
- [표·셀·크기·계산](<08-tables.md>)
- [모듈·실행 기반·배포·최종 검수](<16-architecture-and-validation.md>)

이 파일은 자동 생성한다. 상태는 [CSV](<../jueony-work-checklist.csv>)에서, 기능 배치는 [분류 원본](<../checklist-features.json>)에서 수정한다.
