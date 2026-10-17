# XML 로컬 작업 영역 정식76b 검수 묶음

자체 XML/XSD만 사용했다. 최종 독립 실제 Edge13, 정식 앱 통합 실제 Edge7, 전체 unit910(실패0/skip0), TypeScript 및 경계 검사를 보존한다. 전체 unit910에는 XML 전용12가 포함되므로 따로 더해 집계하지 않는다. Engine source23d2545926a179a5/WASM241bf9946102e82ada4e6e825b715f6e3fecd0f231612e977db1b73c923028a2, frontend customSource fd1c9ec6f339321ba822f0f8a2aa97985c6e7c5fffd44181f754ccaaf12558d4.

## 실제 범위

파일 메뉴 → 독립 XML/XSD 작업 영역 → 명시 지원 XSD 구조·타입 검사 → 필드·요소 반복/삭제 → undo/redo → 실제 XML 및 변경하지 않은 XSD 다운로드 → 입력 UI 재열기를 검사했다. 2MB 사전 size 검사로 arrayBuffer 호출0, 실패 시 기존 XML·HWP bytes/state/snapshot/history 불변을 확인했다. 실제 shell Native 종료 coordinator에 합성 OS-close callback을 전달하여 preventDefault1/destroy0/inertfalse 및 열린 dirty XML 보존을 확인했다. 실제 Windows GUI 종료를 실행한 증거는 아니다. 독립 검사 번들은 실제 production XML 소스를 Vite로 컴파일했다.

HWT 템플릿·HWP 필드 매핑·XSL 지면 변환·일반 XSD 전체·지속 XML 복구·XML Agent 연결은 아직 없다. 지원 밖 schema는 전체 거절한다. XML 다운로드 요청을 실제 OS 저장 성공/clean으로 표시하지 않는다. HML을 XML 서식 지원으로 바꾸어 부르지 않으며, 기존 HWP/HWPX 저장 및 복구 계약을 변경하지 않았다. 전체 B009 완료 증거가 아니다.

## 재현

저장소의 source-manifest.json 13개 SHA를 먼저 대조한다. reproduce/는 정확한 검수 코드 사본이다. 상대 import와 저장소 경로를 유지하기 위해 아래 명령은 저장소 원래 scripts/tests에서 실행한다. JUEONY_TEST_OUTPUT은 사용하지 않은 절대 build 경로여야 한다. 설치된 Edge만 쓰며 인터넷/새 권한/설치/실제 사용자 문서는 필요 없다.

PowerShell, 저장소 루트에서:

    $env:JUEONY_ENGINE_PACKAGE='C:/Users/jjome/Documents/work/jueony/build/rhwp-engine/source-23d2545926a179a5/pkg'
    $env:JUEONY_BUILD_PROFILE='file-closure-final76b' # 재빌드 시에는 새 고유 프로필명 사용
    # 기존 봉인 프로필을 덮어쓰지 않는다. 필요 시 apps/editor/scripts/build.mjs로 새 프로필을 빌드한다.
    Set-Location apps/editor
    node --experimental-strip-types --test tests/*.test.ts
    node node_modules/typescript/bin/tsc --project .build/studio-file-closure-final76b/tsconfig.json --pretty false --noEmit
    $env:JUEONY_TEST_OUTPUT='C:/Users/jjome/Documents/work/jueony/build/xml-documents-new-review'
    $env:JUEONY_TEST_PORT='4484'
    node scripts/verify-xml-documents.mjs
    $env:JUEONY_TEST_DIST='C:/Users/jjome/Documents/work/jueony/apps/editor/evidence/dist-file-closure-final76b'
    $env:JUEONY_TEST_OUTPUT='C:/Users/jjome/Documents/work/jueony/build/xml-documents-new-integrated-review'
    $env:JUEONY_TEST_PORT='4485'
    node scripts/verify-xml-documents-integrated.mjs

boundary 원문 실행은 저장소 루트에서 `node scripts/check-module-boundaries.mjs`. 원본 TS 성공 로그는 출력0바이트이며 실제 exit0 확인 후 복사했다. unit 로그의 원래 trailing whitespace와 줄 끝은 바꾸지 않았다.

## 실패와 설치 조사

initial-failures/ 원본을 제거하거나 정상 결과로 고치지 않았다. 처음 standalone 실패는 모달 download 링크 위치를 보강한 뒤 Windows CDP 다운로드 경로가 forward slash이면 완료 직전 canceled임을 기록했고 native 절대 경로로 최종 파일 생성까지 검증했다. close 이벤트의 비동기 DOM 제거 전 재열기한 검수기 준비 문제, 초기 통합 검수 CSS 선택자 오타도 실패 원문 그대로 있다. standalone 초기 검수기 전체 스냅샷은 별도 보관하지 않았고 각 보고서에는 당시 원본 source/verifier SHA가 있다. 최종 검수 코드만 재현 사본으로 제공한다. 초기 전체 unit은 정확 모듈 수9→10 기대 갱신 전 및 엔진 환경변수 누락으로905PASS/1FAIL/4SKIP였으며 최종은910PASS/0FAIL/0SKIP이다.

installed-schema-structure.json은 설치된 라이선스 한글 XSD의 경로/파일명/원본SHA/태그·속성명 통계만 보존한 root 조사다. 설치 XSD/HWT 원문은 포함하지 않는다. 실제 한글 서식 만들기 모달 활성화 실패로 신규 XML golden은 얻지 못했다. 따라서 설치 기본 템플릿 전체 호환이나 실제 한글 XML 비교 PASS를 주장하지 않는다. 이미지·폰트·public/user 문서·API 키·exe는 이 묶음에 없다.
