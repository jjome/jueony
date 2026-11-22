# 이음오피스 선별 적용 결과

2026-11-21. Jueony 제품 기준 `f550d472`. 이음오피스 v0.13.0 커밋 `8602a39410adb86037f3008588b64efc75b08c60`의 필요한 파일 18개를 개별 다운로드했다. 구현 순서와 범위는 [144번 계획](144-ieumoffice-reuse-plan.md#implementation-start)을 따른다. 선택한 원본 파일, 적용 엔진, 배포 자산과 검사 결과는 [검증 매니페스트](evidence/ieum-implementation-2026-11-21/manifest.json)에 기록했다.

## Windows에서 실행

프로젝트 루트의 [Start-Jueony.cmd](../Start-Jueony.cmd)를 실행한다. `apps/editor/dist`는 패치 엔진으로 빌드했으며, Windows용 휴대 Node 24.22.3을 `.tools/node-v24.22.3-win-x64`에 준비했다. 실행기는 이 폴더의 Node를 우선 사용한다. [Windows 빌드 스크립트](../scripts/Build-Jueony.ps1)는 엔진을 직접 지정하지 않으면 최근에 완성된 로컬 엔진을 찾아 패치 목록과 해시를 검증한 뒤 사용한다. `Start-Jueony-FileReview.cmd`는 이전 파일 검수 묶음용이다.

`rhwp` 원본은 `upstream/rhwp-source`의 고정 커밋 `1a76570e833917d15817415a53c09ad61ab3203f`다. `npm ci`로 앱 의존성을 복원했고 PDF·DOCX 읽기 패키지를 잠금 파일에 추가했다. 시스템에 WSL Ubuntu가 없어 프로젝트 폴더의 Rust 1.93.1 GNU와 LLVM-MinGW를 사용했다. GNU 호스트 빌드 스크립트 링크에는 Rust 툴체인의 `self-contained` 디렉터리를 `LIBRARY_PATH`로 전달했고 `wasm-bindgen` 0.2.127로 Web 바인딩을 만들었다. 패치 전체 목록과 빌드 해시는 `build/rhwp-engine/source-5979813cbfb10a78/pkg/jueony-engine-build.json`에 있다.

Windows PowerShell 기본 설정에서 로컬 실행 스크립트와 DPAPI 보조 스크립트가 차단되는 것도 확인했다. 두 진입점은 해당 프로세스에서 `RemoteSigned`로 실행한다. Windows 사용자·컴퓨터 정책 설정과 DPAPI의 평문 저장 거부는 유지한다.

## 구현과 확인 범위

| 단계 | 사용할 수 있는 기능 | 확인한 범위와 남은 일 |
| --- | --- | --- |
| IU00 | 패치 엔진과 기본 앱 실행 | 원본·패치 해시, 빌드, WASM 수식·쪽 번호·셀 문단·저장 재열기, TypeScript. 전체 검사 결과는 아래 검증 기록 참조 |
| IU01 | 검토 → 행정 문서 검사 | 사용 글꼴 구간·중첩 표·찾은 위치로 이동. 규칙 선택 가능. HWP와 HWPX의 바이트 불변. 한글 전용 글꼴 목록은 호환성 참고이며 특수 영역은 제외 |
| IU02 | 한국어 검색·로컬 색인 선택 | 업무·채팅별 SQLite FTS5, 변경된 구간만 재색인, 명시 자료 선택 해제·폴더 해제 시 정리, 임시·미저장 첨부의 메모리 검색. 요청마다 권한을 재확인하며 백그라운드 폴더 감시는 미구현 |
| IU03 | OpenAI 호환 문서·자료 조회 도구 | 본문 읽기·선택 자료 찾기·배치 진단과 최종 본문 교체 하나. 모의 모델에서 실제 도구 결과의 후속 호출, 오류·반복·취소·문서 교체 보호, 파일 저장 재열기·요청 undo 확인. 실제 계정의 모델 품질은 미검증 |
| IU04 | 검토 → 쪽 배치 검사 | 겉 표의 화면 글줄과 셀 아래·종이 경계, 다음 쪽으로 떨어진 제목. 여러 쪽 표는 쪽마다 변하는 셀 번호 대신 문서의 행·열 좌표로 연결한다. 긴 표, 병합 셀, 안 여백의 HWP/HWPX 읽기와 바이트 불변을 확인했다. 화면에서 숨겨진 글줄과 안쪽 표는 추가 검증이 필요하다 |
| IU05 | PDF/DOCX 첨부, 2쪽·4쪽 모아찍기, 메모 목록, AI 변경 요약, 로컬 모델 검색, CLI/MCP 계획 검사 | PDF 텍스트·DOCX 본문/표 추출. 모아찍기는 A4/Letter·방향·여백·홀짝·역순을 지원한다. Chrome에서 5쪽 문서의 2쪽·4쪽 미리보기와 4쪽 모아찍기 PDF 2장을 확인했다. 메모는 본문 읽기·이동을 제공한다. CLI/MCP는 명령 카탈로그와 제공받은 snapshot을 검증한다 |
| IU06 | 중첩 수식의 쪽 배치 갱신과 엔진 비교 | 이음 `0055` 패치는 참조하는 Rust 모듈과 코드 문맥이 고정 rhwp 0.8.7과 맞지 않았다. Jueony 엔진에서 중첩 수식 변경 후 쪽 배치를 직접 갱신하는 패치를 추가했다. 버전 업그레이드와 변환·인증·기관 배포는 남아 있다 |

한국어 검색 후보는 같은 추출문·선택 조건에서 원본 21개, 질문 22개로 비교했다. 첫 결과 재현율은 **27.8% → 66.7%**, 상위 8개 재현율은 **100% 유지**, 평균 역순위는 **0.567 → 0.807**, 무답 오탐은 **4개 중 3개 → 1개**였다. 새 엔진의 파일·추출문과 고정 평가 범위의 계약 69개를 검증했다. 원래 평가 엔진의 과거 바이너리를 그대로 재빌드한 결과는 아니다. 현재·구본 표시가 없는 파일에서 권위는 추정이며, 새 검색은 선택 기능으로 제공한다.

도구 실행과 모델 목록 확인은 모의 로컬 서버를 사용했다. 실제 공급자와 한글 2024, 기관망, 실물 프린터는 이번 검증 환경에서 확인하지 못했다.

중첩 수식의 저장 차단은 변경 전 `f550d472`에서도 재현됐다. HWP와 HWPX 모두 수식이 있는 내부 셀 높이는 즉시 반영됐고 겉 표의 높이는 저장본을 다시 연 뒤에야 59.3에서 63.1로 바뀌었다. 엔진의 기존 페이지 갱신으로 편집 직후와 재열기 결과를 맞췄다. 저장 시 허용 오차와 원본 쓰기 보호 규칙은 건드리지 않았다.

최종 Windows 실행 및 재빌드, TypeScript, 모듈 경계 검사와 Chrome 사용 흐름을 통과했다. 편집기 2,008건 중 2,007건 통과, 실패 0건, 미패치 엔진용 조건부 검사 1건을 건너뛰었다. 실행기 53건과 작업 목록 12건도 통과했다. 중첩 수식은 양 형식의 계산값·이웃 표·되돌리기를 검사했다. 텍스트가 없는 PDF와 손상된 DOCX는 모델 호출 전에 각각 오류를 표시했다. PDF.js worker·CMap·글꼴의 로컬 배포 자산은 186개, 약 3.24 MB다.

## 재검증

```powershell
$env:Path = (Resolve-Path .tools/node-v24.22.3-win-x64).Path + ';' + $env:Path
$env:JUEONY_ENGINE_PACKAGE = (Resolve-Path build/rhwp-engine/source-5979813cbfb10a78/pkg).Path
$env:JUEONY_RAG_OUTPUT = 'build/ieum-reuse/iu02/comparison'
node --experimental-strip-types scripts/verify-rag-corpus.mjs --compare-bm25 --compare-new-engine
node apps/editor/scripts/build.mjs
node apps/editor/node_modules/typescript/bin/tsc --project apps/editor/.build/studio/tsconfig.json --pretty false
$env:JUEONY_TEST_BROWSER = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
node apps/editor/scripts/run-editor-tests.mjs --test-concurrency=4
node --test apps/launcher/tests/*.test.mjs
node apps/editor/scripts/verify-ieum-first-slice.mjs
node apps/launcher/document-cli.mjs catalog
node apps/launcher/document-cli.mjs schema
node apps/launcher/document-cli.mjs dry-run <계획_JSON_경로>
node apps/launcher/document-cli.mjs mcp
```

CLI `dry-run`은 `{snapshot, proposal, sourceIds?}` JSON을 받는다. `mcp`는 로컬 stdio에서 `jueony_document_catalog`, `jueony_check_document_proposal`을 제공한다. 사용자가 전달한 계획만 검사하며 앱에서 열어 둔 문서나 로컬 파일을 이 두 MCP 도구가 읽거나 수정하지 않는다. [MCP stdio 규격](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)

PDF.js의 worker·CMap·기본 글꼴은 빌드에 로컬 자산으로 포함된다. PDF는 200쪽 이내의 텍스트 PDF를 지원하며 암호와 OCR이 필요한 파일은 별도 이유를 표시한다. DOCX는 본문과 셀 순서 중심의 텍스트 참조이며, 편집 전환·각주·서식·그림·머리말은 별도 범위다. 라이선스·고지는 [제3자 고지](../THIRD_PARTY_NOTICES.md)에 있다.

## 남은 범위

전체 엔진·표 저장 회귀가 최종 배포 판단의 조건이다. 기관 양식 일괄 쓰기, 중첩 표 구조 변경 범위 확대, 메모 수정·삭제 UI, XLSX·OCR, 외부 CLI/MCP의 실제 문서 명령, 브라우저 계정 로그인, PDF/Word→HWP 손실 관리, 독립 한글·기관망 검증은 각 작업의 기존 완료조건을 따른다. 단축키·복사·붙이기는 기존 보호 경로를 유지하며 새 동작의 유효성은 별도 대조한다.
