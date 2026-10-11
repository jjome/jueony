# 한글 2024 실측 구역 비교와 HWPX 탭 저장 보정

2026-10-12. [구역 병합 구현](35-section-boundary-merge-result.md)의 실제 한글 비교 후속 기록이다. 설치 한글의 빈 시험 문서와 프로젝트의 합성 문서만 사용했다. 사용자 문서·자료·LLM 키는 사용하지 않았다.

## 직접 확인한 동작

- 빈 문서에 `ABCD`를 입력하고 B/C 사이에서 Alt+Shift+Enter를 누르자 `AB`/`CD` 두 구역·두 쪽이 됐다. 뒤 구역 시작에서 Backspace를 누르면 한 문단 `ABCD`·한 구역·한 쪽이 되고 커서는 B/C 사이에 남았다.
- Ctrl+Z로 두 구역을 복원하고 앞 구역 끝으로 이동하여 Delete를 누르면 같은 결과가 됐다. 이로써 경계 문단을 이어 붙이는 구현 계약을 한글에서 실측했다.
- 서로 다른 쪽 번호·기본 탭·단 설정의 세 구역 HWP를 열었다. 첫 경계 Delete 후 `ONETWO`/`THREE, FOUR`의 두 구역이 됐고, undo 후 Backspace로 같은 결과가 됐다. 한글에서 HWP와 HWPX 사본을 각각 저장했다.
- 한글 저장 사본과 Jueony 저장 사본의 본문·용지/여백·단 정의·시작 쪽 번호·raw 기본 탭 값을 비교했다. 해당 값은 일치했다. 전체 파일 바이트가 같다는 검사가 아니다.
- Jueony의 병합 HWPX를 한글에서 열어 본문과 두 구역을 확인했다. 후속 2×2 표를 가진 병합 HWP에서도 본문·표와 `업무표`/이모지 셀을 화면으로 확인했다.

Computer Use의 `@oai/sky`로 실제 입력하고 접근성 트리·화면을 관찰했다. COM이나 한글 자동화 API로 우회하지 않았다. [실측 기록](evidence/native-section-merge-2026-10-12/ui-observations.json), [한글 저장 사본과 구조 비교](evidence/native-section-merge-2026-10-12/parsed-comparison.json)를 보존한다. 접근성 트리는 입력 직후 일부 상태가 늦게 갱신되어 별도 화면 확인을 함께 사용했다.

## 발견한 결함과 수정

Jueony의 기존 HWPX를 한글의 구역 설정에서 확인하자 raw 기본 탭 `4000`인 첫 구역이 **40pt**로 표시됐다. 실제로는 20pt여야 한다. 기존 serializer가 `tabStop`을 변경하면서 `tabStopVal="4000"`을 템플릿 값으로 남겼기 때문이다.

한글이 직접 HWP를 HWPX로 저장한 사본은 첫 구역에 `tabStop="4000" tabStopVal="2000"`, 뒤 구역에 `tabStop="16000" tabStopVal="8000"`, 단위는 `HWPUNIT`을 기록했다. 제품 serializer도 이 관계를 지키도록 `engine/patches/default-tabs.patch`를 보정했다. raw 0은 기존 기본값 `8000/4000`으로 저장한다. 읽기 전용 upstream은 유지한다.

rhwp 파서는 `tabStop`을 읽으므로 같은 엔진으로 저장·재열기만 하면 이 결함이 감춰졌다. 실제 ZIP 안의 `secPr` XML을 읽는 공통 진단을 추가했다. [수정 전 독립 XML 실패](evidence/native-section-merge-2026-10-12/before-xml-comparison.json)는 raw 값 비교가 통과해도 한글이 읽는 값이 다름을 보여준다. 보존 검사나 형식 비교 기준을 느슨하게 하지 않았다.

새 Rust/WASM으로 다시 저장한 HWPX를 실제 한글 2024에서 열고 구역 설정을 확인했다. 첫 구역의 기본 탭 간격이 **20.0pt**로 표시됐다. 원문 `ONETWO`, 두 구역, 시작 쪽 번호 3도 유지됐다. 설정 대화상자는 값을 바꾸지 않고 확인했으며, 사용자가 이후 닫았다.

## 실행과 검증

최신 검수본: [Start-Review.cmd](../build/jueony-native-tabs-20261012/Start-Review.cmd), 포트 **4196**. 이전 묶음과 업무 저장소는 유지한다. 이 포트에는 독립 업무 저장소가 있으므로 기존 대화·연결이 자동으로 나타나지 않을 수 있다.

| 검사 | 결과 | 기록 |
| --- | --- | --- |
| 구역 병합 엔진: 본문/표 보존·설정·실패 보호·undo/redo·HWP/HWPX 저장 | 7개 그룹 통과 | [결과](evidence/native-section-merge-2026-10-12/merge-engine-result.json) |
| 구역 분할·기본 탭: 5개 구역의 독립 HWPX XML 포함 | 10개 그룹 통과 | [결과](evidence/native-section-merge-2026-10-12/tabs-engine-result.json) |
| 실제 한글 저장 사본의 본문·선택 설정·XML 비교 | 4개 그룹 통과 | [결과](evidence/native-section-merge-2026-10-12/parsed-comparison.json) |
| 브라우저 편집·단축키·저장·복구·Agent 명령 | 19개 시나리오 통과 | [결과](evidence/native-section-merge-2026-10-12/ui/result.json) |
| 업무 화면·Agent 흐름 | 9개 시나리오 통과 | [결과](evidence/native-section-merge-2026-10-12/workbench/result.json) |
| 실제 실행 묶음: v1 상태 복원·업무 격리·오프라인 파일 저장 | 4개 시나리오 통과 | [결과](evidence/native-section-merge-2026-10-12/compatibility/result.json) |
| 프런트엔드 빌드·TypeScript 검사 | 통과 | [빌드](evidence/native-section-merge-2026-10-12/frontend-build-log.txt) |
| 모듈 경계: 9개 모듈·137개 파일 | 위반 0개 | [결과](evidence/native-section-merge-2026-10-12/module-boundaries.txt) |

화면 검사에서 외부 요청과 페이지 오류는 0개다. 편집 화면 검사의 콘솔에는 한 번의 탐색에서 여러 `beforeunload` 확인창을 표시하려는 시도를 브라우저가 차단했다는 진단 2건이 남았다. 상태 복원·저장은 통과했지만 종료 확인의 중복 등록 점검은 남긴다. Agent 검사는 합성 모델 응답을 사용했고 유료 제공자를 추가 호출하지 않았다. 샌드박스에서 실패한 브라우저 실행 로그와 수정 전 실패 기록은 `before/`에 보존했다. 실제 브라우저 실행이 가능한 환경에서 다시 실행한 최종 결과는 위 표에 연결했다.

엔진 소스 ID는 `1c738b6a10f4956a`, WASM SHA-256은 `c1e254531219bb88f983dca0671aa6d4c10be79460c50de8e5fb60d8cca182da`다. 잠긴 의존성으로 WSL에서 빌드한 검수용 엔진이며 `wasm-opt` 최적화는 하지 않았다. 이전 커밋 `8432586`에 이번 수정이 더해진 빌드이므로 [엔진 패치 해시](evidence/native-section-merge-2026-10-12/engine-build.json)와 [실행 묶음 기록](evidence/native-section-merge-2026-10-12/bundle-evidence.json)을 함께 확인한다.

이번 엔진·화면 검사에서 저장한 HWP/HWPX 89개와 한글에서 직접 저장한 사본 3개를 보존했다. [파일 해시 목록](evidence/native-section-merge-2026-10-12/documents.json)과 [검증 요약](evidence/native-section-merge-2026-10-12/verification.json)을 제공한다. `native-three-settings-delete.hwpx`는 동일 경계에서 undo 후 Backspace로 병합하여 저장한 사본이다. 파일 이름은 최초 시험 이름을 유지한다.

실행 묶음의 `review-documents`에는 이전 검수 문서와 이번 보정된 문서를 함께 제공한다. 같은 이름의 합성 문서는 새 엔진 저장본으로 갱신했고 이전 원본 증거는 저장소에 그대로 남겼다. 재검사 명령은 저장소 루트에서 실행한다.

```powershell
$env:JUEONY_ENGINE_PACKAGE = 'build/rhwp-engine/source-1c738b6a10f4956a/pkg'
& ./build/jueony-native-tabs-20261012/runtime/node.exe ./apps/editor/scripts/verify-native-section-merge.mjs
```

## 남은 검증 경계

- 직접 비교는 위 합성 본문 사례에 한정한다. 복잡한 경계의 개체·필드·독립 머리말/꼬리말 거부 등 제품 제한은 그대로다.
- 구역 설정 같은 한글 자체 대화상자에서 창 활성화 오류가 재발했다. 첫 실패와 새 선택 후 재시도 실패를 기록했고, 사용자가 대화상자를 닫은 뒤 본문 검사를 재개했다. 정확한 Windows 실패 원인을 확정한 것은 아니다.
- 독립 PDF·픽셀 조판/인쇄 비교와 한글 전체 기능 동등성은 아직 검증하지 않았다. 새로운 렌더링 golden을 등록하지 않는다.
- 실제 확인과 코드상 지원을 구분하고, 구현하지 않은 기능을 완료로 표시하지 않는다.
