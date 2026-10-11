# 새 문서 기본값과 문서별 보기 상태

2026-10-11. 기준 commit 06f5a39. B 상태 담당의 독립 모듈·검사 산출물이며 실제 한글 편집기 실측은 **BLOCKED_REFERENCE**다.

## 조사 결과

고정 rhwp Studio의 user-settings.font에는 대표 글꼴 세트와 최근 사용 글꼴 표시만 있다. 새 문서 기본 용지·여백·글꼴 필드는 없고 새 문서 생성은 wasm.createNewDocument()를 직접 호출한다. 따라서 기존 값을 무시하던 오류를 고쳤다고 표현하지 않고 **없던 사용자 새 문서 기본값 기능을 추가**한다.

한글 공식 [새 문서 환경 설정](https://help.hancom.com/hoffice130/ko-KR/Hwp/file/options/options%28newpaper%29.htm)의 범위는 새로 만드는 문서이며 기존 문서에는 소급 적용되지 않는다. 구현도 같은 적용 경계를 사용하지만 모든 한글 설정·템플릿 기능을 재현했다고 주장하지 않는다.

## 새 문서 기본값

소스: apps/editor/src/preferences/document-defaults.ts.

- localStorage의 별도 key `jueony-document-defaults`, version 1.
- 사용자 선택 적용 여부, 용지 너비/높이/방향, 좌우·상하·머리말·꼬리말 여백, 기본 글꼴 이름/크기를 저장한다.
- 처음에는 enabled=false로 기존 엔진 새 문서 기본값을 유지한다. UI에 제시하는 초기값은 고정 엔진의 빈 문서를 확인한 값(A4 세로, 좌우 30mm, 위 20mm, 아래/머리말/꼬리말 15mm, 함초롬바탕 10pt)이다. 사용자 한글 설치의 Normal.hwtx와 동일하다는 뜻이 아니다.
- 새 문서 생성 직후 빈 본문에만 적용한다. 원본 파일 열기·복구 파일 로드 경로에는 적용하지 않는다.
- 본문이 비어 있는 단일 구역·단일 문단을 확인하고 용지와 현재 기본 스타일/빈 문단 글자 속성을 설정한다. 7개 언어의 글꼴은 선택한 단일 family를 동일하게 사용한다.
- 이후 저장되는 HWP/HWPX의 문서 자체에 용지와 글꼴 속성이 포함된다. 앱 설정값 변경은 이미 열린 문서를 바꾸지 않는다.
- 손상된 설정/미래 schema를 자동 초기화하거나 덮어쓰지 않는다. 쓰기 실패는 기존 값을 유지하고 오류를 반환한다. 설정 초기화는 명시적 reset API로만 수행한다.
- 임의 Normal.hwtx 가져오기, 문서 스타일 세트 전체·개요 번호·다국어별 글꼴·단축키 프로필은 이번 범위에 포함되지 않는다.
- 설정 적용은 새 문서 생성 과정으로 취급한다. 기존 문서의 undo 이력을 만들거나 내용 편집을 수행하지 않는다. 적용 실패를 숨기지 않고 새 문서 초기화 실패/설정 오류로 표시해야 한다.

통합 함수:
`defaultDocumentDefaults()`, `readDocumentDefaults(storage)`, `saveDocumentDefaults(storage,value)`, `resetDocumentDefaults(storage)`, `applyNewDocumentDefaults(doc,value)`.

main.createNewDocument에서 createNewDocument 직후 borrowDocumentHandle에 적용하고 선택 family를 docInfo.fontsUsed에 합쳐 폰트 로딩에 반영한다. loadBytes에는 넣지 않는다.

## 문서별 보기 수명

소스: apps/editor/src/preferences/document-view.ts.

`DocumentViewState = {version:1,zoom,fitMode,scrollX,scrollY}`.

- 소유 범위: workspace의 특정 복구 문서 session. 문서 ID로 저장하며 파일 이름으로 공유하지 않는다.
- 숫자 배율과 쪽/폭 맞춤 규칙을 구분한다. 맞춤 복원은 현재 문서·창 크기에 맞추어 기존 Studio 계산을 재사용한다.
- 먼저 확대율/맞춤을 적용하고 layout 완료를 기다린 다음 scroll을 복원한다. 실제 화면 범위를 넘는 scroll은 브라우저가 현재 범위로 제한한다.
- 숨은 iframe은 적용을 미루고 원래 snapshot을 보존한다. 표시/resize 이후 retry한다. pending snapshot을 초기 0 위치로 덮어쓰지 않는다.
- 문서 generation이 바뀌면 이전 문서의 지연 scroll 복원을 취소한다.
- 잘못된 선택적 보기 레코드는 invalid로 반환한다. HWP/HWPX 본문 복원 자체를 막지 않는다.
- cursor/selection/undo를 영구 복원하지 않으며 파일 내용/dirty를 바꾸지 않는다.
- 글로벌 글꼴·부호·도구 상자와 문서별 확대율/맞춤의 범위를 섞지 않아야 한다. global zoomFitMode는 새 문서/보기 정보가 없는 문서의 시작값에만 사용하고 다른 열린 문서의 개별 맞춤 상태를 덮지 않는 것이 통합 계약이다.
- 앱 종료/재시작 시 숫자 배율·scroll 보존은 이번 Jueony 기능 계약이다. 한글 2024의 세부 수명과 완전히 같다는 검증은 아직 없다.

통합 adapter는 viewport getter, document identity, visible 여부, 기존 applyFit 함수, layout 완료 promise를 주입한다. capture/restore/retry/isRestoring/hasPending/clear를 제공한다. 복원 때 발생한 zoom-fit-mode-changed를 global 환경 기본값에 재기록하지 않도록 isRestoring를 사용한다. outgoing 탭을 숨기기 전 capture하고 scroll/zoom 변경도 capture하여 last snapshot을 갱신한다.

## 검증 결과

- `node --experimental-strip-types --test apps/editor/tests/document-defaults.test.ts`: **9개 통과**. 설정 보존/손상/미래 버전/쓰기 실패/기존 문서 불변/실제 HWP 및 HWPX 재열기/입력 글꼴 상속 포함.
- `node --experimental-strip-types --test apps/editor/tests/document-view.test.ts`: **15개 통과**. 숫자 배율·맞춤 재계산·숨은 탭·문서 교체 경합·scroll 범위·실패 후 재시도·빠른 탭 전환 중 suspend 포함.
- 두 source 모듈 strict TypeScript 검사 통과.
- `node apps/editor/scripts/verify-document-state.mjs`: 포트 4205, 별도 Edge 프로필, 메모리 연결 저장소에서 실제 UI/엔진 통합 검사. **14단계 통과**. 현재 통과 범위와 정확한 빌드 정보는 [document-state-result.json](document-state-result.json)에 기록한다. 기존 사용자 프로필·실행 서버·DB는 사용하지 않는다.
- 테스트 표본: [HWP](new-document-defaults.hwp), [HWPX](new-document-defaults.hwpx). 기대값은 A4 가로/왼쪽 22mm/오른쪽 18mm/맑은 고딕 13pt. 실제 한글에서 열고 편집 용지·서식/줄바꿈/저장을 확인해야 한다.

## 브라우저 통합 회귀 확인

- 기본값 UI에서 A4 가로·왼쪽 22mm·오른쪽 18mm·맑은 고딕 13pt로 바꾸고 새 문서의 실제 WASM 속성을 검사한다. 먼저 열어 둔 문서의 구조와 revision은 불변이다.
- 동일한 파일 이름의 두 탭을 125%/80%로 설정하고 실제 DOM scrollTop=210, 저장된 view, 탭 재선택 및 reload 후 상태를 확인한다. 배율 대화상자는 실제 UI 입력을 사용한다.
- focus mode와 sidebar 상태, 기존 HWPX의 skipDefaults, 폭 맞춤의 창 크기별 재계산, 다른 문서 숫자 배율 불변을 검사한다.
- 미래 version 새 문서 기본값을 주입해도 복구 문서 내용은 열리고 원래 설정 문자열은 유지되는지, 오류 설정 창에서 명시적으로 초기화 후 새 문서를 만들 수 있는지 확인한다.
- 초기 검사에서 iframe의 display:none 전환이 실제 scroll을 0으로 만드는 결함을 발견했다. `suspend`가 숨기기 전 view를 pending으로 보관하고, 표시 후 기존 retry가 layout을 기다려 scroll을 복원한다. 빠른 탭 전환 중 기존 비동기 restore가 취소되어 복원이 누락되지 않도록 pending identity도 유지한다.
- 결함 재현 증거: document-state-scroll-before-fix.json/png. 수정 후 대표 화면: document-state.png. 이 증거는 한글 2024와의 외부 동등성 검증이 아니다.

최종 통합 실행: 2026-10-11T07:58:08.271Z 빌드, customSourceSha256 `9add5c2cf31107e95559656acc9cc242935b3e8b41820be90dbb82cc03b6b70e`. 14단계 모두 통과했으며 관측된 main 페이지 오류 0개, 외부 네트워크 요청 0개다. 테스트 서버와 브라우저는 종료했다.

추가 최종 시나리오:

- 업무 1의 첫 문서를 125%·scrollTop 210으로 둔 채 업무 2를 만들고 90%로 설정한다. 업무 1 재진입 및 reload 후 실제 DOM 스크롤/배율, 업무 2 재진입 후 90% 유지까지 확인했다.
- 별도 새 BrowserContext에 미래 version 기본값만 저장하고 복구 문서 없이 시작했다. 설정 원인을 10초 이내에 알리고 기존 문자열을 보존한다. 상단 설정에서 사용자가 명시적으로 기본값을 초기화하고 새로고침하면 정상 편집기로 복귀한다.

남은 한계: 네이티브 Windows 파일 선택기·실제 한글 IME·설치 글꼴의 한글 2024 렌더링 동등성은 이 headless 검사로 판단하지 않는다. 실제 한글 프로그램의 동일 문서/설정 비교는 계속 BLOCKED_REFERENCE다.
