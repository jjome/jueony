# 파일 저장과 표 편집 검수 · 2026-11-08

| 작업 | 이번에 실제로 동작하는 범위 | 남은 범위 |
| --- | --- | --- |
| N046 문단 글 방향 | HWP 내보내기의 유일한 손실이 문단 글 방향이면 다른 이름 저장에서 HWPX를 선택할 수 있다. AUTO·LTR·RTL을 저장한 HWPX 원문에서 확인했다. 취소와 문서 교체 시 쓰기를 중단한다. | 같은 값을 HWP5 바이너리로 기록하고 독립적으로 재확인할 매핑 |
| N004 병합 셀 본문 | 혼합 서식 문단에서 수정 위치가 한 글자 서식 구간으로 확정되면 해당 내용만 바꾼다. 이웃 구간의 글자·문단 서식을 확인한다. | 여러 서식 구간을 가로지르는 변경, 필드·개체가 있는 문단 |
| N005 셀 분할 | 단일 병합 주 셀을 이웃에서 확인한 원래 격자로 복원하거나 기존 격자선에 맞춰 더 적은 행·열로 나눈다. 불균등한 크기를 보존한다. | 여러 병합 셀, 중첩 표, 확인되지 않는 분할선과 영역 서식 |
| N006 중첩 표 | Agent가 부모 표·셀·문단 경로를 따라 내부의 단순 셀을 읽고 수정한다. 동일한 텍스트가 여러 곳에 있어도 지정한 셀만 바꾼다. | 중첩 표의 구조 변경 및 복합 셀 편집 |
| N007 병합 표의 행·열 | Agent가 병합 범위를 가로질러 행·열을 추가하거나 삭제한다. 병합 셀의 시작 행·열을 지워도 남은 셀에 문단과 서식이 유지된다. | 원래 크기를 확인할 수 없는 격자, 중첩·필드·합성 영역을 포함한 구조 변경 |
| N009 저장된 표 계산식 | HWP→HWPX에서 누락되던 수식·결과 표시 형식·마지막 결과와 필드 끝 표식을 보존한다. 실제 필드가 들어 있는 두 쌍의 HWP·HWPX를 대조했다. | 원본 계산식 편집과 의존 셀 연쇄 갱신 |
| N010 자동 채우기 | F5+A 또는 Agent 요청에서 날짜·번호 수열, 상대·절대 A1 참조가 있는 수식 문자열, 현재 계산값을 채운다. 공문 날짜의 연월일 표기와 공백을 보존한다. | 기존 한글 계산 필드 자체를 복제해 재계산하는 자동 채우기 |

## 파일과 복구

- 복합 배치·병합 격자 등의 합성 문서 75개 시나리오에서 HWP/HWPX 디스크 저장과 재열기 392회를 통과했다. 배치 한도를 넘는 별도 4건은 저장 전에 차단됐다. 문서 정보와 날짜·시각 보존은 17건을 통과했다. [복합 문서](../apps/editor/scripts/verify-complex-stories178.mjs) · [병합 격자](../apps/editor/scripts/verify-merged-grid176.mjs) · [부호 있는 좌표](../apps/editor/scripts/verify-signed-short177.mjs) · [복합 배치](../apps/editor/scripts/verify-complex-retained178.mjs) · [한도 초과 차단](../apps/editor/scripts/verify-signed-oversize179.mjs) · [문서 정보](../apps/editor/scripts/verify-stored-information95.mjs)
- 복구 단위 검사 36건과 별도 Edge 프로필의 강제 종료·복구·재저장 등 10건을 통과했다. 글 방향 저장에 대해서는 보존 회귀 31건과 Edge 8건을 통과했다. [복구 검수](../apps/editor/scripts/verify-recovery-integrity.mjs) · [글 방향과 암호 저장 검수](../apps/editor/scripts/verify-direction-save-as.mjs)

## 표 편집

- 병합 셀의 행·열은 Agent 명령 검사 19건을 통과했다. Edge에서 HWP와 HWPX 각각 행 삽입·열 삭제 후 한 번의 되돌리기, 다시 실행, 저장·재열기를 확인했다. 크기나 서식이 기대와 다르거나 편집 후 저장 검사가 실패하면 원래 바이트를 복구하는 사례도 검사했다. [명령 검사](../apps/editor/tests/merged-table-axis.test.ts) · [Edge 검수](../apps/editor/scripts/verify-merged-row-height.mjs)
- 기존 병합 문단 수정은 엔진 32건과 Edge 13건, 기존 격자 분할은 엔진 18건과 Edge 14건을 통과했다. 중첩 표는 HWP와 HWPX에서 같은 내용의 셀 4개 중 지정한 한 셀만 수정하고 파일을 다시 열었다. [서식 검수](../apps/editor/scripts/verify-cell-paragraph.mjs) · [분할 검수](../apps/editor/scripts/verify-table-subdivision.mjs) · [중첩 표 채팅 검수](../apps/editor/scripts/verify-nested-agent-browser.mjs)
- 수식 필드 보존은 실제 문서 2쌍의 필드 7개를 두 형식으로 각각 저장하는 8건을 통과했다. 바이너리 레코드와 HWPX XML의 필드 인수·시작 및 끝 표식을 독립적으로 검사했다. [파일 형식 검수](../apps/editor/scripts/verify-native-formula-fields.mjs)
- 자동 채우기는 Edge의 수동 대화상자에서 수식 문자열과 고정 계산값을 검사했다. Agent 채팅에서는 윤년 월말, 상대·절대 참조, 고정 계산값을 두 형식에서 각각 적용하고 되돌리기·다시 실행·저장·재열기까지 6건을 통과했다. 채팅 검수에는 로컬 모의 제공자를 사용했다. [대화상자 검수](../apps/editor/scripts/verify-table-date-fill.mjs) · [Agent 채팅 검수](../apps/editor/scripts/verify-agent-fill-series.mjs)

한글 2024 직접 비교는 일괄 검수 대상으로 남겨 두었다. 현재 기능별 분모와 부분 상태는 종합표에 표시한다. [종합 진행표](jueony-progress.md)
