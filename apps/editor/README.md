# Jueony 업무·채팅·문서 편집 MVP

2026-10-11. 왼쪽 업무/채팅/폴더, 가운데 AI 대화, 오른쪽 실제 HWP/HWPX 편집기를 연결했다. 한글 2024 전체 기능·화면·호환성 100%를 구현한 제품은 아니다. 실제 기관 LLM과 한글 독립 검수는 대기 중이다.

## 실행

프로젝트 루트 또는 build/jueony-mvp의 Start-Jueony.cmd를 실행한다. 묶음의 dist, runtime, server.mjs, providers, LICENSE와 고지 파일을 함께 유지한다. Edge/Chrome이 필요하며 Node.js 22 런타임은 동봉했다. PowerShell 스크립트가 127.0.0.1:4173에서 동봉한 Node 서버를 시작하고 편집 창을 연다. 새 Rust exe는 컴파일했으나 이 PC의 OS 애플리케이션 제어에 실행이 차단되었다. 이전 정적 서버가 같은 포트를 점유 중이면 이전 창의 문서를 저장하고 서버를 종료한 뒤 실행한다.

업무와 채팅을 만들고 로컬 폴더를 연결한다. 원본을 복사하거나 이동하지 않으며 연결 해제도 원본을 삭제하지 않는다. 파일/폴더를 체크한 경우에만 요청 자료로 읽는다. HWP/HWPX와 UTF-8 TXT/MD를 지원한다. PDF/DOCX/XLSX/OCR은 미지원이다.

AI 연결 설정에서 GPT Responses, Claude Messages, Gemini GenerateContent, HyperCLOVA X v3 또는 OpenAI 호환 Chat Completions를 선택하고 endpoint, 연결 이름, 모델 ID, 키를 등록한다. 세 새 provider의 사용법과 실제 호출 미검증 범위는 [최신 연결 가이드](../../docs/20-native-providers-and-editing.md)를 읽는다. 일반 NAVER Cloud 계정은 [HyperCLOVA 가이드](../../docs/14-hyperclova-x-api-guide.md)를 따른다. 합성 연결 테스트는 문서/자료 없이 API를 1회 호출한다. 2026-10-11 서비스 HCX-005의 실제 생성·수정·undo·저장 흐름을 검증했다. 초안 품질과 기관망 검증은 별도다.

키는 Windows 계정별 DPAPI 암호화 저장을 선택할 수 있다. 저장 시 재시작 후 복원한다. 미선택 시 서버 메모리에만 두며 창을 닫아도 서버가 실행 중이면 유지된다. AI 연결 설정에서 키 교체, 새 연결, 선택 연결 삭제, 모든 키 삭제를 제공한다. 일반 로그/채팅/IndexedDB에는 키를 기록하지 않는다. 실행 묶음에 connection-store.mjs와 credential-protect.ps1도 함께 유지한다.

## 편집과 저장

새 초안, 여러 본문 위치의 삽입·교체·삭제, 글자/문단 서식, 새 표·단순 셀·셀 서식·행/열 삽입과 삭제, 기존 구역의 용지·여백을 직접 적용한다. 본문과 구조 변경 비교/요청 undo를 제공한다. 한글 2024 단축키는 상단 단축키 버튼에서 확인한다. AI 문단 이동·개체·병합/중첩 표·자동 저장은 아직 미지원이다. [구현 범위와 검증](../../docs/17-editor-control-implementation.md)을 참고한다. 이전 서버가 실행 중이면 문서를 저장하고 창을 닫은 뒤 루트의 Restart-Jueony.cmd로 재시작한다.

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

최신 자동 검사 수와 결과는 [증거 기록](../../docs/evidence/native-agent-2026-10-11/README.md)을 따른다. 네이티브 Windows 폴더 선택기는 OPFS 핸들로 대체해 검사했다. 한국어 IME, 실제 한글, 실제 기관 API, OS 전체 인터넷 차단 검수는 별도다. 엔진의 중간/렌더/rollback 실패 주입과 강제 종료 복구도 남았다.

Rust 런처는 std로 빌드한다. HTTP/TLS 의존성과 Tauri 호스트 빌드는 이 PC의 Windows 애플리케이션 제어에 막혀 현재 경로는 PowerShell 시작 스크립트와 동봉한 Node 표준 서버를 사용한다. 정책을 변경하지 않았다. 설치 서비스나 자동 시작을 등록하지 않는다.

## 문서와 고지

소스 저장소에서는 docs/12-mvp-implementation.md, docs/mvp-acceptance-results.csv를 읽는다. 실행 묶음에서는 MVP-GUIDE.md를 읽는다. build-evidence.json과 bundle-evidence.json에 소스/런타임 해시를 기록한다.

Jueony 자체 부분에는 LICENSE.txt의 개인·비업무용 조건이 적용된다. 제3자 원래 라이선스가 우선한다. rhwp MIT, 원본 부속 고지, fonts/licenses, Rust 표준 라이브러리 고지와 runtime/LICENSE.Node.txt를 보존한다. 한컴/Windows 상용 글꼴을 추출해 포함하지 않았다. 기관 배포용 전체 SBOM·고지는 후속 확정 사항이다.

폴더 연결 없이 채팅의 참고 파일 버튼·드래그·파일 붙여넣기로 임시 자료를 지정할 수 있다. 첨부는 채팅별로 분리하며 새로고침 시 해제된다. 인터넷 공개 검사 문서는 소스 루트의 .tools/public-documents에만 보관하고 실행 묶음에 재배포하지 않는다. [검수 방법](../../docs/21-public-document-validation.md), [RAG·Agent 설계](../../docs/22-agent-retrieval-execution-design.md).
