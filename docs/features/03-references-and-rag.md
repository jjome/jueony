# 참고 자료·검색·RAG

[← 종합 진행 현황](<../jueony-progress.md>) · [전체 검색](<../jueony-work-checklist.html>) · [완료 규칙](<../97-master-work-checklist.md>)

즉시 첨부, 자료 격리, 추출·색인·검색·근거와 검색 품질 평가.

## 진행 요약

실행 작업 **10개**, 상위 범위 **0개**. CSV의 기록을 기능별로 표시한 문서다.

| 구분 | 실행 작업 | 상위 범위 |
| :--- | :---: | :---: |
| 구현 | 완료 5/10 · 부분 2 · 미구현 3 | — 상위 범위 없음 |
| 검증 | 완료 4/10 · 부분 1 · 미검증 5 | — 상위 범위 없음 |
| Agent 연결 | 연결 1/6 · 부분 0 · 미연결 5 · 해당 없음 4 | — 상위 범위 없음 |

☑ 완료/연결 · ◐ 부분 · ☐ 대기 · ? 재점검 · — 해당 없음. 검증 완료에는 필요한 한글 직접 비교도 포함한다. 구현 완료만으로 세 축 완료가 되지 않는다.

## 먼저 할 일

- **구현** [N033](<03-references-and-rag.md#n033>) **검색 순위·구본 우선 문제와 무답 판별** — 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀
- **구현** [N034](<03-references-and-rag.md#n034>) **표 숫자·셀/문단 좌표 기반 출처** — 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀
- **구현** [N037](<03-references-and-rag.md#n037>) **실제 모델의 근거·인용·prompt injection 평가** — 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀

## 기능별 작업표

관련된 상위 기능과 실행 작업을 함께 묶었다. 각 표는 최대 8개 항목이며, 완료된 항목도 같은 표에 유지한다. ID를 누르면 아래의 완료조건·근거로 이동한다. **범위** 행은 상위 점검, **작업** 행은 실행 작업으로 중복 집계하지 않는다.

- [업무·자료 · 독립 실행 작업](<#work-1>)
- [검색·반복 · 독립 실행 작업](<#work-2>)

<a id="work-1"></a>

### 업무·자료 · 독립 실행 작업

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [G009](<03-references-and-rag.md#g009>) · 작업 | 폴더 없이 참고 파일 첨부 | ☑ 완료 | ☑ 완료 | — 해당 없음 |
| [G010](<03-references-and-rag.md#g010>) · 작업 | 임시 자료의 업무·채팅 격리 | ☑ 완료 | ☑ 완료 | — 해당 없음 |
| [G011](<03-references-and-rag.md#g011>) · 작업 | 자료 원본을 모델 시스템 명령과 분리 | ☑ 완료 | ◐ 부분 | — 해당 없음 |

<a id="work-2"></a>

### 검색·반복 · 독립 실행 작업

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [G084](<03-references-and-rag.md#g084>) · 작업 | 명시한 자료의 메모리 문자열 검색 | ☑ 완료 | ☑ 완료 | ☑ 연결 |
| [G085](<03-references-and-rag.md#g085>) · 작업 | 검색 코퍼스 21파일·정답 질문 22개 | ☑ 완료 | ☑ 완료 | — 해당 없음 |
| [N033](<03-references-and-rag.md#n033>) · 작업 | 검색 순위·구본 우선 문제와 무답 판별 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |
| [N034](<03-references-and-rag.md#n034>) · 작업 | 표 숫자·셀/문단 좌표 기반 출처 | ☐ 미구현 | ☐ 미검증 | ☐ 미연결 |
| [N035](<03-references-and-rag.md#n035>) · 작업 | 로컬 상시 증분 자료 색인 | ☐ 미구현 | ☐ 미검증 | ☐ 미연결 |
| [N036](<03-references-and-rag.md#n036>) · 작업 | BM25·임베딩·hybrid 검색 비교 실험 | ☐ 미구현 | ☐ 미검증 | ☐ 미연결 |
| [N037](<03-references-and-rag.md#n037>) · 작업 | 실제 모델의 근거·인용·prompt injection 평가 | ◐ 부분 | ☐ 미검증 | ☐ 미연결 |

## 항목별 완료조건·근거

각 항목은 펼쳐서 읽는다. 상태와 근거는 CSV에서 관리한다.

<details id="g009">
<summary>G009 · 폴더 없이 참고 파일 첨부</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: HWP/HWPX/TXT/MD 버튼·드래그·붙여넣기
- 다음 작업: 기록된 범위 유지·관련 변경 시 회귀 검사
- 근거: [23-autonomous-work-result.md](<../23-autonomous-work-result.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g010">
<summary>G010 · 임시 자료의 업무·채팅 격리</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 임시 첨부 수명과 요청 범위 구분
- 다음 작업: 기록된 범위 유지·관련 변경 시 회귀 검사
- 근거: [23-autonomous-work-result.md](<../23-autonomous-work-result.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g011">
<summary>G011 · 자료 원본을 모델 시스템 명령과 분리</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent — 해당 없음.
- 검증 구분: 자동 **PARTIAL** / 한글 **NA**.
- 완료 범위: 명시적 자료 입력 경계; 공격 모델 평가 별도
- 다음 작업: 기록된 범위 유지·관련 변경 시 회귀 검사
- 근거: [22-agent-retrieval-execution-design.md](<../22-agent-retrieval-execution-design.md>) · [context.ts](<../../apps/editor/src/modules/agent/application/context.ts>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g084">
<summary>G084 · 명시한 자료의 메모리 문자열 검색</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 선택 자료만·질문 관련 구간; 임베딩/상시 색인 제외
- 다음 작업: 기록된 범위 유지·관련 변경 시 회귀 검사
- 근거: [45-rag-evaluation-corpus.md](<../45-rag-evaluation-corpus.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="g085">
<summary>G085 · 검색 코퍼스 21파일·정답 질문 22개</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 합성 자료 hash·업무 격리·질문/정답 분리
- 다음 작업: 기록된 범위 유지·관련 변경 시 회귀 검사
- 근거: [45-rag-evaluation-corpus.md](<../45-rag-evaluation-corpus.md>)
- 원래 기록: `DOCUMENTED_SCOPED_IMPLEMENTATION`

</details>

<details id="n033">
<summary>N033 · 검색 순위·구본 우선 문제와 무답 판별</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NA**.
- 완료 범위: 정답 근거 top1·최신 개정·no-answer 지표와 회귀
- 다음 작업: 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀
- 근거: [45-rag-evaluation-corpus.md](<../45-rag-evaluation-corpus.md>)
- 원래 기록: `EXPLICIT_REMAINING_OR_AUDIT`

</details>

<details id="n034">
<summary>N034 · 표 숫자·셀/문단 좌표 기반 출처</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ☐ 미구현 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NA**.
- 완료 범위: 합계·날짜·단위·근거 위치와 원본 열기 검증
- 다음 작업: 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀
- 근거: [45-rag-evaluation-corpus.md](<../45-rag-evaluation-corpus.md>)
- 원래 기록: `EXPLICIT_REMAINING_OR_AUDIT`

</details>

<details id="n035">
<summary>N035 · 로컬 상시 증분 자료 색인</summary>

- 종류: 실행 작업 · 우선순위: P2.
- 상태: 구현 ☐ 미구현 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NA**.
- 완료 범위: 폴더 변경/삭제·권한·업무 범위·hash·취소·비활성 정책
- 다음 작업: 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀
- 근거: [22-agent-retrieval-execution-design.md](<../22-agent-retrieval-execution-design.md>)
- 원래 기록: `EXPLICIT_REMAINING_OR_AUDIT`

</details>

<details id="n036">
<summary>N036 · BM25·임베딩·hybrid 검색 비교 실험</summary>

- 종류: 실행 작업 · 우선순위: P2.
- 상태: 구현 ☐ 미구현 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NA**.
- 완료 범위: 현재 baseline 대비 품질·속도·폐쇄망 모델 자산 검증 후 채택
- 다음 작업: 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀
- 근거: [22-agent-retrieval-execution-design.md](<../22-agent-retrieval-execution-design.md>)
- 원래 기록: `EXPLICIT_REMAINING_OR_AUDIT`

</details>

<details id="n037">
<summary>N037 · 실제 모델의 근거·인용·prompt injection 평가</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ☐ 미검증 / Agent ☐ 미연결.
- 검증 구분: 자동 **NOT_RUN** / 한글 **NA**.
- 완료 범위: 문서 지시문을 권한으로 취급하지 않음·업무 경계·무답
- 다음 작업: 반례/완료조건 고정 → 구현 → 자동 검사 → 실제 한글 또는 실제 모델 검증 → Agent 연결 회귀
- 근거: [45-rag-evaluation-corpus.md](<../45-rag-evaluation-corpus.md>)
- 원래 기록: `EXPLICIT_REMAINING_OR_AUDIT`

</details>

## 함께 보는 기능

- [업무·채팅·폴더 관리](<01-workspaces.md>)
- [AI 연결·Agent 실행](<02-agent-and-models.md>)
- [반복 작업·공무원 업무 양식](<04-macros-and-business.md>)

이 파일은 자동 생성한다. 상태는 [CSV](<../jueony-work-checklist.csv>)에서, 기능 배치는 [분류 원본](<../checklist-features.json>)에서 수정한다.
