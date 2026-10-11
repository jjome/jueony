# 기본 편집 보강 검증 증거

실행·범위·제한은 [33번 결과](../../33-editor-parity-features-result.md)를 따른다. `summary.json`은 검사 수, 빌드 hash, 표본 hash를 모은 기록이다. `build-evidence.json`의 `applicationSourceCommit`은 빌드 직전 기준 커밋이며 `applicationSourceDirty: true`는 이 커밋 이후 이번 구현이 포함됐음을 뜻한다. 최종 빌드의 제품 소스 SHA-256은 `3f23ceb30ef5147759370ea4c4ab49a3bce3097922399fc31f4e2eb215480d2a`다. 세 브라우저 결과와 실행 묶음에서 같은 값을 확인했다.

- `editor-tests.txt`: 편집기 250 통과. 실제 npm WASM을 사용하는 저장·재열기·복원 검사 포함.
- `server-tests.txt`: 서버/제공자 47 통과. 합성 HTTP 응답과 저장소 테스트이며 실계정 API 성공을 뜻하지 않는다.
- `parity-result.json`: 신규 수동 편집·AI 명령·복구 10개. 테스트 확장 명령을 임시 등록해 커서 위치를 잡고 엔진 값을 읽었다. 생산 코드에는 테스트 전용 전역을 추가하지 않았다.
- `workbench-result.json`: 통합 메뉴·업무 초안·자료 검색·3회 후보 검토·취소·매크로·재실행 9개. 로컬 결정적 제공자를 사용했다.
- `compatibility-result.json`: 패키징한 서버에서 합성 v1 DB·폴더 handle·이전 매크로·잘못된 복구본 보존·파일 쓰기/읽기·undo 4개.
- `boundaries.json`, `typecheck.txt`: 9개 모듈의 경계 위반/예외 0, 전체 생성 Studio 타입 검사 통과(빈 로그).
- `native-f6.json`: 실제 설치 한글에서 F6 스타일 창 관찰. 이후 도구 오류 때문에 실제 한글 파일 검증은 미실행.
- `documents/`: 합성 검수 파일 7개. 이 파일들의 한글 시각 비교 결과를 기록한 것은 아니다.

격리 포트는 workbench 4206/4207, 호환성 4208, 신규 기능 4210이었다. headless Edge 임시 프로필과 메모리 모델 저장소를 사용했고 종료 시 검사 서버와 브라우저를 닫았다. 공개 실행 검수본은 4193이다. 신규 기능 검사에서 두 번 새로고침 시 중복 `beforeunload` 경고가 남았으며 result의 `consoleErrors`에서 숨기지 않았다. 예외/page error와 외부 네트워크 요청은 0건이다.

재현 명령은 PowerShell에서 아래 순서를 따른다. `node`는 준비된 Node 22 이상을 사용한다. 별도 원본 서버와 포트를 공유하지 않는다.

```powershell
Set-Location apps/editor
node --experimental-strip-types --test tests/*.test.ts
$env:JUEONY_BUILD_PROFILE = 'features'
node scripts/build.mjs
node node_modules/typescript/bin/tsc --project .build/studio-features/tsconfig.json --pretty false
node scripts/verify-parity-features.mjs
$env:JUEONY_TEST_DIST = 'evidence/dist-features'
$env:JUEONY_TEST_OUTPUT = 'evidence/features-workbench'
node scripts/verify-agent-workbench.mjs
Set-Location ../..
node --test apps/launcher/tests/*.test.mjs
node scripts/check-module-boundaries.mjs
./scripts/Build-Standalone.ps1 -OutputName jueony-features-20261011 -FrontendProfile features -ReviewPort 4193
Set-Location apps/editor
$env:JUEONY_TEST_BUNDLE = '../../build/jueony-features-20261011'
$env:JUEONY_TEST_OUTPUT = 'evidence/features-compatibility'
node scripts/verify-refactor-compatibility.mjs
```
