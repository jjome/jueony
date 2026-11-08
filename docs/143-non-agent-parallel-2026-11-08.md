# AI·참고 검색 제외 병렬 구현 기록 (2026-11-08)

이 문서는 AI 연결·Agent 실행과 참고 자료·검색·RAG를 제외한 편집기 병렬 작업의 검증 기록이다. 아래 항목은 제한된 범위만 완료로 표시하고 상위 N 작업은 남은 기능 때문에 `부분`으로 유지한다.

## 검증된 묶음

| 항목 | 구현·보호 범위 | 검증 | 남은 제한 |
|---|---|---|---|
| N011 | 평면 스타일 JSON 가져오기·내보내기·언어별 글꼴·이름 충돌·다음 스타일 순환·중간 실패 전체 롤백 | HWP/HWPX 저장·재열기를 포함한 `style-package.test.ts` 2/2 | 번호·개요·탭·테두리·배경·특수 영역·UI·Agent·한글 비교 |
| N013 | 기관 프로필 v1 검증·갤러리/번호키 충돌·손상/상위 버전/쓰기 실패 보호·정확한 이름 해석 | 프로필·기본 스타일 단축키 테스트 6/6 | 설정 UI·미리보기/적용·설치부 연결·Agent·한글 비교 |
| N014 / G091 | 단일 root Rectangle의 0~359° 정수 회전 커서·정/역방향 선택 복원·회전각 변경 시 stale 복원 차단 | 단위 9/9·실제 WASM HWP/HWPX 9/9 | 그룹·중첩·캡션·뒤집기·비-Rectangle·신규 Edge 빌드·한글 비교 |
| N015 | root vector shape 2~32개와 중첩 group 선택의 순서/활성 개체·소유 구조·개체/문서 지문·stale 차단 | 단위 5/5·실제 WASM HWP/HWPX 4/4·바이트 비변경 | 공유 SessionCursor·validator·Studio callback·wire 연결과 이미지/수식/OLE/표/특수 story·브라우저/한글 검증 |
| N016 | root-body 미주의 owner·note locator·3중 지문·Unicode 커서/방향성 선택·각주 분리 | 단위 6/6·실제 WASM HWP/HWPX 4/4·bytes 불변·stale 차단 | SessionCursor·Studio callback 연결·중첩/표/도형 note·필드/삽입 개체·브라우저/한글 검증 |
| N017 | stable 8개 설정 키의 scope·재실행·reset·dirty/undo·backup·validator 수명 계약과 문서/구역·임시 상태 분리 | 읽기 전용 audit 4/4·손상/상위 버전/읽기 실패 분류·쓰기 비발생 | Studio 전체 schema·backup 제외 정책·UI/시작 연결·실제 한글/Windows/origin/DPI 실측 |
| N018 | live atomic recipe의 프로세스/문서/버전/bytes/history top 결합·저장 실패 유지·검증된 rebase·재열기/복구/명명 이력/재시작 초기화 | 신규 5/5·문서 이력/복구 선별 포함 17/17 | 실제 InputHandler·save/recovery 연결·수동 편집·저장 frame·프로세스 재시작·한글 기준 |
| N004 | 10pt 1→2줄 혼합 그림·필드 셀의 source/run/cursor offset 일치·가운데 정렬 재조판·실패 시 exact rollback | HWP/HWPX 네이티브 저장·재열기·undo/redo·4개 fault rollback 및 Edge 실제 편집→bound-save→UI 재열기 | 임의 필드 경계·중첩 셀·복합 개체·한글 비교 |
| N012 | 저장 글자 스타일과 직접 서식 타입 분리·독립 charShape 소유·정의 변경 전파·중복/stale/race fail-closed | 실제 Rust HWP/HWPX 3/3·앱 경계와 범위 보호 7/7 | 새 WASM UI 스모크·공유 UI·Agent 연결·한글 비교 |
| N021 | 177개 단축키 감사·object > cells > table > document 우선순위·IME/repeat/도달성 회귀 보호 | 단축키 감사·기존 한글 단축키·navigation 34/34·TypeScript compile | pending 3건·머리말/각주/미주/글상자 story 정책·한글 비교 |

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
```

회전 글상자의 실제 WASM 검사는 `source-cc7eb97e2669dc19` 엔진으로 HWP·HWPX 저장·재열기와 바이트 비변경을 확인했다. 기존 공유 dirty 빌드를 덮어쓰지 않기 위해 새 Edge 전체 빌드는 실행하지 않았다.

N004는 동결된 206개 patch 엔진 `source-1c95e8f557d95b73`으로 네이티브 양형식과 격리 Edge 검사를 완료했다. N012는 실제 Rust 엔진의 양형식 저장·재열기에서 정의 연결 전파와 직접 서식 비전파를 확인했다. 한글 2024 직접 비교는 지시대로 실행하지 않았다.

## 변경 집합

- `0eb379ec feat(editor): preserve styles and rotated textbox state`
- `b74d53ee test(editor): audit preference storage lifetimes`
- `0407bcee refactor(editor): expose preference and style facades`
- `49c6a1cc feat(editor): validate grouped object selection state`
- `4aae2329 feat(editor): validate endnote selection state`
- `f9524b4f test(editor): define undo history lifetime policy`
- AI·Agent 실행과 참고 자료·검색·RAG 코드는 이 묶음에서 변경하지 않았다.
