# A 기능·단축키 감사 및 첫 수정

기준: Jueony `e53e3e47546e81b9efad36d030627175c7108372`, rhwp 소스 `1a76570e833917d15817415a53c09ad61ab3203f`, 2026-10-11. 이 문서는 제품 전체 구현 완료 보고가 아니다.

## 조사 범위와 판정

[feature-audit.csv](feature-audit.csv)는 공식 한글 2024 메뉴와 단축키를 출발점으로 만든 **1차 182개 기능 묶음**이다. 앱에 없는 기능도 포함했다. 71 WIRED, 33 PARTIAL, 4 STUB, 74 MISSING이다. WIRED는 실행 명령이나 엔진 경로가 있다는 정적 판단이며 같은 동작·파일 호환성 PASS가 아니다. MISSING은 현재 통합 앱에서 요구 기능의 실행 경로를 찾지 못한 상태이며, Rust 파일 포맷 표현 능력 전체가 없다는 뜻은 아니다.

범용 이름으로 묶은 사전·XML·메모·입력 옵션, 각 대화상자의 모든 탭/기본값/활성 조건, 우클릭 메뉴와 예외 문맥은 아직 개별 case로 확장하지 못했다. 182를 한글 기능 전체 분모로 쓰지 않는다. 기존 AI 68행과도 서로 다른 목록이다. 파일·개체 보존은 C, 상태 계약은 B와 통합한다.

참조 환경에서 확인된 제품은 **한컴오피스 Viewer 13.0.0.387**이며 한글 편집기 조작 대조는 불가능하다. 따라서 182행 비교 결과를 모두 `BLOCKED_REFERENCE`로 남겼다. 아래 Node 검사는 앱 키 해석/선택 adapter 검사일 뿐 한글 편집기 비교가 아니다. 한글의 동작이 도움말과 불일치할 수도 있는 미세한 선택 단계·다중 범위 동작은 실측 전 완전 호환이라 표시하지 않는다.

## 확인한 차이

| ID | 기준과 현재 차이 | 증거·재현 | 처리 |
|---|---|---|---|
| A01 | 셀 블록 F7이 칸 선택 대신 편집 용지로 해석됨. F8 행 선택은 없음 | keymap의 document F7만 존재. 표에서 F5 후 F7/F8 | 셀 scope 명령을 먼저 선택하도록 두 개 등록. 기존 cursor capture/restore를 써 내용·undo와 분리 |
| A02 | Ctrl+F는 탐색 작업 창이어야 하나 찾기 대화상자을 열었음 | keymap Ctrl+F → edit:find; edit.ts FindDialog | 탐색 엔진/작업창이 없어 `pending:navigation-pane`로 분리하고 미지원 및 Ctrl+Q,F 대안 안내. 찾기 대화상자은 정상 유지 |
| A03 | Ctrl+F1 기존 도구상자 명령이 Jueony 키 목록 교체 과정에서 사라짐 | install.ts defaultShortcuts.splice; upstream view:toolbox-basic 존재 | 같은 canonical 명령을 명시적으로 Jueony 목록에 추가. 한글의 모든 단계별 접기와 같은지는 별도 미검증 |
| A04 | F3 반복 선택 단계가 공식 도움말과 다름 | 엔진 input-handler-keyboard.ts:1103 첫 F3부터 expandSelection 호출, cursor.ts:1606 단어→문장→문단→구역→전체. 도움말은 초기 블록 후 단어/문단/전체 | 미수정. 한글 편집기 실제 선택 단계와 anchor 확인 후 엔진 overlay 설계 |
| A05 | Ctrl+N,H/P는 pending이며 메뉴에서 머리말/꼬리말 개별 생성과 새 번호만 제공 | keymap의 pending:header-footer-dialog/page-number-dialog | 다른 기능으로 대체하지 않음. 통합 대화상자 옵션·적용 범위 구현 필요 |
| A06 | 단 설정 나누기 키가 현 구역 단 설정 대화상자만 열음 | Ctrl+Alt+Enter → page:col-settings → ColumnSettingsDialog(sectionIndex) | 미수정. 구역/다단 경계 의미와 저장 영향 검증 뒤 연결 |
| A07 | 셀 L/C/B/F 및 계산식 Ctrl+N,F 등 명령/메뉴가 있어도 키 연결이 빠짐 | table:border-each, table:border-one, table:formula 등록 대비 keymap 부재 | 후속 키·대화상자 초기 탭 매개변수 연결 필요 |
| A08 | 보안 탭은 빈 안내이며 환경·검토·사전·매크로 등 넓은 미구현 범위 존재 | chrome-2024.ts security:[]; command registry와 공식 메뉴 대조 | 감사 목록에 유지. 구현 완료처럼 노출/보고 금지 |
| A09 | 본문 전용 커서 이동·삭제 명령이 표/머리말/각주에서 무동작 | install.ts bodyOnly canExecute 제한 | 미수정. 해당 컨테이너 경로에 같은 의미로 연결 후 위치/undo 검사 필요 |

A04는 독립 참조 문서의 차이이며 실제 한글 실행으로 검출한 결과가 아니다. 공식 쪽 메뉴의 구역 나누기 키와 단축키 일람 표기에도 상충이 있으므로 복사해 매핑을 확대하지 않았다.

## 수정 파일과 설계

- `apps/editor/src/shortcuts/keymap.ts`: 셀 F7/F8, 탐색과 찾기 분리, Ctrl+F1 보존.
- `apps/editor/src/shortcuts/cell-band.ts`: 선택만 변경하는 adapter. 현재 표의 크기를 다시 읽고 nested cellPath를 유지한다. 유효하지 않은 좌표/행열수는 거부한다. 전체 줄·칸 선택 후 표시 갱신과 문서 포커스를 복원한다.
- `apps/editor/src/shortcuts/install.ts`: 기존 명령 dispatcher에 두 선택 명령 등록, Ctrl+F 미지원 안내.
- `apps/editor/tests/hangul-shortcuts.test.ts`: 문맥 우선순위, 분리 매핑, 중첩 경로, 역방향 범위, stale 범위, 선택 실패 시 비변경 검사.

upstream 단축키를 통째로 병합하면 이미 제거한 Ctrl+Y→redo, Alt+Shift+C→가운데 정렬 등 한글과 다른 바인딩을 되살리므로 유지하지 않았다. 검증된 Ctrl+F1만 canonical 목록에 재등록했다. 따라서 전체 명령/shortcutLabel 일치에 대한 후속 감사는 계속 필요하다.

셀 선택은 현재 블록의 다른 축을 유지해 선택한 칸/줄 전체로 확장한다. 다중 선택·병합 셀의 독립 한글 결과와 시각 강조 표시는 실제 편집기 대조가 남았다. 이번 코드는 조판·문서 내용·직렬화를 수정하지 않는다.

## 실행 검증

명령: `node --experimental-strip-types --test apps/editor/tests/hangul-shortcuts.test.ts`

- 수정 전: 기존 6개 PASS, 새 회귀 3개 FAIL. A01은 `file:page-setup` 오선택, A02는 `edit:find` 오선택, A03은 바인딩 없음으로 각각 실패.
- 수정 후: 총 12개 PASS, 0 FAIL. [검사 출력](shortcut-tests.tap).
- 공용 `.build`/dist/사용자 앱 4173/원본 문서/DB/키에는 이 작업자가 접근해 변경하지 않았다. 통합 담당에게 다음 브라우저 검사 요청.

1. 합성 3×3 표 중간 셀에서 F5→F7: 세로 3셀만 선택, page setup 모달 없음.
2. 선택 초기화 후 F5→F8: 가로 3셀만 선택. 내용·revision·dirty 불변.
3. 본문 F7: 기존 편집 용지 대화상자 열림. Escape 취소 후 입력 위치 유지.
4. Ctrl+F: 미지원과 찾기 대안 안내. Ctrl+Q,F: 기존 찾기 대화상자.
5. Ctrl+F1: 기존 기본 도구상자 표시 변경. 모달/채팅 입력에서는 문서키 가로채기 없음.
6. 중첩 표에서 같은 선택이 바깥 표를 선택하지 않는지 및 저장 원문 byte 불변 검사.

## 기준 출처

- [공식 단축키](https://help.hancom.com/hoffice130/ko-KR/Hwp/view/toolbar/shortcut(table).htm)
- [셀 블록 F7/F8](https://help.hancom.com/hoffice130/ko-KR/Hwp/table/table(cell).htm)
- [탐색 작업 창](https://help.hancom.com/hoffice130/ko-KR/Hwp/view/workwindow/workwindow(find).htm)
- [파일](https://help.hancom.com/hoffice130/ko-KR/Hwp/menu/file.htm), [편집](https://help.hancom.com/hoffice130/ko-KR/Hwp/menu/edit.htm), [보기](https://help.hancom.com/hoffice130/ko-KR/Hwp/menu/view.htm)
- [입력](https://help.hancom.com/hoffice130/ko-KR/Hwp/menu/insert.htm), [쪽](https://help.hancom.com/hoffice130/ko-KR/Hwp/menu/Page.htm), [표](https://help.hancom.com/hoffice130/ko-KR/Hwp/menu/table.htm)
- [보안](https://help.hancom.com/hoffice130/ko-KR/Hwp/menu/security.htm), [검토](https://help.hancom.com/hoffice130/ko-KR/Hwp/menu/review.htm), [도구](https://help.hancom.com/hoffice130/ko-KR/Hwp/menu/tools.htm)

기능명과 키 조합만 메타데이터로 사용하고 본문 설명·화면 자산을 복제하지 않았다.

추가 A10: `table:cell-height-equal` / `table:cell-width-equal`은 upstream table.ts:969~980에 `execute() {}`로 등록되어 있었다. 기능표를 STUB로 정정하고 install.ts에서 canonical registry의 canExecute를 false로 설정해 메뉴·리본·자동화가 실행 성공을 보고하지 못하게 했다. 단축키 안내에도 미지원으로 표시하며 H/W 입력은 미지원 안내를 띄운다. 실제 균등 구현은 후속 작업이다.

통합 E2E 준비: `apps/editor/scripts/verify-parity-shortcuts.mjs`는 `evidence/dist-parity`를 읽고 4199 포트와 새 Edge 프로필만 사용한다. 테스트 시작 위치는 기존 자동화 host의 내부 서비스에서 설정하고 이후 입력은 Puppeteer 키 이벤트를 통해 실행한다. 행/열 선택 강조·범위·dirty/revision/직렬화 byte 비변경, 본문 F7, 찾기/탐색 분리, Ctrl+F1 및 빈 명령 차단을 검사한다. 실제 OS IME 및 한글 편집기의 독립 비교 검사는 포함하지 않는다.
## 통합 브라우저 검수 완료

`node scripts/verify-parity-shortcuts.mjs`를 `apps/editor` 디렉터리에서 실행한 결과 **8개 검사 PASS**, page error 0, 외부 요청 0. [실행 결과](shortcuts-browser-results.json)에 고정 editor.html SHA-256을 기록했다. 현재 확인은 테스트 harness로 초기 커서를 위치시킨 후 headless Edge 키 이벤트·실제 엔진·실제 DOM 강조·직렬화 결과를 검사한 범위다.

- 3×3 표의 가운데 셀에서 F5→F7이 가운데 세로 3셀, 별도 초기 상태 F5→F8이 가운데 가로 3셀을 선택했다.
- 선택 동작 전후 dirty·revision·HWPX byte hash가 같았다.
- 빈 균등 명령은 자동화에서 disabled로 거절되고 H/W에서 미지원으로 표시됐다.
- 본문 F7과 취소, 탐색 미지원 안내, Ctrl+Q,F 찾기 창, 찾기 입력창의 Ctrl+Y 비개입, Ctrl+F1 토글이 작동했다.

첫 실행의 표 resultId 누락과 다음 실행의 찾기 DOM selector 오기는 검수 스크립트 설정 오류였다. 필수 resultId와 실제 `.find-dialog` 클래스를 사용하도록 스크립트만 수정해 재실행했다. 수정 전 제품 결함 회귀 3건과 혼동하지 않는다. 화면 캡처 및 HWP/HWPX 합성 표본은 `apps/editor/evidence/shortcuts-parity/`에 있다. 중첩 표는 단위 adapter 검사만 실행했고 headless DOM·실제 한글 편집기 비교는 남았다.