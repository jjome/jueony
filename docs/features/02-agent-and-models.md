# AI 연결·Agent 실행

[← 종합 진행 현황](<../jueony-progress.md>) · [전체 검색](<../jueony-work-checklist.html>) · [완료 규칙](<../97-master-work-checklist.md>)

제공자·모델·인증, 현재 문서 문맥, 진행·취소, 변경 확인과 Agent loop.

## 진행 요약

실행 작업 **21개**, 상위 범위 **0개**. CSV의 기록을 기능별로 표시한 문서다.

| 구분 | 실행 작업 | 상위 범위 |
| :--- | :---: | :---: |
| 구현 | 완료 15/21 · 부분 5 · 미구현 1 | — 상위 범위 없음 |
| 검증 | 완료 9/21 · 부분 9 · 미검증 3 | — 상위 범위 없음 |
| Agent 연결 | 연결 16/20 · 부분 3 · 미연결 1 · 해당 없음 1 | — 상위 범위 없음 |

☑ 완료/연결 · ◐ 부분 · ☐ 대기 · ? 재점검 · — 해당 없음. 검증 완료에는 필요한 한글 직접 비교도 포함한다. 구현 완료만으로 세 축 완료가 되지 않는다.

## 먼저 할 일

- **구현** [N024](<02-agent-and-models.md#n024>) **브라우저 인증 링크 기반 계정 연결** — 승인된 Google 데스크톱 앱 설정에서 Gemini 브라우저 인증을 제공한다. 모의 OAuth의 취소·만료·갱신·철회와 조회 도구 연결을 확인했다. 실제 등록 프로젝트에서 인증·호출하고 타 공급자 지원을 확인해야 한다.
- **구현** [N028](<02-agent-and-models.md#n028>) **기관 HyperCLOVA endpoint·권한·망 검증** — 허용 모델 주소와 경로를 실행기에서 검사한다. 합성 서비스 앱에서 HCX-005·HCX-007의 문단 조회를 검증했다. 실제 기관망의 승인된 서비스 주소와 접근 권한이 필요하다.
- **구현** [N029](<02-agent-and-models.md#n029>) **변경 비교 화면을 문서 구조 중심으로 개선** — 참고자료를 읽은 표·쪽 편집을 사본에서 실행하고 저장 재열기 뒤 승인 화면에 실제 행·열 수와 용지·여백의 전후 값을 표시한다. 중첩 표 셀의 전후 값과 긴 본문의 변경 부분 및 합친 구역의 표 위치와 기본 탭을 표시한다. HWP·HWPX에서 로컬 Qwen이 바꾼 쪽 배경 색·각도와 쪽 테두리의 포함·제외 값을 확인했다. 저장 바탕쪽은 문구·위치·기본 서식의 전후 값을 표시하며 실제 Qwen의 문구 변경을 두 형식에서 대조했다. 복합 개체와 독립 한글 비교가 남았다.

## 기능별 작업표

관련된 상위 기능과 실행 작업을 함께 묶었다. 각 표는 최대 8개 항목이며, 완료된 항목도 같은 표에 유지한다. ID를 누르면 아래의 완료조건·근거로 이동한다. **범위** 행은 상위 점검, **작업** 행은 실행 작업으로 중복 집계하지 않는다.

- [모델·Agent · 독립 실행 작업 (1)](<#work-1>)
- [모델·Agent · 독립 실행 작업 (2)](<#work-2>)
- [모델·Agent · 독립 실행 작업 (3)](<#work-3>)
- [검색·반복 · 독립 실행 작업](<#work-4>)

<a id="work-1"></a>

### 모델·Agent · 독립 실행 작업 (1)

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [G074](<02-agent-and-models.md#g074>) · 작업 | GPT Responses adapter와 연결 설정 | ☑ 완료 | ☑ 완료 | ☑ 연결 |
| [G075](<02-agent-and-models.md#g075>) · 작업 | Claude Messages adapter와 연결 설정 | ☑ 완료 | ☑ 완료 | ☑ 연결 |
| [G076](<02-agent-and-models.md#g076>) · 작업 | Gemini GenerateContent adapter와 연결 설정 | ☑ 완료 | ☑ 완료 | ☑ 연결 |
| [G077](<02-agent-and-models.md#g077>) · 작업 | HyperCLOVA v3 adapter와 연결 설정 | ☑ 완료 | ☑ 완료 | ☑ 연결 |
| [G078](<02-agent-and-models.md#g078>) · 작업 | 모델·제공자 선택을 실제 요청에 반영 | ☑ 완료 | ☑ 완료 | ☑ 연결 |
| [G079](<02-agent-and-models.md#g079>) · 작업 | DPAPI 키 보관·교체·삭제·재시작 복원 | ☑ 완료 | ☑ 완료 | — 해당 없음 |
| [G080](<02-agent-and-models.md#g080>) · 작업 | 현재 미저장 문서 snapshot으로 문맥 구성 | ☑ 완료 | ◐ 부분 | ☑ 연결 |
| [G081](<02-agent-and-models.md#g081>) · 작업 | 진행·오류·취소와 실행 기록 | ☑ 완료 | ☑ 완료 | ☑ 연결 |

<a id="work-2"></a>

### 모델·Agent · 독립 실행 작업 (2)

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [G082](<02-agent-and-models.md#g082>) · 작업 | 요청 변경 확인·undo/redo | ☑ 완료 | ◐ 부분 | ☑ 연결 |
| [G083](<02-agent-and-models.md#g083>) · 작업 | 읽기·편집 facade와 제공자 Port 분리 | ☑ 완료 | ☑ 완료 | ☑ 연결 |
| [N024](<02-agent-and-models.md#n024>) · 작업 | 브라우저 인증 링크 기반 계정 연결 | ◐ 부분 | ◐ 부분 | ◐ 부분 |
| [N025](<02-agent-and-models.md#n025>) · 작업 | GPT 실제 계정·모델 호출 검증 | ☑ 완료 | ☐ 미검증 | ☑ 연결 |
| [N026](<02-agent-and-models.md#n026>) · 작업 | Claude 실제 계정 회귀와 오류 검증 | ☑ 완료 | ◐ 부분 | ☑ 연결 |
| [N027](<02-agent-and-models.md#n027>) · 작업 | Gemini 실제 계정·모델 호출 검증 | ☑ 완료 | ☐ 미검증 | ☑ 연결 |
| [N028](<02-agent-and-models.md#n028>) · 작업 | 기관 HyperCLOVA endpoint·권한·망 검증 | ☐ 미구현 | ☐ 미검증 | ☐ 미연결 |
| [N029](<02-agent-and-models.md#n029>) · 작업 | 변경 비교 화면을 문서 구조 중심으로 개선 | ◐ 부분 | ◐ 부분 | ◐ 부분 |

<a id="work-3"></a>

### 모델·Agent · 독립 실행 작업 (3)

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [N030](<02-agent-and-models.md#n030>) · 작업 | 전체 문서 장문 context 예산·선택 확장 | ◐ 부분 | ◐ 부분 | ☑ 연결 |
| [N031](<02-agent-and-models.md#n031>) · 작업 | 관찰→도구 실행→결과 확인 Agent loop | ◐ 부분 | ◐ 부분 | ☑ 연결 |
| [N032](<02-agent-and-models.md#n032>) · 작업 | tool 결과 기반 재계획·복구·중단 정책 | ◐ 부분 | ◐ 부분 | ☑ 연결 |
| [G131](<02-agent-and-models.md#g131>) · 작업 | 모델 도구 지원 확인과 허용 주소 제어 | ☑ 완료 | ◐ 부분 | ◐ 부분 |

<a id="work-4"></a>

### 검색·반복 · 독립 실행 작업

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [G086](<02-agent-and-models.md#g086>) · 작업 | 2~3회 후보 검토 후 한 번 적용 | ☑ 완료 | ☑ 완료 | ☑ 연결 |

## 항목별 완료조건·근거

각 항목은 펼쳐서 읽는다. 상태와 근거는 CSV에서 관리한다.

<details id="g074">
<summary>G074 · GPT Responses adapter와 연결 설정</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 공통 Port·모델/endpoint/키 선택·합성 프로토콜 검증
- 다음 작업: 기록된 범위 유지·관련 변경 시 회귀 검사
- 근거: [20-native-providers-and-editing.md](<../20-native-providers-and-editing.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g075">
<summary>G075 · Claude Messages adapter와 연결 설정</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 공통 Port·합성 검증; 계정 실호출은 별도
- 다음 작업: 기록된 범위 유지·관련 변경 시 회귀 검사
- 근거: [20-native-providers-and-editing.md](<../20-native-providers-and-editing.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g076">
<summary>G076 · Gemini GenerateContent adapter와 연결 설정</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 공통 Port·모델/endpoint/키 선택·합성 검증
- 다음 작업: 기록된 범위 유지·관련 변경 시 회귀 검사
- 근거: [20-native-providers-and-editing.md](<../20-native-providers-and-editing.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g077">
<summary>G077 · HyperCLOVA v3 adapter와 연결 설정</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 기록된 HCX-005 합성 실호출; 기관 endpoint 별도
- 다음 작업: 기록된 범위 유지·관련 변경 시 회귀 검사
- 근거: [23-autonomous-work-result.md](<../23-autonomous-work-result.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g078">
<summary>G078 · 모델·제공자 선택을 실제 요청에 반영</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 네 합성 제공자 채팅에 등록 모델 ID 전달
- 다음 작업: 기록된 범위 유지·관련 변경 시 회귀 검사
- 근거: [96-agent-table-merge.md](<../96-agent-table-merge.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g079">
<summary>G079 · DPAPI 키 보관·교체·삭제·재시작 복원</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 평문 fallback 없음; 현재 Windows 계정
- 다음 작업: 기록된 범위 유지·관련 변경 시 회귀 검사
- 근거: [23-autonomous-work-result.md](<../23-autonomous-work-result.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g080">
<summary>G080 · 현재 미저장 문서 snapshot으로 문맥 구성</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PARTIAL** / 한글 **NA**.
- 완료 범위: 디스크 별도 수정 없이 열린 엔진 소유
- 다음 작업: 기록된 범위 유지·관련 변경 시 회귀 검사
- 근거: [12-mvp-implementation.md](<../12-mvp-implementation.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g081">
<summary>G081 · 진행·오류·취소와 실행 기록</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 응답만 성공으로 표시하지 않는 요청 수명
- 다음 작업: 기록된 범위 유지·관련 변경 시 회귀 검사
- 근거: [19-agent-interaction-fix.md](<../19-agent-interaction-fix.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g082">
<summary>G082 · 요청 변경 확인·undo/redo</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 지원 명령 receipt·이력·저장; 모든 동시 변경/영구 이력 제외
- 다음 작업: 정의한 범위 회귀 유지; 한글 비교 대기
- 근거: [96-agent-table-merge.md](<../96-agent-table-merge.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g083">
<summary>G083 · 읽기·편집 facade와 제공자 Port 분리</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 9개 모듈 공개 경계; 전체 lifecycle 이관 제외
- 다음 작업: 기록된 범위 유지·관련 변경 시 회귀 검사
- 근거: [32-modular-refactor-result.md](<../32-modular-refactor-result.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g086">
<summary>G086 · 2~3회 후보 검토 후 한 번 적용</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: bounded review 흐름; 자율 tool 실행 loop 제외
- 다음 작업: 기록된 범위 유지·관련 변경 시 회귀 검사
- 근거: [28-continuation-implementation.md](<../28-continuation-implementation.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="n024">
<summary>N024 · 브라우저 인증 링크 기반 계정 연결</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ◐ 부분.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 제공자가 허용한 OAuth/CLI 흐름·취소·토큰 암호화·만료/철회
- 다음 작업: 승인된 Google 데스크톱 앱 설정에서 Gemini 브라우저 인증을 제공한다. 모의 OAuth의 취소·만료·갱신·철회와 조회 도구 연결을 확인했다. 실제 등록 프로젝트에서 인증·호출하고 타 공급자 지원을 확인해야 한다.
- 근거: [24-next-development-plan.md](<../24-next-development-plan.md>) · [147-checklist-completion.md](<../147-checklist-completion.md>) · [gemini-oauth.test.mjs](<../../apps/launcher/tests/gemini-oauth.test.mjs>)
- 원래 기록: `EXPLICIT_REMAINING_OR_AUDIT`

</details>

<details id="n025">
<summary>N025 · GPT 실제 계정·모델 호출 검증</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ☐ 미검증 / Agent ☑ 연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NA**.
- 완료 범위: 등록된 실제 키·모델로 최소 합성 요청; protocol fixture와 분리
- 다음 작업: 실제 계정/모델 검증만 추가. adapter 구현·연결은 완료; 합성 프로토콜과 실호출은 구분.
- 근거: [20-native-providers-and-editing.md](<../20-native-providers-and-editing.md>)
- 원래 기록: `EXPLICIT_REMAINING_OR_AUDIT`

</details>

<details id="n026">
<summary>N026 · Claude 실제 계정 회귀와 오류 검증</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NA**.
- 완료 범위: 사용자 성공 보고와 자동 증거 구분; 키·모델/구조화·빈 명령
- 다음 작업: 실제 계정/모델 검증만 추가. adapter 구현·연결은 완료; 합성 프로토콜과 실호출은 구분.
- 근거: [20-native-providers-and-editing.md](<../20-native-providers-and-editing.md>)
- 원래 기록: `EXPLICIT_REMAINING_OR_AUDIT`

</details>

<details id="n027">
<summary>N027 · Gemini 실제 계정·모델 호출 검증</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ☐ 미검증 / Agent ☑ 연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NA**.
- 완료 범위: 등록된 실제 키·모델로 최소 합성 요청·안전한 오류
- 다음 작업: 실제 계정/모델 검증만 추가. adapter 구현·연결은 완료; 합성 프로토콜과 실호출은 구분.
- 근거: [20-native-providers-and-editing.md](<../20-native-providers-and-editing.md>)
- 원래 기록: `EXPLICIT_REMAINING_OR_AUDIT`

</details>

<details id="n028">
<summary>N028 · 기관 HyperCLOVA endpoint·권한·망 검증</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☐ 미구현 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NA**.
- 완료 범위: 일반 개발 계정과 기관 공공/폐쇄망 연결을 구분
- 다음 작업: 허용 모델 주소와 경로를 실행기에서 검사한다. 합성 서비스 앱에서 HCX-005·HCX-007의 문단 조회를 검증했다. 실제 기관망의 승인된 서비스 주소와 접근 권한이 필요하다.
- 근거: [14-hyperclova-x-api-guide.md](<../14-hyperclova-x-api-guide.md>) · [146-ieumoffice-followup.md](<../146-ieumoffice-followup.md>) · [147-checklist-completion.md](<../147-checklist-completion.md>) · [expanded-model-tools.test.mjs](<../../apps/launcher/tests/expanded-model-tools.test.mjs>)
- 원래 기록: `SCOPED_IEUM_FOLLOWUP_2026_11_21;SCOPED_CHECKLIST_COMPLETION_2026_11_21`

</details>

<details id="n029">
<summary>N029 · 변경 비교 화면을 문서 구조 중심으로 개선</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ◐ 부분.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 표/쪽/개체 실제 변경만 표시; 긴 내부 dump와 누락 방지
- 다음 작업: 참고자료를 읽은 표·쪽 편집을 사본에서 실행하고 저장 재열기 뒤 승인 화면에 실제 행·열 수와 용지·여백의 전후 값을 표시한다. 중첩 표 셀의 전후 값과 긴 본문의 변경 부분 및 합친 구역의 표 위치와 기본 탭을 표시한다. HWP·HWPX에서 로컬 Qwen이 바꾼 쪽 배경 색·각도와 쪽 테두리의 포함·제외 값을 확인했다. 저장 바탕쪽은 문구·위치·기본 서식의 전후 값을 표시하며 실제 Qwen의 문구 변경을 두 형식에서 대조했다. 복합 개체와 독립 한글 비교가 남았다.
- 근거: [96-agent-table-merge.md](<../96-agent-table-merge.md>) · [145-ieumoffice-implementation.md](<../145-ieumoffice-implementation.md>) · [146-ieumoffice-followup.md](<../146-ieumoffice-followup.md>) · [147-checklist-completion.md](<../147-checklist-completion.md>) · [agent-changes.ts](<../../apps/editor/src/ui/agent-changes.ts>) · [agent-changes.test.ts](<../../apps/editor/tests/agent-changes.test.ts>) · [reference-change-review.ts](<../../apps/editor/src/ui/reference-change-review.ts>) · [reference-change-details.ts](<../../apps/editor/src/ui/reference-change-details.ts>) · [verify-ieum-first-slice.mjs](<../../apps/editor/scripts/verify-ieum-first-slice.mjs>) · [agent-flow.test.ts](<../../apps/editor/tests/agent-flow.test.ts>) · [manifest.json](<../evidence/checklist-completion-2026-11-21/manifest.json>)
- 원래 기록: `SCOPED_IEUM_FOLLOWUP_2026_11_21;SCOPED_CHECKLIST_COMPLETION_2026_11_21;STRUCTURAL_REVIEW_CHECKPOINT_2026_11_22`

</details>

<details id="n030">
<summary>N030 · 전체 문서 장문 context 예산·선택 확장</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 초기 목록과 문단별 조회를 분리하고 조회 4,000자·40개 문단 ID 한도를 지킨다. 요청에서 허용한 편집 가능 문단의 읽은 범위 한 곳을 저장 보존 검사와 원자 적용에 연결한다.
- 다음 작업: 문단 번호가 없는 질문에서도 로컬 Qwen3.5가 122,595자 HWPX의 전체 본문 없이 마지막 문단을 읽고 2039년 02월 17일을 답했다. Chrome에서 허용한 범위만 편집·저장·재열기·한 번 되돌리기를 확인했다. 운영 모델의 장문·복합 문단 검증이 남았다.
- 근거: [22-agent-retrieval-execution-design.md](<../22-agent-retrieval-execution-design.md>) · [147-checklist-completion.md](<../147-checklist-completion.md>) · [verify-local-model.mjs](<../../apps/editor/scripts/verify-local-model.mjs>) · [manifest.json](<../evidence/checklist-completion-2026-11-21/manifest.json>) · [document-tool-contract.mjs](<../../apps/launcher/providers/document-tool-contract.mjs>)
- 원래 기록: `EXPLICIT_REMAINING_OR_AUDIT;SCOPED_CHECKLIST_COMPLETION_2026_11_21`

</details>

<details id="n031">
<summary>N031 · 관찰→도구 실행→결과 확인 Agent loop</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 최대 비용/횟수·진행·취소·오류·중복 실행·atomic 경계
- 다음 작업: 5가지 제공자 경로를 연결했다. 로컬 Qwen3.5가 실제 조회 도구를 호출해 HWPX에서 읽은 12,500천원을 단위까지 그대로 답했다. 모의 HCX-005·HCX-007 및 다른 경로의 조회 왕복도 확인했다. 각 운영 계정의 실제 품질 검증이 남았다.
- 근거: [22-agent-retrieval-execution-design.md](<../22-agent-retrieval-execution-design.md>) · [144-ieumoffice-reuse-plan.md](<../144-ieumoffice-reuse-plan.md>) · [145-ieumoffice-implementation.md](<../145-ieumoffice-implementation.md>) · [146-ieumoffice-followup.md](<../146-ieumoffice-followup.md>) · [147-checklist-completion.md](<../147-checklist-completion.md>) · [147-checklist-completion.md](<../147-checklist-completion.md>) · [expanded-model-tools.test.mjs](<../../apps/launcher/tests/expanded-model-tools.test.mjs>) · [verify-local-model.mjs](<../../apps/editor/scripts/verify-local-model.mjs>) · [manifest.json](<../evidence/checklist-completion-2026-11-21/manifest.json>)
- 원래 기록: `SCOPED_IEUM_FOLLOWUP_2026_11_21;SCOPED_CHECKLIST_COMPLETION_2026_11_21;SCOPED_CHECKLIST_COMPLETION_2026_11_21`

</details>

<details id="n032">
<summary>N032 · tool 결과 기반 재계획·복구·중단 정책</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 이미 변경한 요청의 무조건 재시도 금지·partial state 기록
- 다음 작업: 첫 미검증 인용을 폐기하고 로컬 Qwen이 장문의 마지막 문단에서 날짜를 다시 확인했다. 읽기 전용 조회에서 이미 근거를 확보한 뒤 조회 오류가 반복되면 남은 한도 내에서 최종 답변을 요청한다. 편집 요청과 근거를 확보하기 전의 연속 오류는 중단하며 허용되지 않은 도구·재차 잘못된 출처도 거절한다. 운영 모델의 복구·무답 평가가 남았다.
- 근거: [22-agent-retrieval-execution-design.md](<../22-agent-retrieval-execution-design.md>) · [144-ieumoffice-reuse-plan.md](<../144-ieumoffice-reuse-plan.md>) · [145-ieumoffice-implementation.md](<../145-ieumoffice-implementation.md>) · [147-checklist-completion.md](<../147-checklist-completion.md>) · [document-tool-loop.test.ts](<../../apps/editor/tests/document-tool-loop.test.ts>) · [manifest.json](<../evidence/checklist-completion-2026-11-21/manifest.json>) · [run-document-tools.ts](<../../apps/editor/src/modules/agent/application/run-document-tools.ts>) · [expanded-model-tools.test.mjs](<../../apps/launcher/tests/expanded-model-tools.test.mjs>) · [verify-ieum-first-slice.mjs](<../../apps/editor/scripts/verify-ieum-first-slice.mjs>)
- 원래 기록: `SCOPED_IEUM_IMPLEMENTATION_2026_11_21;READ_ONLY_RECOVERY_FROM_OBSERVED_RESULTS_2026_11_22`

</details>

<details id="g131">
<summary>G131 · 모델 도구 지원 확인과 허용 주소 제어</summary>

- 종류: 실행 작업 · 우선순위: P2.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ◐ 부분.
- 검증 구분: 자동 **PASS** / 한글 **NOT_RUN**.
- 완료 범위: 합성 모델 도구 지원 시험과 실행기에 설정한 호출 origin 제한.
- 다음 작업: 실제 모델과 기관망에서 정책·응답을 확인해야 한다.
- 근거: [146-ieumoffice-followup.md](<../146-ieumoffice-followup.md>)
- 원래 기록: `SCOPED_IEUM_FOLLOWUP_2026_11_21`

</details>

## 함께 보는 기능

- [참고 자료·검색·RAG](<03-references-and-rag.md>)
- [반복 작업·공무원 업무 양식](<04-macros-and-business.md>)
- [모듈·실행 기반·배포·최종 검수](<16-architecture-and-validation.md>)

이 파일은 자동 생성한다. 상태는 [CSV](<../jueony-work-checklist.csv>)에서, 기능 배치는 [분류 원본](<../checklist-features.json>)에서 수정한다.
