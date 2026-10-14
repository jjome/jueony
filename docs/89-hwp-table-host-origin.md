# 89. HWP 표의 편집 후 시작 위치 보정

2026-10-14. 88번에서 발견한 HWP 셀 안 여백의 편집/저장 재열기 차이를 추적했다. 단순 표 사례에서 셀의 줄 메트릭과 행 높이는 같았지만 **표 전체의 원점이 3.8px 이동**했다. 단순 본문만 있는 비분할 표의 빈 앵커를 편집한 뒤에는 저장 흐름 원점을 사용할 수 없어, 위쪽 바깥 여백을 소비하는 공통 배치 계획이 빠지고 다른 paint 경로를 탔다.

## 수정과 경계

새 `zzzzzzzzzzzzzzzzzzzz-whole-table-edited-host.patch`는 기존 `saved_whole_empty_table_anchor` 계약을 만족하는 표가 현재 흐름 원점으로 배치될 때도 동일한 formatted box를 사용한다. 저장된 원점을 무조건 신뢰하거나 줄 정보를 삭제하지 않는다. 문단 속성/본문/개체 순서와 선언 크기를 변경하지 않으며 좌표 clamp나 특정 문서/픽셀 보정을 추가하지 않는다.

생산자는 `float_placement.rs::from_empty_reflow_host`다. `typeset/table/host_spacing.rs`의 before/after는 바깥 여백을 포함하며, `typeset/table/block/entry.rs`가 이 계획의 occupied_bottom으로 실제 fit을 판정하고 같은 paragraph_float_placements를 발행한다. `prepare.rs`는 첫 조각에서 shared formatted box를 보존한다. `layout.rs`의 table_y_start와 layout_table 호출은 확정된 같은 table_top을 사용하여 위쪽 바깥 여백을 다시 더하지 않는다. 유효한 저장 원점과 편집 후 현재 흐름 원점의 차이를 여백 소유 규칙의 차이로 바꾸지 않는다.

새 엔진은 `source-7a2fb1cfb7db3b64/pkg`이며 고정 MIT 참조 소스는 수정하지 않았다. 이전 570603 엔진과 실행 창은 유지한다. 이번 변경은 Native 배치 경로 수정이며 Agent 명령 종류는 45개 그대로다.

## 실제로 통과한 범위

이전 엔진의 동일 검사에서 HWP 5개가 실패하고 HWPX 5개가 통과했다. 새 WASM에서 10개 모두 통과했다. 짧은/긴 여러 줄/빈 셀, 위·가운데·아래 정렬, custom 및 표 기본값 복귀, 세로 값만 변경, 0 기본값의 단순 글자 셀을 검사했다. 전체 쪽의 실제 control/text layout, 본문과 서식·테두리·저장 크기 등의 보존, snapshot 원복과 같은 편집 재실행의 저장 결과를 비교했다. 특정 y를 정답으로 고정하지 않고 실제 live/재열기 구조·쪽·좌표 관계를 검사한다.

단위 695·provider/server 52·관련 WASM 124·Edge 126, TypeScript와 9개 모듈/281개 소스 경계 검사 통과. 신규 Native 기본 검사 10개 외에 기존 안 여백 13/Edge 13과 여러/첫 제목 행·보호·쪽 나눔·변환·선택 개체·스타일/다음 스타일 관련 회귀를 실행했다. 예상 밖 page/console 오류와 외부 자산 요청은 0건이다. [검사별 결과](evidence/cell-padding-hwp-2026-10-14/verification-summary.json)를 따른다. 기존 전체 편집기 누적 검사를 모두 실행한 수치는 아니다.

## 남은 HWP 오류와 보호

확장 Native 진단 2개는 여전히 미해결이며 통과 수에 포함하지 않는다.

| 사례 | 확인된 차이 | 상태 |
| --- | --- | --- |
| 여러 비분할 표 | 두 번째 표 y: live 242 / 재열기 178.7 | UNRESOLVED_NATIVE_DIAGNOSTIC |
| 0 기본 여백 + 다른 셀의 12pt 모양 | 표 높이: live 67.5 / 재열기 61.6 | UNRESOLVED_NATIVE_DIAGNOSTIC |

수치는 재현 관찰이며 독립 한글 정답이 아니다. 후속 표의 저장 앵커 사다리와 실제 현재 흐름, 비활성 여백/저장 줄 높이의 측정·paint 경로를 다음으로 추적한다. 처음의 3.8px 차이를 모든 HWP 저장 문제의 원인으로 일반화하지 않는다.

따라서 **정상 HWP 파일의 AI 안 여백은 계속 읽기 전용**이다. HWPX는 기존 지원 범위와 실제 저장 사본 배치·보존 검사로 동작한다. 파일 이름만 다른 입력도 실제 형식 변환/지문/preflight/배치 검사를 거쳐야 하며, 새 엔진에서는 최초 단순 Native 차이가 해결되었으므로 이름을 바꾼 모든 HWP가 반드시 배치 오류로 거절된다고 주장하지 않는다. 배치를 실제로 오염시킨 이름 변경 입력의 실패 원복은 Native/Edge에서 확인했다. 지원 표시와 오류 안내는 현재 남은 후속 표/행 높이 문제를 반영한다.

[기존 88번 실패 증거](evidence/cell-padding-2026-10-14/cell-padding-native/diagnostic-hwp/observation.json)는 보존한다. 새 Native 진단 문서는 성공 Agent 출력과 구분한다. [2개 미해결 증거](evidence/cell-padding-hwp-2026-10-14/native/result.json), [이전 엔진의 5개 실패](evidence/cell-padding-hwp-2026-10-14/before-engine.json)를 참고한다. 과거 실패/중간 시험 파일도 출력 목록에서 진단용으로 분리한다.

## 실행·독립 검수

검수본: `build/jueony-cell-padding-hwp-20261014/Start-Review.cmd`, `http://127.0.0.1:4306/`. [파일 목록과 한글 확인 순서](evidence/cell-padding-hwp-2026-10-14/documents.json)를 따른다. 사용자 원본을 덮어쓰지 않으며 기존 4304/4302 등은 종료하지 않는다.

WSL release WASM을 실제로 새 빌드했다. 네 provider는 합성 프로토콜이며 유료 호출·한글 2024 직접 조작/독립 출력 비교·Native Rust unit suite는 미실행이다. 전체 표 서식·병합/복잡한 표·모든 한글 동등성은 미완료이며 자동화는 유지한다.

구현 `4eab9c7` 푸시 완료. 최종 LF 패치 입력과 Git blob이 바이트까지 같으며 새 빌드 JS/WASM은 앞서 회귀 검사를 수행한 바이너리와 동일하다. [바이너리/패치 대조](evidence/cell-padding-hwp-2026-10-14/binary-identity.json)를 보존했고 핵심 Native/Edge를 최종 입력에서 다시 실행했다. WASM SHA-256 `16ce4091a0121e47dbcabb9bc4b0caaf5edea6530ff7fe0a8b60e3ffe0203c07`, 앱 소스 SHA-256 `e81f3d5b737f80f79026c48a1be9b818eb3a9eaa4cef3d90446fadc86cf46512`. [실제 4306 서버 대조](evidence/cell-padding-hwp-2026-10-14/launch-check.json)를 확인했다.

후속: [90번](90-table-default-padding-reflow.md)은 표 기본 여백 변경의 저장 줄 갱신과 유효 기하 변경 후 초기 행 배분 캐시의 무효화를 추가했다. 위 0 기본 여백 진단은 새 엔진에서 일치한다. 과거 실패 증거는 보존하며 여러 표의 후속 앵커 문제와 정상 HWP Agent 안 여백 제한은 남는다.
