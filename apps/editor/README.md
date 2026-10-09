# Jueony 업무·채팅·문서 편집 MVP

2026-10-09. 왼쪽 업무/채팅/폴더, 가운데 AI 대화, 오른쪽 실제 HWP/HWPX 편집기를 연결했다. 한글 2024 전체 기능·화면·호환성 100%를 구현한 제품은 아니다. 실제 기관 LLM과 한글 독립 검수는 대기 중이다.

## 실행

프로젝트 루트의 Start-Jueony.cmd 또는 build/jueony-mvp/JueonyEditor.exe를 실행한다. 묶음의 dist, runtime, server.mjs, providers, LICENSE와 고지 파일을 함께 유지한다. Edge/Chrome이 필요하며 Node.js 22 런타임은 동봉했다. Rust 런처가 127.0.0.1:4173에서 로컬 서버를 시작하고 편집 창을 연다. 이전 정적 서버가 같은 포트를 점유 중이면 이전 창의 문서를 저장하고 서버를 종료한 뒤 실행한다.

업무와 채팅을 만들고 로컬 폴더를 연결한다. 원본을 복사하거나 이동하지 않으며 연결 해제도 원본을 삭제하지 않는다. 파일/폴더를 체크한 경우에만 요청 자료로 읽는다. HWP/HWPX와 UTF-8 TXT/MD를 지원한다. PDF/DOCX/XLSX/OCR은 미지원이다.

AI 연결 설정에서 OpenAI 호환 Chat Completions endpoint, 연결 이름, 모델 ID, 키를 등록한다. 설정 등록 후 실제 요청에서 인증/모델을 확인한다. 제공자와 모델 선택을 분리했고 등록한 연결만 표시한다. 실제 키가 제공되지 않아 자동 검증은 로컬 HTTP fixture로 수행했으며 이것을 실제 LLM 실행으로 보고하지 않는다.

키는 서버 메모리에만 보관한다. 창을 닫아도 서버는 실행 중일 수 있다. AI 연결 설정의 연결 키 삭제 버튼으로 제거할 수 있다. 서버 재시작 후에는 키를 다시 입력한다.

## 편집과 저장

새 초안, 여러 본문 위치의 삽입·교체·삭제를 직접 적용하고 결과 비교/요청 undo를 제공한다. AI 표·서식·문단 이동·개체·쪽 설정·자동 저장 명령은 아직 없다. 단순 본문에서만 AI 편집을 지원하며 필드·개체·혼합 서식·4,000자 초과 문단은 제한한다. 수동 편집기 기능은 유지한다.

일반 Edge/Chrome은 File System Access API로 열고 저장한다. 원본 SHA-256 및 문서 revision을 검사하고 저장 중 입력을 잠근다. 외부 프로세스와의 디스크 교체 경쟁을 완전히 막는 파일 잠금은 아니다.

API가 없거나 ?storage=download이면 다운로드로 저장한다. 저장 확인 버튼은 실제 파일 다운로드를 사용자가 확인한 뒤 누른다. 취소하면 dirty/복구본을 유지한다. 자동 검사에서는 다운로드된 실제 HWP의 본문을 재파싱했다.

동일 프로필/origin의 IndexedDB v1에 업무·채팅·연결·최근 문서·미저장 초안을 복원한다. 복구본은 원본 핸들을 유지하지 않으므로 다른 이름으로 저장한다. 재실행 후 요청 undo 이력, 프로필 이동/삭제 복구, 저장 직전 강제 종료 보장은 없다. 동시에 열린 두 번째 앱 창은 쓰기를 막는다.

## 빌드와 검사

고정 참조: upstream/rhwp-source, commit 1a76570e833917d15817415a53c09ad61ab3203f. 빌드가 .build/studio 사본에 자체 연결 코드를 주입하며 upstream tracked 파일을 바꾸지 않는다. 엔진은 공식 @rhwp/core@0.8.7 WASM 배포본이며 이 빌드에서 Rust 엔진 자체를 다시 컴파일하지 않았다.

앱 폴더에서:

```powershell
npm ci
npm run build
npm run typecheck
npm test
```

프로젝트 루트에서:

```powershell
.\scripts\Build-Standalone.ps1
node --test apps/launcher/tests/server.test.mjs
# 개발 서버/편집 창:
.\scripts\Start-Jueony.ps1
```

UI 통합 검사는 실행 중인 전용 검증 서버(기본 4193)를 대상으로 앱 폴더에서 실행한다. 기존 사용자 브라우저 대신 임시 headless Edge 프로필을 사용한다. 로컬 제공자 fixture 4194 포트도 필요하다.

```powershell
# 프로젝트 루트의 별도 터미널:
$env:JUEONY_DIST = Join-Path (Get-Location) 'apps/editor/dist'
$env:JUEONY_PORT = '4193'
node apps/launcher/server.mjs
# 앱 폴더의 별도 터미널:
node scripts/verify-mvp.mjs
```

JUEONY_TEST_URL로 대상 URL을 바꿀 수 있다. 이 값은 검증 스크립트용이다. 테스트 설정과 합성 자료는 격리된 프로필에만 저장한다.

자동 검사: 앱/엔진 19, 서버 7, UI 통합 18. 네이티브 Windows 폴더 선택기는 OPFS 핸들로 대체해 검사했다. 한국어 IME, 실제 한글, 실제 기관 API, OS 전체 인터넷 차단 검수는 별도다. 엔진의 중간/렌더/rollback 실패 주입과 강제 종료 복구도 남았다.

Rust 런처는 std로 빌드한다. HTTP/TLS 의존성과 Tauri 호스트 빌드는 이 PC의 Windows 애플리케이션 제어에 막혀 현재 경로는 동봉한 Node 표준 서버를 사용한다. 정책을 변경하지 않았다. 설치 서비스나 자동 시작을 등록하지 않는다.

## 문서와 고지

소스 저장소에서는 docs/12-mvp-implementation.md, docs/mvp-acceptance-results.csv를 읽는다. 실행 묶음에서는 MVP-GUIDE.md를 읽는다. build-evidence.json과 bundle-evidence.json에 소스/런타임 해시를 기록한다.

Jueony 자체 부분에는 LICENSE.txt의 개인·비업무용 조건이 적용된다. 제3자 원래 라이선스가 우선한다. rhwp MIT, 원본 부속 고지, fonts/licenses, Rust 표준 라이브러리 고지와 runtime/LICENSE.Node.txt를 보존한다. 한컴/Windows 상용 글꼴을 추출해 포함하지 않았다. 기관 배포용 전체 SBOM·고지는 후속 확정 사항이다.
