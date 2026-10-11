# 기본 편집 동작 보강 — 2026-10-11 자율 후속 작업

기준 코드 06f5a39의 차단된 Ctrl+F 탐색 창과 셀 높이/너비 같게 명령을 실제 편집기 명령으로 구현했다. 이 문서는 구현·브라우저 검증의 결과이며 한글 2024 전체 동등성 판정이 아니다. 한컴 편집기는 설치되어 있지 않으므로 실제 한글의 화면·물리 단축키·IME·저장 재열기 비교는 **BLOCKED_REFERENCE**다.

## 구현과 경계

| 기능 | 구현 상태 | 지원 범위와 제한 |
|---|---|---|
| Ctrl+F 탐색 작업 창 | PARTIAL / 실제 동작 검증 | 오른쪽에 도킹, 현재 열린 문서의 미저장 본문·표 텍스트 검색. 결과 목록/건수/앞뒤 이동/대소문자 구별/지우기/닫기. 원래 Ctrl+Q,F의 떠 있는 찾기는 유지한다. |
| 검색 문맥 | 구현 | 현재 WASM 문서만 읽는다. 문서 변경 시 결과 좌표를 즉시 폐기하고 갱신한다. 문서 교체 시 질의와 결과를 비운다. 질의는 디스크에 저장하지 않는다. |
| 중첩 표 검색 | 코드·단위 검증 | 엔진의 cellPath를 잃지 않고 커서와 발췌에 전달한다. 실제 중첩 문서 전체 회귀는 아직 실행하지 않았다. |
| 미지원 검색 | 명시 | 개체, 수식 원문, 머리말/꼬리말/주석, 공백 무시·정규식 등의 고급 조건은 제공하지 않는다. 200개까지만 DOM에 표시하되 이전/다음으로 전체 텍스트 결과에 도달할 수 있다. |
| W 셀 너비 같게 | PARTIAL / 실제 동작 검증 | 병합 없는 규칙 표에서 두 개 이상 칸을 모든 줄에 걸쳐 선택. 선택된 전체 칸의 합계 너비를 정수 HWPUNIT으로 균등 배분하며 나머지 칸은 보존한다. |
| H 셀 높이 같게 | PARTIAL / 실제 동작 검증 | 병합 없는 최상위 표에서 두 개 이상 줄을 모든 칸에 걸쳐 선택. 표 외곽 높이의 여유분이 있으면 전체 셀 선택이 필요하다. 중첩 표 H는 차단한다. 내용이 많은 셀은 엔진의 최소 내용 높이 때문에 늘어날 수 있다. |
| 불가 문맥 | 구현 | 일부 셀만 선택·불연속 선택·병합 셀·서로 불일치하는 저장 격자·보호 셀·잘못된 선택은 사전 거부한다. 선택 범위를 조용히 넓혀 다른 셀을 수정하지 않는다. |
| undo/redo/실패 복원 | 실제 동작 검증 | 한 명령당 기존 snapshot history 한 단계. 이미 같은 크기라면 변경·revision·undo를 만들지 않는다. 두 번째 셀 변경을 실패시킨 주입 검사에서 첫 셀 변경까지 복원했다. |
| 통합 UI 접근 | 연결 | `ext:jueony-navigation-pane`, `ext:jueony-shortcut-help`를 공통 command registry에 노출. host가 `data-unified-chrome=true`를 설정하면 child의 중복 제목/메뉴/리본/빠른도구를 숨긴다. 독립 편집기는 원래 UI를 유지한다. |

## 발견하고 수정한 엔진 제약

rhwp의 두 같게 명령은 빈 execute와 비활성 gate였고, 단순 연결은 기능 구현이 아니었다. 기존 `resizeTableCells`로 높이를 바꾸면 저장된 height는 같아지지만 `table.common.height`의 여유분을 보존하여 마지막 줄이 더 높게 남았다. 최초 E2E는 이 차이를 실제 셀 bbox와 스크린샷으로 검출했다.

H는 외곽 높이의 여유분을 포함한 유효 줄 크기를 계산하고 `setCellProperties`의 절대 높이 경로를 snapshot 하나 안에서 적용한다. 10,200 HWPUNIT 표에서 저장 외곽 높이를 유지한 채 9셀의 실제 bbox 높이를 모두 45.3px로 맞췄다. W는 기존 벡터 변경 경로를 사용한다. 평균 분배 및 1 HWPUNIT 이하 정수 나머지 처리는 제품의 현재 정책이며 실제 한글의 모든 반올림/병합 규칙을 실측했다는 뜻은 아니다.

## 검증 결과

- 단위 검사 18개 통과: 기존 단축키 12개 + geometry/search model 6개.
- 새 실제 엔진·headless Edge 검사 15항목 통과. 표 너비·높이, UI 버튼/단축키, 외곽 높이, undo/redo, 무변경, 부분 선택 거부, 실패 rollback, HWP/HWPX 재열기, 검색/대소문자/미저장 편집 갱신/문서 전환 초기화 포함.
- 기존 단축키 브라우저 회귀 8항목 통과: F5→F7/F8, 선택 시 dirty/revision/바이트 불변, 본문 F7, Ctrl+Q,F, Ctrl+F1 포함.
- 원격 네트워크 요청과 pageerror 0. 정적 서버는 4204, 격리된 새 Edge 프로필을 사용했다. 사용자 서버 4173/4190 및 사용자 문서를 건드리지 않았다.
- 검수 빌드: `apps/editor/evidence/dist-continuation` (root 통합 build/tsc 통과 후 고정). HTML SHA와 상세 항목은 JSON에 기록했다. 마지막 찾기 버튼의 줄바꿈 방지 CSS 한 줄은 통합 최종 빌드에 포함해야 한다.

실행:

```powershell
$env:JUEONY_PARITY_DIST='C:\Users\jjome\Documents\work\jueony\apps\editor\evidence\dist-continuation'
$env:JUEONY_PARITY_PORT='4204'
node apps/editor/scripts/verify-editor-actions.mjs
node apps/editor/scripts/verify-parity-shortcuts.mjs
node --experimental-strip-types --test apps/editor/tests/editor-actions.test.ts apps/editor/tests/hangul-shortcuts.test.ts
```

`equal-cells.hwp`와 `equal-cells.hwpx`는 직접 만든 검수 문서다. 실제 한글에서 열어 3×3 셀의 균등 너비/높이, 본문과 가운데 셀 문자열, 저장 후 재열기를 비교할 수 있다. 생성 문서만 포함하며 사용자 업무 내용은 없다. 시각 근거는 `apps/editor/evidence/editor-actions/{equal-cells,navigation-pane}.png`에 있다.

## 공식 기준과 남은 작업

2026-10-11 공식 도움말 재확인:

- [셀 높이를 같게 H](https://help.hancom.com/hoffice130/ko-KR/Hwp/table/table(eqheight).htm): 직사각형 셀 블록에 적용하는 기능.
- [셀 너비를 같게 W](https://help.hancom.com/hoffice130/ko-KR/Hwp/table/table(eqwidth).htm): 같은 직사각형 선택 제한.
- [탐색 Ctrl+F](https://help.hancom.com/hoffice130/ko-KR/Hwp/view/workwindow/workwindow(find).htm): 오른쪽 작업 창의 문자열/개체 검색과 결과 이동.

다음은 아직 남아 있다: 한컴 편집기와 실제 비교, 부분 직사각형/병합 셀의 독립 격자 변환과 저장 검증, 중첩 표 높이 setter, 내용이 높은 셀의 균등화 규칙, 개체·주석 검색, 찾기 고급 조건, 대형·중첩 문서 성능/접근성, 플랫폼별 물리 키·IME 검사. 이번 단계에서 이 항목을 완료로 바꾸지 않았다.
