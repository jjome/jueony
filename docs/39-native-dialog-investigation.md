# 한글 2024 모달 창 조작 오류 조사

2026-10-12. Jueony 코드 결함과 Computer Use 환경 결함을 구분한다. **스타일 창 닫기와 원래 문서 복귀는 지원 API를 사용하는 런처 복구 경로로 검증됐다.** 직접 Esc/닫기 버튼을 보낼 때의 Computer Use 활성화 오류는 남아 있다. [복구 검증 기록](evidence/native-dialog-2026-10-12/style-launcher-recovery.json), [앞선 재현 기록](evidence/selection-spacing-2026-10-12/native-dialog-recovery.json), [이전 기록](evidence/basic-state-2026-10-12/native-dialog-diagnosis.json)을 함께 제공한다.

## 이번에 다시 확인한 사실

1. 시작 시 한글의 합성 문서 창에서 이전 스타일 창은 닫혀 있었다. 창 목록을 새로 읽고 반환된 한글 창 하나를 선택했다.
2. 같은 창에 F6를 보내면 스타일 창이 열렸다. 화면·접근성에는 스타일 창과 포커스된 바탕글 항목이 나타났다.
3. `press_key(Escape)`는 `failed to activate captured window`를 반환했다.
4. 새 `list_windows`→`get_window`→`get_window_state` 후 명시적 `activate_window`도 같은 오류를 반환했다. Esc는 이 활성화 실패 뒤에 다시 보내지 않았다.
5. 창 목록에는 부모 문서 창 하나만 반환됐고 모달을 별도로 선택할 반환 Window가 없었다. 스크린샷이 모달을 포함하는 것과 해당 모달이 입력 대상으로 반환되는 것은 다르다.

사용자 문서나 계정 화면은 조작하지 않았다. 프로젝트 합성 문서만 선택한 기록을 남기며 다른 앱의 창 제목은 증거 파일에 포함하지 않는다. 한글은 이번 시도에서 스타일 창이 열린 상태로 남았다.

## 원인 추정과 확인이 필요한 부분

일반 문서 창에서는 F6가 동작하고 모달이 열린 뒤에 실패하므로, 도구가 비활성 부모를 계속 활성화하려 하거나 owned modal의 실제 입력 창/접근성 캐시를 잘못 연결하는 경우를 우선 조사해야 한다. 도구 내부 구현과 OS 반환값을 확보하지 못했으므로 확정 원인은 아니다. 관리자 권한 부족이나 사용자 클릭을 단독 원인으로 단정하지 않는다.

Windows에는 소유 창의 마지막 활성 팝업을 찾는 [GetLastActivePopup](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getlastactivepopup)이 있다. 도구 내부의 실제 native 창 바인딩을 통해 이를 확인하는 방법이 후보이며, 반환 창을 사용자/모델에게 targetable Window로 노출해야 한다. 또한 [SetForegroundWindow](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setforegroundwindow)는 Windows의 전경 창 제한 때문에 실패할 수 있다. 부모/팝업을 올바르게 찾는 것만으로 모든 활성화 실패가 해결된다고 보장할 수 없다.

## 도구 제공 측에 필요한 수정과 판정 기준

- `list_windows`가 열린 owned modal을 반환하거나, `get_window_state.window`가 실제 활성 모달 Window를 반환하도록 한다. 반환 Window의 앱·소유 관계와 입력 대상이 일치해야 한다.
- 모달 화면과 접근성 항목을 부모 캡처에 합친다면, 클릭 인덱스 캐시와 실제 입력 대상도 같은 창에 연결한다. 현재처럼 화면에 있는 항목이 입력 캐시에 없는 상태를 피한다.
- 활성화 실패에는 선택된 native 창·마지막 활성 owned popup·전경 창·활성 가능 여부의 진단을 반환한다. 개인정보를 가진 다른 앱의 창 제목은 불필요하게 수집하지 않는다.
- 한글 F6→Esc, Alt+T→취소, 스타일 편집의 중첩 창, 부모로 복귀, 다른 앱으로 전환된 상태, 잠긴 데스크톱/실패 상태를 각각 회귀 검사한다. 문서가 바뀌지 않은 취소 경로도 확인한다.

이는 현재 `sky` API에 없는 선택/진단 능력을 도구 구현에 추가하는 제안이다. 프로젝트 안에서 지원되지 않는 도구 프로토콜이나 가짜 창 핸들을 만들어 실행하지 않는다. 접근성 인덱스를 HWND로 간주하지 않으며, 전경 잠금/보안 설정을 바꾸는 해결책도 사용하지 않는다.

사용자가 직접 모달을 닫으면 부모 창부터 다시 관찰할 수 있지만 이는 자동화 오류의 해결책이 아니다. 반복적으로 수동 닫기를 요청하는 방식으로 해결 완료를 판정하지 않는다.

[Computer Use 지침](C:/Users/jjome/.codex/plugins/cache/openai-bundled/computer-use/26.1007.21434/skills/computer-use/SKILL.md)은 “Refresh the app/window selection and retry once; report the exact error if recovery fails.”를 요구한다. 이번 새 선택과 재시도가 실패했으므로 동일 모달에 입력을 반복하지 않았다. 별도 COM/SendKeys/PowerShell UI Automation으로 우회하지 않았다.

## 추가 진단: 캡처 불일치와 권한 수준 확인

2026-10-12 20:38 KST 추가 검사. 사용자의 요청에 따라 편집기 기능 개발을 멈추고 스타일 창 문제만 조사했다. [구조화된 기록](evidence/native-dialog-2026-10-12/style-modal-diagnostic.json)에 실패 경로와 프로세스 진단을 저장했다. 다른 프로그램의 화면 픽셀과 제목은 저장하지 않았다.

- `list_windows`와 JavaScript 커널 초기화 뒤의 `list_apps` 모두 한글의 부모 문서 Window 하나만 반환했다. 별도 스타일 Window는 반환하지 않았다.
- 한글 접근성 트리에는 `1 창 스타일`, `4 단추 ID: PART_Close`가 존재했다. 그런데 같은 관찰의 스크린샷에는 한글 대신 다른 전경 프로그램이 표시되었다. 화면 캡처가 대상 창을 정확히 나타내는지에 대한 별도의 문제가 확인됐다. 좌표 입력은 하지 않았다.
- 캡처를 끄고 접근성만 새로 관찰한 뒤 `click(element_index:4)`를 실행했지만 `Error: failed to activate captured window`가 반환됐다. 따라서 픽셀 좌표 오차만으로 설명할 수 없다.
- `js_reset` 후 다시 초기화하고 앱 목록에서 새로 선택했다. 텍스트 전용 관찰에 나온 스타일 창의 `Raise` 동작도 같은 활성화 오류를 반환했다. JavaScript 세션 캐시 초기화로 해결되지 않았다.
- [읽기 전용 프로세스 진단 스크립트](../scripts/diagnose-native-process.ps1)를 실제 호스트에서 실행했다. 한글과 관찰한 Codex 프로세스 모두 세션 3, 무결성 `medium (0x2000)`, 응답 중이었다. 한글이 관리자 권한으로 실행돼 Codex와 권한 수준이 다르다는 추정은 이 결과에 맞지 않는다. 별도 Computer Use helper의 토큰과 내부 OS 활성화 반환값은 조사하지 않았으므로 모든 권한 원인을 배제한 것은 아니다.
- 마지막 텍스트 관찰에서 스타일 창과 닫기 버튼이 여전히 존재하고, 바탕글 항목에 포커스가 있었다. 자동 닫기는 성공하지 않았다. 문서 내용도 입력하지 않았다.

현재 확인된 실패 지점은 Computer Use의 대상 창 활성화이며, Jueony 문서 편집 코드가 아니다. 비활성 부모/owned modal 연결 또는 캡처·입력 바인딩 문제는 여전히 **원인 후보**다. SDK 메서드는 주입된 native facade로 노출되어 내부 활성화 코드를 읽거나 프로젝트에서 고칠 수 없다. 정확한 원인 확정에는 도구 제공 측의 실제 대상 창·활성 팝업·OS 반환값 기록이 필요하다.

도구 수정의 최소 판정 기준은 (1) 반환된 픽셀이 한글/스타일 창과 일치하고, (2) F6로 연 스타일 창을 지원 API로 닫아 트리에서 사라짐을 확인하고, (3) 부모 편집 화면으로 복귀하는 것이다. 세 조건이 통과하기 전에는 `BLOCKED_TOOL_MODAL_ACTIVATION` 상태를 유지한다.

## 적용한 복구 코드와 실제 검증

2026-10-12 20:52 KST. [복구 스크립트](../scripts/hangul-style-recovery.mjs)를 추가했다. Computer Use 내부 바이너리를 수정한 패치가 아니라, 지원되는 `sky` API를 조합한 자동화 복구 코드다. 패키지의 manifest는 Proprietary이며 설치 패키지에는 활성화 구현을 수정할 JS/TS/Rust/C#/C/C++ 소스가 없었다. 외부 helper를 찾아 실행하거나 별도 프로토콜 클라이언트를 만들지 않았다.

검증한 경로는 다음과 같다. 각 단계는 별도 REPL 셀에서 실행하고 관찰 결과를 읽은 뒤 다음 입력을 보낸다.

1. `observeStyleRecovery(sky, documentTitle)`로 현재 앱 목록의 정확한 문서 제목을 선택한다. 반환된 Window만 사용하며, 스타일 창이 열린 상태를 확인한다.
2. `dismissStyleViaLauncher(sky, observation)`가 해당 앱의 반환된 app ID로 `launch_app`을 한 번 호출하고 같은 문서를 다시 관찰한다. 스타일 창이 사라지지 않거나 접근성 정보가 없으면 성공으로 처리하지 않는다.
3. 닫힌 상태를 확인한 다음 셀에서 `focusRecoveredDocument(sky, observation)`를 실행한다. 원래 문서를 활성화하고 캡처·포커스를 확인한다. 관찰 객체는 입력에 한 번만 사용할 수 있다.
4. 런처 호출은 별도의 한글 시작 화면을 만든다. 호출 전 존재하지 않았던 반환 Window를 새로 관찰하여 **빈 Launcher 화면**임을 확인한 경우에만 별도 셀에서 `press_key(Alt_L+F4)`로 정리한다. 비동기 닫기 뒤 새 창 목록에서 제거됐는지 확인하며, 아직 목록에 남았다고 입력을 반복하지 않는다. 기존 문서 창이나 미확인 창에는 이 정리를 적용하지 않는다.

실제 한글 2024의 합성 문서에서 열린 스타일 창 → 런처 호출 → 스타일 창 사라짐 → 원래 문서 편집 포커스 복귀를 **3회** 확인했다. 그중 2회는 저장한 스크립트의 함수로 검증했다. 마지막 상태는 스타일 창 없음, 문서 편집 영역 포커스, 0글자·1구역이며 한글 Window는 원래 문서 하나만 남았다. 생성된 시작 화면 4개도 관찰 후 정리했다. 문서 내용이나 스타일 값은 입력하지 않았다.

직접 부모를 전면에 가져온 뒤 F6로 스타일 창을 열고 Esc를 보내는 경로는 여전히 `failed to activate captured window`가 재현됐다. 따라서 런처 복구 성공을 SDK의 모달 입력 결함 수정으로 설명하지 않는다. 열린 최상위 스타일 목록을 변경하지 않은 상태에서 닫는 경로만 검증했으며, 중첩 스타일 편집·다른 대화상자·저장되지 않은 스타일 변경의 취소 의미는 아직 검증하지 않았다.

모듈의 로컬 파일 import는 이 Node REPL에서 `EPERM`으로 실패했다. 실제 검증은 파일 원문에서 ESM `export` 키워드만 제거하고 동일한 함수 선언을 REPL 코드로 전달하는 방식으로 했다. 문자열 eval, helper 직접 실행, Windows UIA/SendKeys/COM 우회는 사용하지 않았다. 셸에서는 JS 구문 검사만 실행한다. 이 파일은 Jueony 실행 파일에 넣는 기능이나 일반 PowerShell 실행 스크립트가 아니다.

[공식 Computer Use 문서](https://learn.chatgpt.com/docs/computer-use)는 Windows에서 대상 앱이 활성 데스크톱에 표시된 상태로 실행하도록 설명한다. 복구 후 실제 대상 화면을 확인했으며, 다른 앱의 픽셀을 대상 화면으로 간주하지 않는다. Hancom 직접 연결 플러그인 검색 결과에는 대체 연결이 없었다.

## 비교 작업의 계속 진행 범위

Jueony 자체 대화상자와 키·선택·파일 검사는 실제 Edge의 격리된 프로필에서 진행한다. HWP/HWPX 시험 파일과 원본 정수/독립 XML 결과를 준비해 실제 한글 재열기 검수가 가능하게 한다. 스타일 목록은 위 복구 경로로 닫고 문서 입력을 계속할 수 있다. 다른 대화상자까지 복구됐다고 확대하지 않으며, 미검증 대화상자 입력이 필요한 비교 항목은 계속 `BLOCKED_NATIVE_INPUT`으로 유지한다.
