# 참고 자료·검색·RAG

[← 종합 진행 현황](<../jueony-progress.md>) · [전체 검색](<../jueony-work-checklist.html>) · [완료 규칙](<../97-master-work-checklist.md>)

즉시 첨부, 자료 격리, 추출·색인·검색·근거와 검색 품질 평가.

## 진행 요약

실행 작업 **11개**, 상위 범위 **0개**. CSV의 기록을 기능별로 표시한 문서다.

| 구분 | 실행 작업 | 상위 범위 |
| :--- | :---: | :---: |
| 구현 | 완료 7/11 · 부분 4 | — 상위 범위 없음 |
| 검증 | 완료 6/11 · 부분 5 | — 상위 범위 없음 |
| Agent 연결 | 연결 5/7 · 부분 2 · 해당 없음 4 | — 상위 범위 없음 |

☑ 완료/연결 · ◐ 부분 · ☐ 대기 · ? 재점검 · — 해당 없음. 검증 완료에는 필요한 한글 직접 비교도 포함한다. 구현 완료만으로 세 축 완료가 되지 않는다.

## 먼저 할 일

- **구현** [N033](<03-references-and-rag.md#n033>) **검색 순위·구본 우선 문제와 무답 판별** — 합성 21파일·22질문에서 BM25 첫 출처 적중 18/18, 무답 오탐 0/4를 확인했다. Chrome에서 현행 예산·착수일·회의록의 첫 출처와 선택 밖 사업의 빈 결과를 확인했다. 실제 읽기 전용 조회 도구에서 로컬 Qwen이 2차 예산 48,000,000원을 올바른 출처로 답했고 선택 밖 사업에는 근거가 없다고 답했다. 운영 모델과 더 넓은 코퍼스는 남았다.
- **구현** [N034](<03-references-and-rag.md#n034>) **표 숫자·셀/문단 좌표 기반 출처** — Chrome에서 HWP·HWPX의 중첩 표 중복 금액을 정확한 인용 셀로 열고 원본 바이트를 대조했다. 로컬 Qwen은 이름으로 지정한 Excel 시트의 C2, PDF 쪽 및 Word 본문 문단을 조회했고 Jueony는 주소와 추출값을 표시했다. 복합 제어와 운영 모델 인용 평가는 남았다.
- **구현** [N037](<03-references-and-rag.md#n037>) **실제 모델의 근거·인용·prompt injection 평가** — 문서 조회는 기본 읽기 전용이고 출처가 있는 편집은 변경 검토를 거친다. Chrome에서 로컬 Qwen이 본문의 사업비와 첨부 자료 한 건의 번호를 확인했다. 자료 조회 도구를 명시한 질문에서는 두 합성 첨부의 승인번호와 출처를 각각 반환했다. 실행 묶음에서 같은 질문을 반복하자 번호와 출처는 맞았지만 자료의 무관한 문구를 함께 답했다. 편집 중인 문서와 첨부 원본은 유지됐다. 답변 재현성과 운영 모델의 답변·편집 제안 평가가 남았다.

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
| [G011](<03-references-and-rag.md#g011>) · 작업 | 자료 원본을 모델 시스템 명령과 분리 | ☑ 완료 | ☑ 완료 | — 해당 없음 |

<a id="work-2"></a>

### 검색·반복 · 독립 실행 작업

| ID | 항목 | 구현 | 검증 | Agent 연결 |
| --- | --- | --- | --- | --- |
| [G084](<03-references-and-rag.md#g084>) · 작업 | 명시한 자료의 메모리 문자열 검색 | ☑ 완료 | ☑ 완료 | ☑ 연결 |
| [G085](<03-references-and-rag.md#g085>) · 작업 | 검색 코퍼스 21파일·정답 질문 22개 | ☑ 완료 | ☑ 완료 | — 해당 없음 |
| [N033](<03-references-and-rag.md#n033>) · 작업 | 검색 순위·구본 우선 문제와 무답 판별 | ◐ 부분 | ◐ 부분 | ☑ 연결 |
| [N034](<03-references-and-rag.md#n034>) · 작업 | 표 숫자·셀/문단 좌표 기반 출처 | ◐ 부분 | ◐ 부분 | ☑ 연결 |
| [N035](<03-references-and-rag.md#n035>) · 작업 | 로컬 상시 증분 자료 색인 | ◐ 부분 | ◐ 부분 | ◐ 부분 |
| [N036](<03-references-and-rag.md#n036>) · 작업 | BM25·임베딩·hybrid 검색 비교 실험 | ☑ 완료 | ◐ 부분 | ◐ 부분 |
| [N037](<03-references-and-rag.md#n037>) · 작업 | 실제 모델의 근거·인용·prompt injection 평가 | ◐ 부분 | ◐ 부분 | ☑ 연결 |
| [G126](<03-references-and-rag.md#g126>) · 작업 | PDF·Word·Excel 참고 자료 추출 | ☑ 완료 | ☑ 완료 | ☑ 연결 |

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
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent — 해당 없음.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 다섯 연결 방식의 자료 본문·파일 이름·조회 결과를 시스템 메시지와 분리; 모델 답변 품질은 N037에서 검증
- 다음 작업: 공급자 변경 시 전체 자료 전달과 조회 결과의 메시지 형식 회귀 검사
- 근거: [22-agent-retrieval-execution-design.md](<../22-agent-retrieval-execution-design.md>) · [context.ts](<../../apps/editor/src/modules/agent/application/context.ts>) · [expanded-model-tools.test.mjs](<../../apps/launcher/tests/expanded-model-tools.test.mjs>) · [147-checklist-completion.md](<../147-checklist-completion.md>) · [manifest.json](<../evidence/checklist-completion-2026-11-21/manifest.json>)
- 원래 기록: `PROVIDER_WIRE_REFERENCE_DATA_BOUNDARY_PASS_2026_11_22`

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
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 정답 근거 top1·최신 개정·no-answer 지표와 회귀
- 다음 작업: 합성 21파일·22질문에서 BM25 첫 출처 적중 18/18, 무답 오탐 0/4를 확인했다. Chrome에서 현행 예산·착수일·회의록의 첫 출처와 선택 밖 사업의 빈 결과를 확인했다. 실제 읽기 전용 조회 도구에서 로컬 Qwen이 2차 예산 48,000,000원을 올바른 출처로 답했고 선택 밖 사업에는 근거가 없다고 답했다. 운영 모델과 더 넓은 코퍼스는 남았다.
- 근거: [45-rag-evaluation-corpus.md](<../45-rag-evaluation-corpus.md>) · [144-ieumoffice-reuse-plan.md](<../144-ieumoffice-reuse-plan.md>) · [145-ieumoffice-implementation.md](<../145-ieumoffice-implementation.md>) · [147-checklist-completion.md](<../147-checklist-completion.md>) · [manifest.json](<../evidence/checklist-completion-2026-11-21/manifest.json>)
- 원래 기록: `SCOPED_IEUM_IMPLEMENTATION_2026_11_21`

</details>

<details id="n034">
<summary>N034 · 표 숫자·셀/문단 좌표 기반 출처</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 일반 HWP/HWPX 본문·평면 표와 XLSX의 실제 근거 주소, 날짜·금액·단위와 원본 열기 보호.
- 다음 작업: Chrome에서 HWP·HWPX의 중첩 표 중복 금액을 정확한 인용 셀로 열고 원본 바이트를 대조했다. 로컬 Qwen은 이름으로 지정한 Excel 시트의 C2, PDF 쪽 및 Word 본문 문단을 조회했고 Jueony는 주소와 추출값을 표시했다. 복합 제어와 운영 모델 인용 평가는 남았다.
- 근거: [45-rag-evaluation-corpus.md](<../45-rag-evaluation-corpus.md>) · [147-checklist-completion.md](<../147-checklist-completion.md>) · [reference-locations.test.ts](<../../apps/editor/tests/reference-locations.test.ts>) · [verify-ieum-first-slice.mjs](<../../apps/editor/scripts/verify-ieum-first-slice.mjs>) · [reference-locations.ts](<../../apps/editor/src/adapters/rhwp/reference-locations.ts>) · [manifest.json](<../evidence/checklist-completion-2026-11-21/manifest.json>)
- 원래 기록: `SCOPED_CHECKLIST_COMPLETION_2026_11_21`

</details>

<details id="n035">
<summary>N035 · 로컬 상시 증분 자료 색인</summary>

- 종류: 실행 작업 · 우선순위: P2.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ◐ 부분.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 폴더 변경/삭제·권한·업무 범위·hash·취소·비활성 정책
- 다음 작업: 앱에서 파일 지문을 단위로 증분 갱신한다. Windows에서 파일 이동·삭제·폴더 권한 차단 시 영향을 받은 자료만 색인에서 빼고 나머지 선택 자료는 유지했다. 파일 크기와 수정 시간이 같은 변경 및 권한 복구를 반영했다. 실행기 재시작 후 SQLite 기록을 재사용하고 채팅에 최신 선택 자료만 전달했다. 운영체제 수준 백그라운드 색인이 남았다.
- 근거: [22-agent-retrieval-execution-design.md](<../22-agent-retrieval-execution-design.md>) · [144-ieumoffice-reuse-plan.md](<../144-ieumoffice-reuse-plan.md>) · [145-ieumoffice-implementation.md](<../145-ieumoffice-implementation.md>) · [146-ieumoffice-followup.md](<../146-ieumoffice-followup.md>) · [147-checklist-completion.md](<../147-checklist-completion.md>) · [reference-locations.test.ts](<../../apps/editor/tests/reference-locations.test.ts>) · [reference-index-refresh.test.ts](<../../apps/editor/tests/reference-index-refresh.test.ts>) · [verify-ieum-first-slice.mjs](<../../apps/editor/scripts/verify-ieum-first-slice.mjs>) · [verify-windows-reference-index.mjs](<../../apps/editor/scripts/verify-windows-reference-index.mjs>) · [manifest.json](<../evidence/checklist-completion-2026-11-21/manifest.json>)
- 원래 기록: `SCOPED_IEUM_FOLLOWUP_2026_11_21;WINDOWS_IN_APP_SELECTIVE_FTS_REFRESH_VERIFIED_2026_11_22`

</details>

<details id="n036">
<summary>N036 · BM25·임베딩·hybrid 검색 비교 실험</summary>

- 종류: 실행 작업 · 우선순위: P2.
- 상태: 구현 ☑ 완료 / 검증 ◐ 부분 / Agent ◐ 부분.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 현재 baseline 대비 품질·속도·폐쇄망 모델 자산 검증 후 채택
- 다음 작업: 같은 자료로 BM25·다국어 E5·결합 검색을 비교했다. 정답 출처 1위 12/18·11/18·14/18, 무답 오탐 1/4·4/4·1/4를 기록했다. 앱 기본 검색은 BM25를 유지하며 기관 자료·장비와 배포 검증이 남았다.
- 근거: [22-agent-retrieval-execution-design.md](<../22-agent-retrieval-execution-design.md>) · [144-ieumoffice-reuse-plan.md](<../144-ieumoffice-reuse-plan.md>) · [145-ieumoffice-implementation.md](<../145-ieumoffice-implementation.md>) · [147-checklist-completion.md](<../147-checklist-completion.md>) · [evaluate-rag-embeddings.py](<../../scripts/evaluate-rag-embeddings.py>) · [embedding-comparison.json](<../evidence/checklist-completion-2026-11-21/embedding-comparison.json>)
- 원래 기록: `SCOPED_IEUM_IMPLEMENTATION_2026_11_21;SCOPED_CHECKLIST_COMPLETION_2026_11_21`

</details>

<details id="n037">
<summary>N037 · 실제 모델의 근거·인용·prompt injection 평가</summary>

- 종류: 실행 작업 · 우선순위: P1.
- 상태: 구현 ◐ 부분 / 검증 ◐ 부분 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 문서 지시문을 권한으로 취급하지 않음·업무 경계·무답
- 다음 작업: 문서 조회는 기본 읽기 전용이고 출처가 있는 편집은 변경 검토를 거친다. Chrome에서 로컬 Qwen이 본문의 사업비와 첨부 자료 한 건의 번호를 확인했다. 자료 조회 도구를 명시한 질문에서는 두 합성 첨부의 승인번호와 출처를 각각 반환했다. 실행 묶음에서 같은 질문을 반복하자 번호와 출처는 맞았지만 자료의 무관한 문구를 함께 답했다. 편집 중인 문서와 첨부 원본은 유지됐다. 답변 재현성과 운영 모델의 답변·편집 제안 평가가 남았다.
- 근거: [45-rag-evaluation-corpus.md](<../45-rag-evaluation-corpus.md>) · [147-checklist-completion.md](<../147-checklist-completion.md>) · [verify-ieum-first-slice.mjs](<../../apps/editor/scripts/verify-ieum-first-slice.mjs>) · [verify-local-model.mjs](<../../apps/editor/scripts/verify-local-model.mjs>) · [manifest.json](<../evidence/checklist-completion-2026-11-21/manifest.json>) · [reference-change-review.ts](<../../apps/editor/src/ui/reference-change-review.ts>) · [agent-flow.test.ts](<../../apps/editor/tests/agent-flow.test.ts>) · [agent-file-save.test.ts](<../../apps/editor/tests/agent-file-save.test.ts>)
- 원래 기록: `EXPLICIT_REMAINING_OR_AUDIT;SCOPED_CHECKLIST_COMPLETION_2026_11_21;LOCAL_TWO_REFERENCE_CITATIONS_VERIFIED_RESPONSE_FILTERING_INCONSISTENT_2026_11_22`

</details>

<details id="g126">
<summary>G126 · PDF·Word·Excel 참고 자료 추출</summary>

- 종류: 실행 작업 · 우선순위: P2.
- 상태: 구현 ☑ 완료 / 검증 ☑ 완료 / Agent ☑ 연결.
- 검증 구분: 자동 **PASS** / 한글 **NA**.
- 완료 범위: 디지털 PDF 텍스트 및 선택형 로컬 OCR, DOCX 본문·표, XLSX 보이는 시트의 셀 주소·저장 값.
- 다음 작업: Chrome에서 PDF·Word·Excel 추출과 작은 스캔의 로컬 OCR을 확인했다. 로컬 Qwen이 디지털 PDF의 쪽, Word 본문의 문단, Excel 시트의 셀을 조회했다. 출처를 열어 같은 내용과 변경되지 않은 원본을 확인했다. 복합 문서 인식 품질과 운영 모델 평가는 별도다.
- 근거: [145-ieumoffice-implementation.md](<../145-ieumoffice-implementation.md>) · [146-ieumoffice-followup.md](<../146-ieumoffice-followup.md>) · [147-checklist-completion.md](<../147-checklist-completion.md>) · [manifest.json](<../evidence/checklist-completion-2026-11-21/manifest.json>)
- 원래 기록: `SCOPED_IEUM_FOLLOWUP_2026_11_21`

</details>

## 함께 보는 기능

- [업무·채팅·폴더 관리](<01-workspaces.md>)
- [AI 연결·Agent 실행](<02-agent-and-models.md>)
- [반복 작업·공무원 업무 양식](<04-macros-and-business.md>)

이 파일은 자동 생성한다. 상태는 [CSV](<../jueony-work-checklist.csv>)에서, 기능 배치는 [분류 원본](<../checklist-features.json>)에서 수정한다.
