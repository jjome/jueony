# 대화상자·기본 스타일 단축키·문서 커서 저장 보강

2026-10-12. 구현 커밋 `743a7e4`. [이전 실제 한글 구역·탭 비교](36-native-section-comparison.md)에 이어 기본 편집과 상태 저장을 보강했다. 한글 2024 전체 기능 동등성 완료를 뜻하지 않는다.

## 이번에 사용할 수 있는 동작

- 스타일·문단 모양 등 편집 대화상자에서 Esc는 가장 위의 창 하나만 닫는다. Tab/Shift+Tab은 활성 창 안에서 이동한다. 취소 버튼에서 Enter를 누르면 취소하며, 닫은 뒤 Enter가 문서에 들어가지 않는다. IME 조합 중 Esc로 창을 닫지 않는다. 중첩 창을 닫으면 부모 창으로, 마지막 창을 닫으면 문서 입력으로 돌아간다.
- 종료 확인은 업무 화면이 맡는다. 현재 탭 외에도 다른 탭·workspace의 미저장 문서, 저장 중·저장 실패·진행 중인 작업을 확인한다. 독립 편집 화면은 자체 종료 보호를 유지한다. 브라우저가 실제 종료 경고를 표시할지는 사용자 입력 여부 등 브라우저 정책도 따른다.
- 본문 커서 위치를 확대율·스크롤과 함께 저장한다. 재실행·탭 전환 후 복원해도 문서를 변경하지 않고 채팅 입력 포커스를 빼앗지 않는다. 구역/문단/문자 위치와 문단 길이, 앞뒤 최대 32문자의 문맥을 검증한다. 문서 전환 중 이전 커서가 새 문서 범위를 벗어나면 캡처를 건너뛴다.
- Ctrl+1 바탕글, Ctrl+2 본문, Ctrl+3~0 개요 1~8을 적용한다. 실제 스타일 ID는 문서의 이름으로 찾으며, 누락·중복 대상을 다른 스타일로 대체하지 않는다. 물리 숫자 키 매핑, undo와 HWPX 저장·재열기를 검사했다.

표 셀·머리말·각주·글상자·개체 선택·범위 선택의 커서 복원은 이번 구현에 포함하지 않는다. 재실행 후 undo 이력도 복원하지 않는다. 사용자 정의 스타일 이름이나 한글의 개별 단축키 재할당은 F6로 관리해야 하며, 이번 기본 스타일 키와 동등하다고 판단하지 않는다. 브라우저/Windows 호스트의 시스템 단축키 선점과 실제 한글 IME 검수도 남는다.

## 레이어와 저장 계약

보기 상태는 `preferences`의 공개 `DocumentViewState` v1에 optional `caret`를 추가했다. 기존 v1에는 이 필드가 없어도 된다. 손상된 커서 필드만 버리고 기존 확대·스크롤을 살린다. 문서 내용은 파일/복구 bytes, 보기와 커서는 세션 값으로 구분한다.

WASM 위치·본문 문맥 접근은 `adapters/rhwp/body-caret.ts`가 맡고, 레이아웃 안정화와 복원 순서는 preferences facade가 맡는다. InputHandler는 공개 `getSessionCaretAccess()`로 필요한 접근만 제공한다. 종료 정책은 session domain의 `shouldProtectExit`, 실제 이벤트는 shell이 담당한다. 대화상자 키 처리는 browser adapter에 두고 고정 upstream은 읽기 전용으로 유지한다.

전체 검사에서 문서 교체 직후 이전 커서 위치를 새 문서에서 읽는 회귀를 발견했다. 범위 검사를 추가하고 단위 검사 및 동일 전체 시나리오로 확인했다. 최초 실패는 `browser-final/result.json`, 수정 후 판정은 **`browser-verified/result.json`**이다. 스타일 시험의 잘못된 export API 이름 및 취소 버튼을 잘못 선택한 시험 코드도 보정했으며 실패 기록을 보존한다.

## 실제 한글 조작 도구의 남은 문제

한글의 합성 문서에서 F6로 스타일 창을 열어 기본 Ctrl+1~0 표시를 직접 관찰했다. 그러나 도구의 창 목록은 부모 문서 창만 반환하고, 캡처에는 별도 스타일 창과 닫기 요소가 나타났다. 이 요소의 클릭은 cached state 오류, Esc와 모달 화면 닫기 클릭은 `failed to activate captured window`를 반환했다. 새 창 선택·캡처 후 재시도도 실패했다.

부모 창과 owned modal의 활성화 연결 문제로 추정하지만 OS 원인은 확정하지 않았다. Jueony 대화상자 결함과 별도로 관리하며 **도구 오류가 해결됐다고 보고하지 않는다**. 기본 스타일 적용 및 이번 커서 저장 정책을 실제 한글과 비교 실행한 결과도 아직 없다. [관찰·정확한 오류·재현 순서](evidence/basic-state-2026-10-12/native-dialog-diagnosis.json)를 남겼다.

[Computer Use 작업 지침](C:/Users/jjome/.codex/plugins/cache/openai-bundled/computer-use/26.1007.21434/skills/computer-use/SKILL.md)의 복구 지시는 “Refresh the app/window selection and retry once; report the exact error if recovery fails.”이다. 이 재시도가 실패해 같은 창 입력을 반복하거나 COM/SendKeys로 우회하지 않았다. 사용자에게 다시 창을 닫으라고 요구하며 개발을 멈추지 않고, 독립적으로 가능한 구현·브라우저 검수·실행 묶음을 계속 완료했다.

## 검사와 실행

| 검사 | 결과 | 증거 |
| --- | --- | --- |
| 모듈·어댑터 단위 검사 | 261개 통과, 건너뜀 0 | [로그](evidence/basic-state-2026-10-12/editor-unit-tests.txt) |
| 실제 Edge의 대화상자·키·본문·구역·표·Agent·저장·복구 | 23개 통과 | [결과](evidence/basic-state-2026-10-12/browser-verified/result.json) |
| 업무 화면·합성 Agent·자료 검색·매크로 | 9개 통과 | [결과](evidence/basic-state-2026-10-12/workbench-verified/result.json) |
| 실제 실행 묶음의 기존 v1 복원·업무 격리·오프라인 저장 | 4개 통과 | [결과](evidence/basic-state-2026-10-12/compatibility/result.json) |
| 깨끗한 탭으로 전환해도 비활성 미저장 문서를 종료 보호 | 추가 1개 통과 | [결과](evidence/basic-state-2026-10-12/inactive-exit-verified/result.json) |
| TypeScript·프런트엔드 빌드·모듈 경계 | 통과 | [요약](evidence/basic-state-2026-10-12/verification.json) |
| 이번 새 기능의 실제 한글 비교 입력 | 도구 활성화 실패로 미완료 | [진단](evidence/basic-state-2026-10-12/native-dialog-diagnosis.json) |

최종 편집 검사에서는 페이지 오류·콘솔 오류·외부 자산 요청이 0개다. 업무/Agent 검사는 합성 모델을 사용하며 유료 모델의 새 호출 성공을 주장하지 않는다. 엔진 패치는 이번에 바꾸지 않았으며 이전 실측 수정 WASM `c1e254531219bb88f983dca0671aa6d4c10be79460c50de8e5fb60d8cca182da`를 사용한다.

실행: **[Start-Review.cmd](../build/jueony-basic-state-20261012/Start-Review.cmd)**, 포트 **4197**. 이 폴더의 `JueonyEditor.exe`로도 실행할 수 있다. 다른 포트의 기존 업무 저장소는 보존되며 새 포트에는 자동 공유되지 않는다. 폴더 안 `review-documents/default-style-shortcuts.hwpx`는 실제 한글에서 재열기·스타일 확인을 할 수 있는 합성 파일이다. 마지막 스타일은 undo 후 개요 7, 본문은 `스타일 단축키 검증`이다.

## 이어서 검증해야 할 작업

1. owned modal을 실제 조작할 수 있는 Computer Use 환경을 확보한 뒤 취소·확인·중첩·IME와 기본 스타일 숫자키를 같은 합성 문서로 실측한다. 기존 오류를 반복 재시도하여 통과로 바꾸지 않는다.
2. 커서·선택·표 셀의 세션 수명을 한글에서 관찰하고, 현재 본문 계약에 독립 optional 필드로 확장한다. 저장된 문서의 원문/위치 검증과 포커스 보존을 유지한다.
3. 문단 여백/첫 줄 빠른키, 이전/다음 커서 이동, 문서 끼워 넣기를 해당 기능의 엔진 계약과 undo·파일 보존 검사로 연결한다.
4. 기존 표·개체·쪽 설정의 미지원 목록을 순서대로 구현하고 실제 한글 저장 사본과 비교한다. Agent 권한 확대와 RAG/loop는 이 검증을 완료한 명령을 사용하도록 이어간다.
