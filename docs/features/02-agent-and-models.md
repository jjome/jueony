# AI 연결·Agent 실행

[← 종합 진행 현황](<../jueony-progress.md>) · [전체 검색](<../jueony-work-checklist.html>) · [완료 규칙](<../97-master-work-checklist.md>)

제공자·모델·인증, 현재 문서 문맥, 진행·취소, 변경 확인과 Agent loop.

## 진행 요약

실행 작업 **20개**, 상위 범위 **0개**. CSV의 기록을 기능별로 표시한 문서다.

| 축 | 실행 작업 상태 |
| --- | --- |
| 구현 | 완료 14/20 · 부분 2 · 미구현 4 |
| 검증 | 완료 9/20 · 부분 3 · 미검증 8 |
| Agent 연결 | 연결 13/19 · 부분 0 · 미연결 6 · 해당 없음 1 |

☑ 완료/연결 · ◐ 부분 · ☐ 대기 · ? 재점검 · — 해당 없음. 검증 완료에는 필요한 한글 직접 비교도 포함한다. 구현 완료만으로 세 축 완료가 되지 않는다.

## 먼저 할 일

- **구현** [N024](<02-agent-and-models.md#n024>) **브라우저 인증 링크 기반 계정 연결** — 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀
- **구현** [N028](<02-agent-and-models.md#n028>) **기관 HyperCLOVA endpoint·권한·망 검증** — 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀
- **구현** [N029](<02-agent-and-models.md#n029>) **변경 비교 화면을 문서 구조 중심으로 개선** — 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀

## 남은 실행 작업 (11)

항목 ID를 누르면 아래의 완료조건·근거를 펼쳐 확인할 수 있다.

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [G080](<02-agent-and-models.md#g080>) P1 | 현재 미저장 문서 snapshot으로 문맥 구성 | ☑ 완료 | ◐ 부분 | ☑ 연결 |
| [G082](<02-agent-and-models.md#g082>) P1 | 요청 변경 확인·undo/redo | ☑ 완료 | ◐ 부분 | ☑ 연결 |
| [N024](<02-agent-and-models.md#n024>) P1 | 브라우저 인증 링크 기반 계정 연결 | ☐ 미구현 | ☐ 미검증 | ☐ 미연결 |
| [N025](<02-agent-and-models.md#n025>) P1 | GPT 실제 계정·모델 호출 검증 | ☑ 완료 | ☐ 미검증 | ☑ 연결 |
| [N026](<02-agent-and-models.md#n026>) P1 | Claude 실제 계정 회귀와 오류 검증 | ☑ 완료 | ◐ 부분 | ☑ 연결 |
| [N027](<02-agent-and-models.md#n027>) P1 | Gemini 실제 계정·모델 호출 검증 | ☑ 완료 | ☐ 미검증 | ☑ 연결 |
| [N028](<02-agent-and-models.md#n028>) P1 | 기관 HyperCLOVA endpoint·권한·망 검증 | ☐ 미구현 | ☐ 미검증 | ☐ 미연결 |
| [N029](<02-agent-and-models.md#n029>) P1 | 변경 비교 화면을 문서 구조 중심으로 개선 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |
| [N030](<02-agent-and-models.md#n030>) P1 | 전체 문서 장문 context 예산·선택 확장 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |
| [N031](<02-agent-and-models.md#n031>) P1 | 관찰→도구 실행→결과 확인 Agent loop | ☐ 미구현 | ☐ 미검증 | ☐ 미연결 |
| [N032](<02-agent-and-models.md#n032>) P1 | tool 결과 기반 재계획·복구·중단 정책 | ☐ 미구현 | ☐ 미검증 | ☐ 미연결 |

## 세 축 완료 작업 (9)

항목 ID를 누르면 아래의 완료조건·근거를 펼쳐 확인할 수 있다.

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [G074](<02-agent-and-models.md#g074>) P1 | GPT Responses adapter와 연결 설정 | ☑ 완료 | ☑ 완료 | ☑ 연결 |
| [G075](<02-agent-and-models.md#g075>) P1 | Claude Messages adapter와 연결 설정 | ☑ 완료 | ☑ 완료 | ☑ 연결 |
| [G076](<02-agent-and-models.md#g076>) P1 | Gemini GenerateContent adapter와 연결 설정 | ☑ 완료 | ☑ 완료 | ☑ 연결 |
| [G077](<02-agent-and-models.md#g077>) P1 | HyperCLOVA v3 adapter와 연결 설정 | ☑ 완료 | ☑ 완료 | ☑ 연결 |
| [G078](<02-agent-and-models.md#g078>) P1 | 모델·제공자 선택을 실제 요청에 반영 | ☑ 완료 | ☑ 완료 | ☑ 연결 |
| [G079](<02-agent-and-models.md#g079>) P1 | DPAPI 키 보관·교체·삭제·재시작 복원 | ☑ 완료 | ☑ 완료 | — 해당 없음 |
| [G081](<02-agent-and-models.md#g081>) P1 | 진행·오류·취소와 실행 기록 | ☑ 완료 | ☑ 완료 | ☑ 연결 |
| [G083](<02-agent-and-models.md#g083>) P1 | 읽기·편집 facade와 제공자 Port 분리 | ☑ 완료 | ☑ 완료 | ☑ 연결 |
| [G086](<02-agent-and-models.md#g086>) P1 | 2~3회 후보 검토 후 한 번 적용 | ☑ 완료 | ☑ 완료 | ☑ 연결 |

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
- 상태: 구현 ☐ 미구현 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NA**.
- 완료 범위: 제공자가 허용한 OAuth/CLI 흐름·취소·토큰 암호화·만료/철회
- 다음 작업: 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀
- 근거: [24-next-development-plan.md](<../24-next-development-plan.md>)
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
- 다음 작업: 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀
- 근거: [14-hyperclova-x-api-guide.md](<../14-hyperclova-x-api-guide.md>)
- 원래 기록: `EXPLICIT_REMAINING_OR_AUDIT`

</details>

<details id="n029">
<summary>N029 · 변경 비교 화면을 문서 구조 중심으로 개선</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NA**.
- 완료 범위: 표/쪽/개체 실제 변경만 표시; 긴 내부 dump와 누락 방지
- 다음 작업: 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀
- 근거: [96-agent-table-merge.md](<../96-agent-table-merge.md>)
- 원래 기록: `EXPLICIT_REMAINING_OR_AUDIT`

</details>

<details id="n030">
<summary>N030 · 전체 문서 장문 context 예산·선택 확장</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NA**.
- 완료 범위: 잘림 표시·분할 읽기·최신 버전·누락 대상 거절
- 다음 작업: 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀
- 근거: [22-agent-retrieval-execution-design.md](<../22-agent-retrieval-execution-design.md>)
- 원래 기록: `EXPLICIT_REMAINING_OR_AUDIT`

</details>

<details id="n031">
<summary>N031 · 관찰→도구 실행→결과 확인 Agent loop</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☐ 미구현 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NA**.
- 완료 범위: 최대 비용/횟수·진행·취소·오류·중복 실행·atomic 경계
- 다음 작업: 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀
- 근거: [22-agent-retrieval-execution-design.md](<../22-agent-retrieval-execution-design.md>)
- 원래 기록: `EXPLICIT_REMAINING_OR_AUDIT`

</details>

<details id="n032">
<summary>N032 · tool 결과 기반 재계획·복구·중단 정책</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☐ 미구현 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NA**.
- 완료 범위: 이미 변경한 요청의 무조건 재시도 금지·partial state 기록
- 다음 작업: 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀
- 근거: [22-agent-retrieval-execution-design.md](<../22-agent-retrieval-execution-design.md>)
- 원래 기록: `EXPLICIT_REMAINING_OR_AUDIT`

</details>

## 함께 보는 기능

- [참고 자료·검색·RAG](<03-references-and-rag.md>)
- [반복 작업·공무원 업무 양식](<04-macros-and-business.md>)
- [모듈·실행 기반·배포·최종 검수](<16-architecture-and-validation.md>)

이 파일은 자동 생성한다. 상태는 [CSV](<../jueony-work-checklist.csv>)에서, 기능 배치는 [분류 원본](<../checklist-features.json>)에서 수정한다.
