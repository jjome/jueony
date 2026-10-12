# 한글 2024 모달 창 조작 오류 조사

2026-10-12. Jueony 코드 결함과 Computer Use 환경 결함을 구분한다. 현재 문제는 해결 완료 상태가 아니다. [현재 재현 기록](evidence/selection-spacing-2026-10-12/native-dialog-recovery.json), [이전 기록](evidence/basic-state-2026-10-12/native-dialog-diagnosis.json)을 함께 제공한다.

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

현재 가능한 운영 방법은 사용자가 직접 열린 모달을 닫고 새 관찰을 시작하는 것이다. 이번에도 새 상태에서 열기는 동작했지만 닫기는 실패하여, 이를 자동 비교의 안정적인 해결책으로 채택하지 않았다. 사용자에게 계속 창을 닫으라고 요청하며 개발을 멈추지 않았다.

[Computer Use 지침](C:/Users/jjome/.codex/plugins/cache/openai-bundled/computer-use/26.1007.21434/skills/computer-use/SKILL.md)은 “Refresh the app/window selection and retry once; report the exact error if recovery fails.”를 요구한다. 이번 새 선택과 재시도가 실패했으므로 동일 모달에 입력을 반복하지 않았다. 별도 COM/SendKeys/PowerShell UI Automation으로 우회하지 않았다.

## 비교 작업의 계속 진행 범위

Jueony 자체 대화상자와 키·선택·파일 검사는 실제 Edge의 격리된 프로필에서 진행한다. HWP/HWPX 시험 파일과 원본 정수/독립 XML 결과를 준비해 실제 한글 재열기 검수가 가능하게 한다. 도구 수정 후 새 기능의 한글 키 조절량과 선택·커서 수명을 직접 입력·관찰하여 비교한다. 그 전까지 해당 네이티브 비교는 `BLOCKED_NATIVE_INPUT`으로 유지한다.
