# 파일 저장과 표 편집 검수 · 2026-11-08

| 작업 | 이번에 실제로 동작하는 범위 | 남은 범위 |
| --- | --- | --- |
| N046 문단 글 방향 | HWP 내보내기의 유일한 손실이 문단 글 방향이면 다른 이름 저장에서 HWPX를 선택할 수 있다. AUTO·LTR·RTL을 저장한 HWPX 원문에서 확인했다. 취소와 문서 교체 시 쓰기를 중단한다. | 같은 값을 HWP5 바이너리로 기록하고 독립적으로 재확인할 매핑 |
| N004 병합 셀 본문 | HWP·HWPX에서 구간별 교체·삭제와 여러 쪽 표의 병합 문단 수정을 지원한다. 저장·재열기 후 남은 글자의 서식과 수정한 셀의 실제 행·열을 확인했다. | 필드·개체 포함 문단, 셀 자체가 둘 이상의 쪽에 걸친 경우, 새 글자 서식 생성 |
| N005 셀 분할 | 단일 병합 주 셀을 이웃에서 확인한 원래 격자로 복원하거나 기존 격자선에 맞춰 더 적은 행·열로 나눈다. HWPX 및 원본 보존을 확인한 HWP5 평면 표에서 불균등한 크기를 보존하고 문단을 행 순서대로 여러 셀에 분배할 수 있다. 글자·문단 서식도 함께 옮긴다. | 여러 병합 셀, 중첩 표, 확인되지 않는 분할선과 영역 서식 |
| N006 중첩 표 | Agent가 부모 표·셀·문단 경로를 따라 내부의 단순 셀을 읽고 수정한다. 동일한 텍스트가 여러 곳에 있어도 지정한 셀만 바꾼다. | 중첩 표의 구조 변경 및 복합 셀 편집 |
| N007 병합 표의 행·열 | Agent가 병합 범위를 가로질러 행·열을 추가하거나 삭제한다. 병합 셀의 시작 행·열을 지워도 남은 셀에 문단과 서식이 유지된다. | 원래 크기를 확인할 수 없는 격자, 중첩·필드·합성 영역을 포함한 구조 변경 |
| N009 저장된 표 계산식 | 수식을 만들고 수정할 수 있다. 일반 숫자 셀에 키보드로 입력·삭제·선택 치환하거나 Agent가 수정하면 직접·간접 참조 결과가 갱신되고 한 번에 되돌릴 수 있다. | IME 조합·범위 붙여넣기, 중첩·병합 표의 수식, 지원 목록 밖 함수 |
| N010 자동 채우기 | F5+A와 Agent에서 직사각형을 가로 또는 세로로 채운다. 각 행·열의 시작값으로 날짜·번호·수식 문자열·실제 수식·고정값을 채우고 전체를 한 번에 되돌린다. | 병합·중첩 범위와 추가 날짜 표기 |

## 11월 8일 추가 검수

최종 코드 `0fb7daef`의 격리 체크아웃과 Rust/WASM `2b48445c764249f6`에서 TypeScript 검사, 편집기 테스트 1,218/1,218, 숫자 셀 입력 Edge 검사 8/8, 글 방향 사본 저장 Edge 검사 12/12를 통과했다. 아래 실행 명령으로 이 합본을 열 수 있다.

- HWP와 HWPX에서 참조하는 일반 셀에 숫자를 입력해 수식 두 단계가 갱신되는지 확인했다. 키 입력과 Agent 요청으로 저장한 파일 4개에서 수식과 표시값을 읽어 대조했다. 보호된 간접 참조나 유효하지 않은 입력은 원복했다. 해당 Edge 검사 8건을 통과했다. [숫자 입력 검수](../apps/editor/scripts/verify-table-formula-input.mjs)
- 원본과 같은 HWPX를 별도 파일 핸들로 다시 선택하면 대체 저장이 원본 쓰기 스트림을 여는 결함을 재현했다. 수정 후 같은 파일, 핸들 없는 원본, 파일 선택 도중 문서 전환에서 원본 쓰기는 0회였다. Edge 검사 12건을 통과했다. 한컴 공개 API는 AUTO=0, RTL=1, LTR=2를 정의하나 HWP5 문단 레코드의 대응 위치는 확인되지 않았다. [원본 보호 및 글 방향 근거](139-basic-editor-parallel-plan.md)
- 병합 셀은 Rust/WASM 검사 46건과 Edge 17건을 통과했다. 3쪽 표의 둘째 쪽에서 첫 서식 구간을 삭제한 뒤 한 번 되돌리고 다시 적용했다. HWP·HWPX 재열기 결과에서 수정한 셀과 첫 쪽의 같은 화면 번호를 가진 다른 셀을 각각 확인했다. [엔진 검사](../apps/editor/scripts/verify-cell-paragraph-engine.mjs) · [Edge 검사](../apps/editor/scripts/verify-cell-paragraph.mjs)
- 직사각형 채우기는 HWP·HWPX에서 행별 날짜와 열별 수식의 생성, 미리보기 방향 변경, 저장·재열기, 둘째 행 적용 중 오류가 난 경우의 전체 원복을 검사했다. [직사각형 엔진 검사](../apps/editor/scripts/verify-rectangular-fill.mjs) · [편집기 검사](../apps/editor/scripts/verify-table-date-fill.mjs) · [Agent 채팅 검사](../apps/editor/scripts/verify-agent-fill-series.mjs)

## 이전 합본 · 6c08fcb2

코드 커밋 `6c08fcb2`를 별도 체크아웃에서 빌드했다. Rust/WASM 패키지 동작 검사와 TypeScript 검사를 통과했다. 아래 결과는 이 합본에서 다시 실행한 값이다. [자동 검수 기록과 빌드 지문](evidence/file-table-2026-11-08/summary.json)

| 검사 | 통과 | 확인한 동작 |
| --- | ---: | --- |
| 편집기 테스트 | 1,215/1,215 | 편집 명령, 보존 검사, Agent 계약 |
| 런처 테스트 | 52/52 | 로컬 서버와 요청 처리 |
| Edge 글 방향 저장 | 8/8 | 세 방향의 저장·취소, 암호, 저장 도중 문서 전환 |
| Edge 복구 | 10/10 | 프로세스 강제 종료 후 미저장 문서 복구, 원본 보존, 손상된 복구본 격리 |
| Edge 병합 셀·중첩 표 | 15/15 · 25/25 · 2/2 | 병합 문단 수정, 행 높이와 행·열 변경, 중첩 셀 지정 편집 |
| Edge 표 분할 | 16/16 | 원래 크기, 문단 분배, 오래된 요청과 실패 원복 |
| Edge 표 자동 채우기 | 17/17 | 날짜·수식·고정값, 순환 참조와 쓰기 실패 |
| Edge Agent 채팅 | 21/21 | 빈 셀·텍스트 셀에 수식 생성, 연관 셀 재계산, 채우기, 응답 대기 중 사용자 편집 보존 |
| HWP·HWPX 디스크 저장·재열기 | 402/402 | 복합 배치 시나리오 77회에서 원본·변경본·재저장본 검사 |

Agent 채팅은 로컬 모의 제공자를 사용했다. 최종 21건에는 두 파일 형식에서 실행한 수식 필드 생성 6건과 응답 대기 중 문서가 변경된 1건이 포함된다.

## 파일과 복구

- 복합 배치·병합 격자 등의 공식 합본에서 합성 문서 네 검사 묶음의 시나리오 77회(9·24·8·36)와 HWP/HWPX 디스크 저장·재열기 402회(18·120·48·216)를 통과했다. 배치 한도를 넘는 별도 4건은 저장 전에 차단됐다. 문서 정보와 날짜·시각 보존은 17건을 통과했다. [복합 문서](../apps/editor/scripts/verify-complex-stories178.mjs) · [병합 격자](../apps/editor/scripts/verify-merged-grid176.mjs) · [부호 있는 좌표](../apps/editor/scripts/verify-signed-short177.mjs) · [복합 배치](../apps/editor/scripts/verify-complex-retained178.mjs) · [한도 초과 차단](../apps/editor/scripts/verify-signed-oversize179.mjs) · [문서 정보](../apps/editor/scripts/verify-stored-information95.mjs)
- 복구 단위 검사 36건과 별도 Edge 프로필의 강제 종료·복구·재저장 등 10건을 통과했다. 글 방향 저장에 대해서는 보존 회귀 31건과 Edge 8건을 통과했다. [복구 검수](../apps/editor/scripts/verify-recovery-integrity.mjs) · [글 방향과 암호 저장 검수](../apps/editor/scripts/verify-direction-save-as.mjs)
- N046에서 확인할 값은 문단의 AUTO·LTR·RTL이다. 한컴의 공개 HWP 5.0 개정 1.3 문단 모양 표에서는 이 세 값의 대응 비트를 확인할 수 없었다. 실제 한글 검수 때에는 내용과 서식이 같은 문서에서 방향만 각각 바꾸어 HWP와 HWPX로 저장하고 문단이 참조하는 레코드를 대조한다. [한컴 HWP 5.0 공개 명세](https://cdn.hancom.com/link/docs/%ED%95%9C%EA%B8%80%EB%AC%B8%EC%84%9C%ED%8C%8C%EC%9D%BC%ED%98%95%EC%8B%9D_5.0_revision1.3.pdf)

## 표 편집

- 병합 셀의 행·열은 Agent 명령 검사 19건을 통과했다. Edge에서 HWP와 HWPX 각각 행 삽입·열 삭제 후 한 번의 되돌리기, 다시 실행, 저장·재열기를 확인했다. 크기나 서식이 기대와 다르거나 편집 후 저장 검사가 실패하면 원래 바이트를 복구하는 사례도 검사했다. [명령 검사](../apps/editor/tests/merged-table-axis.test.ts) · [Edge 검수](../apps/editor/scripts/verify-merged-row-height.mjs)
- 병합 문단 수정은 엔진 34건과 Edge 15건을 통과했다. 두 형식에서 여러 서식 구간에 다른 길이의 텍스트와 이모지를 입력하고 되돌리기·다시 실행·재열기 후 원래 서식을 대조했다. HWP5 원본을 포함한 격자 분할과 문단 분배는 엔진 27건과 Edge 16건을 통과했다. 중첩 표는 HWP와 HWPX에서 같은 내용의 셀 4개 중 지정한 한 셀만 수정하고 파일을 다시 열었다. [서식 검수](../apps/editor/scripts/verify-cell-paragraph.mjs) · [분할 검수](../apps/editor/scripts/verify-table-subdivision.mjs) · [중첩 표 채팅 검수](../apps/editor/scripts/verify-nested-agent-browser.mjs)
- 수식 필드 보존은 실제 문서 2쌍의 필드 7개를 두 형식으로 각각 저장하는 8건을 통과했다. 바이너리 레코드와 HWPX XML의 필드 인수·시작 및 끝 표식을 독립적으로 검사했다. 이 8건은 계산 필드 보존에 대한 결과다. 한 복합 HWPX→HWP 문서는 다른 속성 손실도 보고하여 전체 파일의 무손실 저장 사례에서 제외했다. [파일 형식 검수](../apps/editor/scripts/verify-native-formula-fields.mjs)
- 자동 채우기에서는 윤년 월말, 상대·절대 참조, 고정 계산값과 실제 수식 필드를 두 형식에 적용하고 되돌리기·다시 실행·저장·재열기를 검사했다. 대상 셀을 두 번째로 쓴 직후 오류를 주입했을 때 원본 바이트가 복구됐다. [대화상자 검수](../apps/editor/scripts/verify-table-date-fill.mjs) · [Agent 채팅 검수](../apps/editor/scripts/verify-agent-fill-series.mjs)
- 계산식은 참조 범위를 바꾼 뒤 한 수식이 두 경로로 같은 셀에 영향을 주는 경우와 순환·0으로 나누기·보호된 연관 셀에서 전체 쓰기를 거절하는 경우를 검사했다. HWP/HWPX 각 입력을 두 출력 형식으로 저장하고 디스크의 수식·표시 결과를 대조했다. [수식 연쇄·원복 검수](../apps/editor/scripts/verify-native-formula-update.mjs) · [새 필드 검수](../apps/editor/scripts/verify-new-table-formula-field.mjs)
- 병렬 빌드에서 서로 다른 Rust 소스가 같은 Cargo 출력 파일을 사용해 이전 WASM이 포장되는 결함을 재현했다. 빌드 출력을 소스 지문별로 분리했다. 빌드와 편집기 번들 생성 시 실제 WASM에서 셀 분할·문단 분배와 계산식 삽입·연쇄 갱신·저장 재열기를 실행한다. 잘못 포장된 패키지는 이 검사에서 거절됐다. [패키지 동작 검수](../scripts/verify-document-engine-package.mjs)

## 직접 확인

이번에 검수한 Windows PC에서는 프로젝트 루트에서 다음 명령으로 확인한 합본을 열 수 있다. 별도 체크아웃과 포트를 사용하며, 실행 스크립트로 열린 서버에서 커밋과 엔진 지문을 확인했다.

```powershell
.\build\nov-qacheck\scripts\Start-Jueony.ps1 -Port 4619
```

새 체크아웃에서 같은 기능을 빌드하려면 `scripts/Build-DocumentEngine.ps1`이 출력한 패키지 경로를 `JUEONY_ENGINE_PACKAGE` 환경 변수에 지정한 뒤 `scripts/Build-Jueony.ps1`을 실행한다. 이 검수는 프로젝트의 Rust 패치를 적용한 엔진을 사용했다.

1. 병합 셀에 두 가지 글자 서식을 준 뒤 해당 문단의 각 서식 구간에 들어갈 텍스트를 지정해 Agent에 요청한다. 저장 후 다시 열어 구간 경계와 이웃 셀을 확인한다.
2. 일반 본문 표에서 계산식 창을 열고 **계산식 필드로 삽입**을 선택한다. A3에 `=2`, D3에 `=A3*2`를 넣은 다음 A3 수식을 `=5`로 수정한다. D3의 결과가 10이 되고 한 번 되돌리면 두 셀의 결과가 2와 4로 돌아간다.
3. 합성 HWPX 문서를 HWP로 다른 이름 저장할 때 보존 검사에서 문단 글 방향만 손실된다고 판정하면 HWPX 저장을 선택할 수 있다. 취소했을 때 기존 파일과 편집 중 변경 내용이 유지되는지도 확인한다.

한글 2024 직접 비교는 일괄 검수 대상으로 남겨 두었다. 현재 기능별 분모와 부분 상태는 종합표에 표시한다. [종합 진행표](jueony-progress.md) · [자동 검수 기록](evidence/file-table-2026-11-08/summary.json)
