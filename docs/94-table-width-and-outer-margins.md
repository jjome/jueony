# 94. AI 열 너비 지정과 표 바깥 여백 저장

2026-10-14 시작, 2026-10-15 검증. [93번 저장 수정](93-storage-table-and-memo-ownership.md)을 포함한다. 전체 한글 기능 구현 완료나 독립 한글 동등성 검수 완료를 의미하지 않는다.

## 실제 추가한 명령

기존 45종 중립 명령의 `format_table_cells`에 `properties:{columnWidthMm:30}`을 추가한다. 새 종류의 명령이나 제공자 전용 편집 경로를 만들지 않는다. 단독 요청으로 실행하며 HWPX의 기존 본문 단순 표에서 **모든 행에 걸친 한 열 이상**을 선택한다. 선택한 각 열이 지정 너비를 가지며 다른 열과 셀 높이·내용·서식·안 여백은 유지한다. 한 열짜리 표도 지원한다.

```json
{
  "kind": "format_table_cells",
  "target": "s0p1t0",
  "startRow": 0,
  "rowCount": 3,
  "startColumn": 1,
  "columnCount": 1,
  "properties": {"columnWidthMm": 30}
}
```

실제 조회된 ID와 행 수를 사용해야 한다. 1~500mm를 정수 HWPUNIT로 반올림하고, 활성 좌우 안 여백보다 큰 내용 폭을 요구한다. 단일 단·문단 기준 왼쪽 배치만 지원한다. `equalColumnSources[target].directWidth.maxTableWidth`는 용지/방향/안쪽 여백·제본 여백·표 바깥 여백·가로 오프셋을 읽어 계산한 상한이다. 지정 결과의 전체 표 너비가 이 상한 이내여야 한다. 다단·절대/가운데 배치, 보호/병합/중첩/혼합 서식/필드/복합 원본은 지원하지 않는다.

동일 값·범위 오류·부분 행·다른 속성 혼합·별칭·묶음·매크로는 거절한다. 새 표 생성과 같은 요청에 묶지 않는다. 기존 너비 같게(`equalizeColumns:true`)는 선택한 열의 총너비를 보존하는 별도 모드로 유지한다. 제공자 공통 계약과 화면의 실제 지원 안내를 함께 갱신한다.

## 연결 경계와 보호

UI/Agent → 중립 wire/문서 도메인 계획 → 공개 facade → rhwp adapter → 기존 `resizeTableCells`의 방향을 유지한다. 도메인은 detached snapshot에서 순수 계획을 만들고 adapter는 실제 Native 내용·너비·보호·배치 fingerprint·용지/단을 다시 읽는다. 명령 적용 뒤 전체 문서 보존 증거에서 **선택 셀 너비와 그 합에 따른 표 공통 너비**만 바뀌어야 한다.

실제 table/text layout을 저장 재열기와 비교하고 기존 엄격 렌더 callback에서 결과 조회까지 끝난 뒤 요청 이력을 확정한다. 실패하면 snapshot 전체를 복원한다. 지연 응답 중 사용자 수정, 부분 적용·거짓 성공·이웃 셀 오염을 허용하지 않는다. 현재 셀 커서와 요청 단위 undo/redo·미저장 복구·안전한 저장은 기존 경로를 사용한다.

## 함께 발견해 수정한 저장 결함

표 바깥 여백 setter가 optional raw CTRL 캐시가 있을 때만 `common.margin`을 갱신하고, 실제 paint/HWPX writer가 소비하는 `table.outer_margin_*`는 남겨 두었다. HWPX처럼 캐시가 없는 원본에서는 수정 자체가 반영되지 않았고, HWP에서는 즉시 화면과 재열기 위치가 달랐다.

새 추적 패치 `table-outer-margin-owner`는 네 방향의 실제 모델 값과 공통 개체 값을 함께 갱신하고, raw 캐시는 있을 때 범위 검사 후 갱신한다. raw 캐시 유무가 편집 권한이 되지 않는다. 저장기·좌표·보존 허용 오차를 바꾸지 않는다. 기존 표/셀 속성 대화상자에서 취소·적용·undo/redo·재열기를 확인한다.

## 실행·검증·한계

새 검수 실행기: `build/jueony-save-table-controls-20261015/Start-Review.cmd`, 포트 `4314`. 기존 사용자 서버와 원본은 유지한다. 정확한 최종 엔진/소스 해시와 검사 수는 `docs/evidence/save-table-controls-2026-10-14/verification-summary.json`을 따른다(증거 폴더 날짜는 작업 시작일).

검사는 실제 WASM의 단일 열/여러 열/표 전체·긴 문장 폭 왕복·다른 표·뒤 구역·한 열짜리 표·상한/보호/오래된 snapshot·실패 원복, 실제 Edge의 네 합성 제공자 채팅·비교·undo/redo·저장·문서 소유 Canvas 메트릭으로 재열기를 포함한다. 합성 제공자 프로토콜 검사는 실제 계정/유료 모델 호출 성공과 구분한다. 새 바깥 여백 Native 반례 네 개는 이전 엔진에서 모두 실패한 동일 기준으로 검사한다.

남은 우선순위:

1. 행 높이 균등 분배와 직접 지정의 Agent 계약·최소 높이/내용 높이·저장 일치.
2. 수동으로 이미 가능한 셀 병합/분할·행/열 고급 편집의 Agent 대상/토폴로지 계약과 요청 원복.
3. HWP 겹침 허용 후속 표, 공개 형식 변환의 필드·개체 차이와 복합 문서 보존.
4. 고급 계산식·표/개체 배치와 나머지 문서화된 편집 기능. 독립 한글 2024 비교는 마지막 일괄 검수.

일반 HWP의 Agent 크기·안 여백 제한, 높이/병합/중첩 미지원은 유지한다. 전체 범위가 미완료이므로 기존 자동화를 유지한다.

최종 검사: 단위 710·provider/server 52·관련 실제 WASM 178·Edge 161 통과. 새 바깥 여백 4개는 이전 엔진 4실패→수정 후 4통과, 너비 Native 12개/실제 통합 Edge 18개를 포함한다. TypeScript와 9개 모듈/284개 소스 경계, 예상 밖 page/console 오류·외부 요청 0건을 확인했다. 최종 엔진 `424262393ae01deb`, WASM SHA-256 `d63becfd91d3094f6df4a88ed0aaf50996b3a4d82cb69bd5ae5742a99f266169`, 앱 소스 SHA-256 `b1c4f1c87608c1f4c8addc07db57f5fb6ffcde22c205b431d5d11bd41a530b49`. 실제 4314 실행 서버의 자산·중립 wire/provider 계약을 확인했다. 공개 코퍼스 10출력 중 보존 검사 6건 통과/4건 차단을 유지한다. [검사 집계](evidence/save-table-controls-2026-10-14/verification-summary.json), [실제 실행 대조](evidence/save-table-controls-2026-10-14/launch-check.json)를 따른다.
