# AI·참고 검색 제외 병렬 구현 기록 (2026-11-08)

이 문서는 AI 연결·Agent 실행과 참고 자료·검색·RAG를 제외한 편집기 병렬 작업의 검증 기록이다. 아래 항목은 제한된 범위만 완료로 표시하고 상위 N 작업은 남은 기능 때문에 `부분`으로 유지한다.

## 검증된 묶음

| 항목 | 구현·보호 범위 | 검증 | 남은 제한 |
|---|---|---|---|
| N011 | 평면 스타일 JSON 가져오기·내보내기·언어별 글꼴·이름 충돌·다음 스타일 순환·중간 실패 전체 롤백 | HWP/HWPX 저장·재열기를 포함한 `style-package.test.ts` 2/2 | 번호·개요·탭·테두리·배경·특수 영역·UI·Agent·한글 비교 |
| N013 | 기관 프로필 v1 검증·갤러리/번호키 충돌·손상/상위 버전/쓰기 실패 보호·정확한 이름 해석 | 프로필·기본 스타일 단축키 테스트 6/6 | portable package UI·Agent·한글 비교 |
| N014 / G091 | 단일 root Rectangle의 0~359° 정수 회전 커서·정/역방향 선택 복원·회전각 변경 시 stale 복원 차단 | 단위 9/9·실제 WASM HWP/HWPX 9/9 | 그룹·중첩·캡션·뒤집기·비-Rectangle·신규 Edge 빌드·한글 비교 |
| N015 | root vector shape 2~32개와 중첩 group 선택의 순서/활성 개체·소유 구조·개체/문서 지문·stale 차단 | 단위 5/5·실제 WASM HWP/HWPX 4/4·바이트 비변경 | 공유 SessionCursor·validator·Studio callback·wire 연결과 이미지/수식/OLE/표/특수 story·브라우저/한글 검증 |
| N016 | root-body 미주의 owner·note locator·3중 지문·Unicode 커서/방향성 선택·각주 분리 | 단위 6/6·실제 WASM HWP/HWPX 4/4·bytes 불변·stale 차단 | SessionCursor·Studio callback 연결·중첩/표/도형 note·필드/삽입 개체·브라우저/한글 검증 |
| N017 | stable 8개 설정 키의 scope·재실행·reset·dirty/undo·backup·validator 수명 계약과 문서/구역·임시 상태 분리 | 읽기 전용 audit 4/4·손상/상위 버전/읽기 실패 분류·쓰기 비발생 | Studio 전체 schema·backup 제외 정책·UI/시작 연결·실제 한글/Windows/origin/DPI 실측 |
| N018 | live atomic recipe의 프로세스/문서/버전/bytes/history top 결합·저장 실패 유지·검증된 rebase·재열기/복구/명명 이력/재시작 초기화 | 신규 5/5·문서 이력/복구 선별 포함 17/17 | 실제 InputHandler·save/recovery 연결·수동 편집·저장 frame·프로세스 재시작·한글 기준 |
| N004 | 10pt 1→2줄 혼합 그림·필드 셀의 source/run/cursor offset 일치·가운데 정렬 재조판·실패 시 exact rollback | HWP/HWPX 네이티브 저장·재열기·undo/redo·4개 fault rollback 및 Edge 실제 편집→bound-save→UI 재열기 | 임의 필드 경계·중첩 셀·복합 개체·한글 비교 |
| N012 | 저장 글자 스타일과 직접 서식 타입 분리·독립 charShape 소유·정의 변경 전파·중복/stale/race fail-closed | 실제 Rust HWP/HWPX 3/3·앱 경계와 범위 보호 7/7 | 새 WASM UI 스모크·공유 UI·Agent 연결·한글 비교 |
| N021 | 177개 단축키 감사·object > cells > table > document 우선순위·IME/repeat/도달성 회귀 보호 | 단축키 감사·기존 한글 단축키·navigation 34/34·TypeScript compile | pending 3건·머리말/각주/미주/글상자 story 정책·한글 비교 |
| N005 | 보이지 않는 0길이 이웃 ClickHere의 셀 분할 이동을 앱·Rust에서 차단하고 guide-only 0길이 필드는 유지 | HWP/HWPX 저장·재열기 2/2·관련 회귀 32/32 | 겹친 필드·개체 혼합 셀·캡션 내부 필드·한글 비교 |
| N011 추가 | 문단 테두리 동작 플래그 `borderConnect`·`borderIgnoreMargin`의 portable style 교환·전체 롤백 | HWP/HWPX 가져오기→저장→재열기 2/2 | TabDef·실제 BorderFill·배경·간격·UI·한글 비교 |
| N011 추가 | portable v1 문단 사용자 TabDef와 기본 없음/실선 BorderFill·없음/단색 배경·네 방향 간격을 엄격 검증하고 원본 참조 인증 뒤 이식; 실패 전체 snapshot 복원 | 최신 검수 엔진의 HWP/HWPX 저장·재열기·exact-byte undo·stale ID 불변·중간 실패 rollback 3/3 | **부분 유지:** 글자 스타일 BorderFill·번호/개요·점선/무늬/그러데이션/그림/3D/대각선/투명도·특수 영역·UI·Agent·한글 비교 |
| B031 | root-body 일반 문단의 `pghd` PageHide 조판 부호 한 종류를 위치·원문·revision·전체 문서 보존 상태 재검증 뒤 삭제하고 실패 시 snapshot 복원 | HWP/HWPX 저장·재열기·undo·stale/보호 실패 불변 4/4 | **부분 유지:** 다른 조판 부호·특수 story·종류별 UI·한글 비교 |
| N022 | 설치 한글 저장 증거 기준 Ctrl+F7 양쪽 여백 증가·Ctrl+F8 감소와 공개 표 차이 감사 | 문단 여백·IME·navigation 회귀 37/37·TypeScript compile | 공개 표와 설치본 차이의 근본 원인·한글 재비교 |
| N006 | 1문단·단일 글자 서식의 위/아래 중첩 표 캡션을 경로·원문·revision·보존 상태 재검증 후 교체 | HWP/HWPX 저장·재열기·undo와 음성 사례 3/3·회귀 4/4 | 빈/여러 문단·혼합 서식·좌우 캡션·필드·책갈피·개체·UI |
| N013 추가 | 프로필·항목·slot 계획·문서 style ID를 고정한 순수 preview와 snapshot apply controller | HWP/HWPX 저장·재열기·stale/충돌/중간 실패 복구 포함 9/9 | 전역 단축키 설정 저장·실제 UI·Agent·한글 비교 |
| N019 | 메뉴·리본·빠른 도구·문맥 메뉴의 정적 command reachability·중복·placeholder 감사 | N019 5/5·N021/N022 포함 15/15·TypeScript compile | `insert:comment`·`insert:para-band` placeholder·동적 disabled 정책·한글 비교 |
| N006 추가 | 최대 32문단의 위/아래 중첩 표 캡션에서 명시한 문단 하나를 경로·원문·revision·전체 문단 서식 재검증 후 교체 | HWP/HWPX 저장·재열기·undo 포함 5/5·회귀 4/4 | 빈 문단·혼합 글자 서식·좌우 캡션·필드·책갈피·개체 |
| N013 추가 | preview 증거를 재검증하는 원자적 번호키 설정 저장·손상/상위 버전/쓰기 후 실패 복구 | 저장 adapter 5/5·TypeScript compile | 실제 UI와 keymap 소비·Agent·한글 비교 |
| N021 추가 | Ctrl+-로 일반 본문 단일 문단·단일 char-run의 직접 서식을 문단 스타일 정의로 복원 | HWP/HWPX 저장·재열기·undo/redo 포함 14/14·TypeScript compile | 쪽 번호·매크로 pending·셀/특수 story·혼합 run·한글 비교 |
| N006 추가 | 기존 위/아래 캡션의 정확히 하나인 빈 문단을 검증된 path·문단/글자 서식으로 채움 | HWP/HWPX 저장·재열기·undo 포함 8/8·회귀 4/4 | 캡션 생성·여러 빈 문단·좌우·혼합 서식·필드·개체 |
| N013 추가 | 저장된 번호키 profile을 현재 catalog digest·ID·이름·종류·source에 맞춰 read-only resolve | HWP/HWPX 재열기 후보·bytes 불변·stale/충돌 포함 3/3 | post-apply digest 생산 연결·실제 keymap/UI·Agent |
| N021 조사 | Ctrl+N,P 쪽 번호 매기기와 기존 새 번호 시작 명령을 구분하고 현재 API 부재 확인 | 단축키 회귀 11/11·코드 무변경 | Rust PageNumberPos 원자 API·WASM bridge·대화상자·명령 연결 |
| N006 추가 | 단일 캡션 문단의 연속 2~128개 글자 run을 동일 길이 BMP 텍스트로 교체하고 기존 run 경계·charShapeId·위치·인접 중첩 표 배치를 보존 | 기본 엔진 fail-closed 2/2·Jueony 패치 엔진 HWP/HWPX 저장·재열기·undo 10/10·회귀 4/4·TypeScript compile | 길이 변화·surrogate/emoji·제어문자·좌우 캡션·필드·책갈피·개체 |
| N013 추가 | import 후 현재 catalog digest와 style ID·이름·종류·source를 원자적 shortcut 설정에 결합하고 저장 단계별 실패 상태를 rollback/applied/disconnected로 구분 | HWP/HWPX 재열기 consumer 연결과 실패 복구 14/14·TypeScript compile | 실제 keymap/UI·Agent·한글 비교 |
| N021 조사 | 한글 스크립트 매크로와 기존 AI 명령 템플릿을 구분하고 Studio command/input recording 계약 부재 확인 | 단축키 회귀 11/11·코드 무변경 | dispatcher 성공 이벤트·IME/선택 기록·recordable capability·revision preflight·단일 undo/부분 실패 rollback·녹화 UI/저장 |
| B046 | 앱 보기 설정 `pageOutline`·메뉴·상태바·탭 간 동기화와 page gap·canvas shadow를 단일 렌더 트랜잭션으로 토글 | HWP/HWPX 바이트 비변경·재열기·설정 backup·고정 upstream 통합 patch 11/11·격리 build·실제 Edge 메뉴/상태바/교차 탭 smoke | 빈 문서 stored-time 초기화 경고·한글 직접 비교 |
| B025 / B027 | Studio 머리말·꼬리말 선택에서만 내부 JSON·plain text clipboard payload에 문서 identity·story owner·revision·selection·원문을 봉인하고 copy/cut/paste를 단일 snapshot으로 실행 | HWP/HWPX 저장·재열기·undo·실패 rollback·OS clipboard 실패/불일치 차단 포함 12/12·hfclipboard 격리 build 661 modules | 각주/미주 원자 API·RTF·그림·전체 OS clipboard 형식·한글 비교 |
| B071 | 기존 category/scatter 차트의 단일 숫자 cache 값·단일 계열 이름·단일 범주명을 revision·원문·구조 재검증과 dry-run 뒤 교체하고 Studio 제목줄의 차트 데이터 창에서 실행 | 어댑터·Studio 명령 14/14·격리 build 663 modules·실제 Edge HWP/HWPX 값 편집→저장 바이트→UI 재열기·유형/축/범례/수식/unknown OOXML/비차트 자산 보존 | **부분 유지:** 다중 항목/계열·복합 label·수식 자체 변경·up/down bars·한글 비교 |
| N013 추가 | 저장된 Ctrl+1~Ctrl+0 slot만 기존 스타일 적용 명령으로 연결하고 IME·대화상자·표/개체/특수 story와 stale 설정을 차단; 설정 UI에서 표시·해제·초기화 | 통합 patch 보호·HWP/HWPX 저장·재열기·undo·stale 불변 3/3·격리 build·실제 Edge 설정창/단축키 smoke | 빈 문서 stored-time 초기화 경고·portable package UI·Agent·한글 비교 |
| 실행 기반 | 엔진 조건부 `DefaultTabSpacingDialog`가 없는 공식 npm build와 있는 custom-engine build를 구분하되 일반 Char/Para stale target 보호는 항상 유지 | patch seam 3/3·격리 전체 build 659 modules·N013/B046 marker·실제 Edge smoke 4건 확인 | 현재 공식 npm 엔진의 빈 문서 stored-time 초기화 경고 |
| B071 추가 | 단일 계열 이름과 공유 단일 범주명 cache 변경 시 원본 `c:f` 수식과 다른 범례·값·축·unknown OOXML·비차트 자산을 보존하고 실제 Studio UI를 같은 보호 계약에 연결 | HWP/HWPX 저장·재열기·undo·rollback과 UI 명령 포함 차트 전체 14/14·TypeScript compile | 다중 변경·복합 label·수식 자체 변경·한글 비교 |
| B025 / B027 조사 | 각주·미주의 읽기 API와 단일 문단 mutation은 있으나 원자적 선택 복사·다문단 치환 계약 부재 확인 | 코드 무변경 | Rust/WASM `copySelectionInNote`·`replaceRangeInNote`와 형식 재열기 계약 |

## 실행한 선별 검사

```text
node --test apps/editor/tests/style-package.test.ts apps/editor/tests/style-gallery-profile.test.ts apps/editor/tests/style-slots.test.ts apps/editor/tests/session-textbox.test.ts
17 tests passed
node --test apps/editor/tests/preference-lifetime-audit.test.ts
4 tests passed
node --test apps/editor/tests/session-object-selection.test.ts
5 tests passed
node --test apps/editor/tests/session-endnote.test.ts
6 tests passed
node --test apps/editor/tests/undo-lifetime.test.ts apps/editor/tests/document-history95.test.ts apps/editor/tests/recovery-record.test.ts
17 tests passed
node --test apps/editor/tests/shortcut-audit.test.ts apps/editor/tests/hangul-shortcuts.test.ts apps/editor/tests/navigation.test.ts
34 tests passed
node --test apps/editor/tests/character-style-reference.test.ts apps/editor/tests/style-flow.test.ts
7 tests passed
JUEONY_ENGINE_PACKAGE=build/rhwp-engine/source-c932adab64d8bc4e/pkg node --experimental-strip-types --test apps/editor/tests/style-package.test.ts
3 tests passed
node --experimental-strip-types --test apps/editor/tests/page-hide-control-delete.test.ts
4 tests passed
npm test -- tests/chart-data-edit.test.ts
9 tests passed
npm test -- tests/chart-data-edit.test.ts tests/chart-data-edit-studio.test.ts
14 tests passed
npm run build
663 modules transformed; isolated build passed
node scripts/verify-chart-data-edit-ui.mjs
Edge HWP/HWPX value edit, saved-byte reopen and UI reopen passed; page/chart console/external errors 0
npm test -- tests/header-footer-clipboard.test.ts tests/header-footer-clipboard-integration.test.ts
12 tests passed
JUEONY_BUILD_PROFILE=hfclipboard npm run build
661 modules transformed; isolated build passed
node apps/editor/scripts/verify-n013-b046-browser-smoke.mjs
4 Edge smoke scenarios passed; pageErrors/consoleErrors/externalRequests 0
```

회전 글상자의 실제 WASM 검사는 `source-cc7eb97e2669dc19` 엔진으로 HWP·HWPX 저장·재열기와 바이트 비변경을 확인했다. 기존 공유 dirty 빌드를 덮어쓰지 않기 위해 새 Edge 전체 빌드는 실행하지 않았다.

N004는 동결된 206개 patch 엔진 `source-1c95e8f557d95b73`으로 네이티브 양형식과 격리 Edge 검사를 완료했다. N012는 실제 Rust 엔진의 양형식 저장·재열기에서 정의 연결 전파와 직접 서식 비전파를 확인했다. 한글 2024 직접 비교는 지시대로 실행하지 않았다.

B071 Edge 검수에서는 차트 시나리오의 page 오류·console 오류·외부 요청이 모두 0이었다. 다만 공유 검수 빌드에서 차트와 무관한 favicon 404와 빈 문서 stored-time 초기화 API가 공식 npm WASM에 없는 오류가 별도로 관찰됐다. 소유 HWP/HWPX를 직접 연 차트 검수에는 영향을 주지 않았으며, 이 두 항목은 해결된 것으로 표시하지 않는다.

## 변경 집합

- `0eb379ec feat(editor): preserve styles and rotated textbox state`
- `b74d53ee test(editor): audit preference storage lifetimes`
- `0407bcee refactor(editor): expose preference and style facades`
- `49c6a1cc feat(editor): validate grouped object selection state`
- `4aae2329 feat(editor): validate endnote selection state`
- `f9524b4f test(editor): define undo history lifetime policy`
- `2bd2c75b feat(editor): preserve portable style references`
- `4ea193ce feat(editor): delete verified page hide controls`
- AI·Agent 실행과 참고 자료·검색·RAG 코드는 이 묶음에서 변경하지 않았다.
