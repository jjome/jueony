# 91. Agent 표 열 너비 균등 분배와 결과 확인의 원자성

2026-10-14. 기존 수동 ‘셀 너비를 같게’의 실제 `resizeTableCells` 경로를 Agent에 연결한다. 엔진 패치를 추가하지 않고 90번의 `source-3cb8152e4498fbbb/pkg`를 재사용한다. 전체 한글 기능 구현 완료가 아니다.

## 지원 계약과 모듈

기존 45종 계약의 `format_table_cells`에 `properties:{equalizeColumns:true}`를 추가했다. `equalColumnSources[target].editable`이 참인 기존 HWPX 본문 단순 표에서만 요청한다. `startRow:0`, `rowCount:표 전체 행 수`, `startColumn`, `columnCount:2 이상`으로 연속한 열 전체를 지정한다. 예: “이 표의 두 번째와 세 번째 열 너비를 같게 해줘.” 한 요청에 하나의 명령만 사용하며 다른 서식·신규 표 별칭·매크로·자동 저장과 묶지 않는다. 요청 적용 후 파일 저장은 사용자가 실행한다.

선택한 열의 총너비를 정수 HWPUNIT으로 보존한다. 나눈 나머지는 앞 열부터 1단위씩 배분한다. 행마다 열 너비가 같은 200셀 이하의 격자만 지원한다. 병합·중첩·보호·혼합 서식·필드·세로 글씨·캡션·글자 취급·겹침·복합 원본과 저장 격자가 어긋나는 표는 거절한다. 균등 분배 후 유효 내용 폭이 안 여백보다 커야 한다. 이미 균등한 경우 변경 없는 undo 이력을 만들지 않는다.

- Document Domain `equal-columns.ts`: 범위, 정수 분배, 양수 내용 폭과 무변경 검증. Native API를 알지 않는다.
- 공개 DTO `equalColumnSources`와 `engine-integration` facade: 현재 원본의 eligibility/fingerprint와 검증된 계획을 전달한다.
- rhwp Adapter `equal-columns.ts`: 실제 Native 원본·보호 상태를 다시 읽고 배치 크기 명령을 실행한다. 요청한 셀 width만 바뀌었는지 전체 보존 증거를 비교한다.
- `table-layout-evidence.ts`: 기존 안 여백 검사의 실제 셀/글줄 배치 읽기와 저장 사본 비교를 공용화한다. 기존 검사와 0.2px 응답 반올림 한도는 그대로 유지한다.
- 편집기 Bridge: 요청 snapshot/undo·redo, 커서 유지, 실제 화면 렌더와 결과 확인을 담당한다. UI 비교에는 저장 셀 너비를 표시한다. 네 provider는 같은 중립 계약을 사용한다.

본문·셀 텍스트, 글자/문단 서식, 배경·경계선, 안 여백, 저장 높이, 표 총너비, 선택 밖 열과 다른 표·공유 자원을 유지한다. 폭이 바뀐 내용의 줄바꿈과 실제 행 높이는 기존 엔진이 계산한다. 저장 재열기의 실제 대상 표/글줄 배치가 다르면 적용을 취소한다. 파일 확장자를 바꾸더라도 실제 보존·저장 배치 검사는 유지한다.

## 검사 중 발견한 실패와 수정

긴 문장을 좁은 첫 열에 넣은 입력은 순수 Native 저장/재열기에서는 통과했지만 실제 Edge의 Canvas 화면 재배치 뒤 `getPageOfPosition(0,2)`가 “문단이 페이지에 없습니다”를 반환했다. 뒤따르는 빈 본문 문단의 페이지 매핑 문제는 **미해결**이다. 이 입력을 Agent 성공 출력으로 분류하지 않는다.

기존 Bridge는 렌더 성공 후 history를 커밋하고 나서 `readStructure`로 결과를 읽었다. 이 마지막 조회가 실패하면 이미 적용된 명령을 `PartialApplyError`로 보고하고 후속 Agent 작업을 막았다. 결과 구조 확인을 `executeDocumentAgentOperation`의 엄격 렌더 callback 안으로 옮겼다. 결과를 확인하지 못하면 기존 snapshot rollback 경로를 거쳐 문서·dirty·이력을 복원한다. Native 문자열 오류도 일반 “적용 실패”로 버리지 않고 보존한다. 페이지 매핑 보호를 제거하거나 없는 페이지 번호를 만들어 넣지 않는다.

동일 긴 표 입력에서 실제 채팅 오류 표시·원본 bytes/revision/dirty/이력 유지·다음 요청 성공을 검사한다. Native의 긴 문장 성공은 Native 범위의 증거이며 화면 조판 문제 해결로 환산하지 않는다. 실패 당시 원래 호출 경로는 `diagnostics/before-receipt-guard.json`에 보존한다. 이전 검사 중 실패 화면은 진단 자료이며 최종 성공 화면으로 배포하지 않는다.

## 실행과 남은 범위

검수 실행기: `build/jueony-equal-columns-20261014/Start-Review.cmd`, 별도 포트 `4310`. 원래 4260 및 4308 등 기존 실행 창과 원본 문서는 유지한다. 다른 포트는 별도 origin의 업무 저장소를 사용한다.

검수 입력/결과는 실행 묶음의 `review-documents/equal-columns/`에 모은다. `native/equal-whole.hwpx`, `equal-band.hwpx`와 브라우저 `equal-ui-reopen.hwpx`를 실제 한글 2024에서 열어 열 너비·총너비·본문·배경·글자 모양을 확인할 수 있다. `unsupported-source.hwp`는 성공 결과가 아니라 보호 입력이다.

HWP AI 크기 편집, 행 높이 균등 분배, 직접 너비/높이 지정, 병합·복합 표와 정확한 한글 조판은 후속 작업이다. 긴 표의 Canvas 페이지 매핑과 기존 여러 HWP 표의 후속 앵커 문제를 함께 추적한다. 한글 직접 비교, 실제 유료 모델 호출과 Native Rust unit suite는 이번에 실행하지 않는다. 전체 문서화된 범위가 미완료이므로 자동화를 유지한다.

최종 자동 검사 수치·소스 해시·실제 실행 묶음 대조는 같은 증거 폴더의 `verification-summary.json`을 따른다. 기존 전체 편집기의 역사적 누적 사례를 모두 재실행한 수치로 표시하지 않는다.
