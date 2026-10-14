# Jueony — 공무원용 AI 문서 편집기

폐쇄망 Windows PC에서 업무별 자료와 대화를 관리하고, 가운데 채팅의 요청으로 오른쪽 HWP/HWPX 문서를 AI와 함께 직접 편집하는 프로그램을 만든다. **현재는 본문·단순 표 행/열·서식·쪽 설정과 한글 단축키를 연결한 MVP 개발판**이다. 한글 2024 전체 기능·화면·파일 호환성 100%를 달성한 상태는 아니다. [통합 기반 구현 결과](docs/44-editor-stages-result.md), [쪽 편집 후속 구현·검증](docs/59-empty-body-section-removal.md), [설치 한글 2024와의 비교·미구현 목록](docs/29-hangul-2024-comparison.md)을 참고한다. 다음 신규 기능 병렬 구현에 앞서 [레이어·모듈 리팩터링 계획](docs/30-layered-modular-refactor-plan.md)과 [Facade 계약](docs/31-facade-contracts.md)의 핵심 모듈 첫 이관을 적용했다. [리팩터링 적용 결과와 남은 이관](docs/32-modular-refactor-result.md)을 확인한다.

## 이용허락

자체 코드·자산에는 **[Jueony Personal Use License 1.0](LICENSE.txt)**이 적용된다. 개인의 사적·비업무용 사용은 무료다. **행정·직무·조직 업무, 상업적 사용, 프로그램 수정·수정본 사용 및 유무상 재배포에는 별도의 사전 서면 허락이 필요하다.** 문서 편집과 프로그램 코드 수정은 구분한다.

제3자 오픈소스·글꼴 등에는 각각의 원래 라이선스가 우선한다. [제3자 고지](THIRD_PARTY_NOTICES.md)와 [적용 기록](docs/09-licensing.md)을 참고한다. 기관용 개발이라는 제품 목표가 기관의 무료 사용을 허가하는 것은 아니다. 기관 사용은 별도 계약 대상으로 둔다.

## 바로 실행

최신 검수본은 **[Start-Review.cmd](build/jueony-agent-header-format-20261014/Start-Review.cmd)**로 실행한다(4262). AI가 기존 단순 머리말·꼬리말의 텍스트와 기본 글자 서식을 수정한다. 굵게·기울임·밑줄·1~200pt 크기·RGB 색을 전체 한 문단에 적용하고 텍스트·문단·홀짝·감추기·본문을 보존한다. [사용법·검증·제한](docs/69-agent-header-font-format.md)을 확인한다. 생성/삭제·글꼴 종류/문단 모양·필드·개체·혼합/여러 문단은 남는다. 기존 실행 창과 사용자 문서는 유지한다.

이전 단계별 통합 검수본은 [4203 실행 묶음](build/jueony-pre-agent-20261013/Start-Review.cmd)과 [구현 결과](docs/44-editor-stages-result.md)를 참고한다.

[RAG 평가용 합성 예제](fixtures/rag-evaluation/README.md)는 HWP/HWPX·TXT·MD 자료 21개와 질문 22개다. [폴더 연결·검색 평가 방법과 현재 품질 기준선](docs/45-rag-evaluation-corpus.md)을 참고한다. 자료 추출·출처·업무 격리 검사와 모델 답변 품질 검사는 구분한다.

최신 문단·선택 저장 검수본은 **[Start-Review.cmd](build/jueony-selection-state-20261012/Start-Review.cmd)**로 실행한다(4198). 문단 여백·첫 줄 키와 본문/표 셀 선택 저장, 종료 직전 위치 복원을 보강했다. [구현·검증·제한](docs/38-paragraph-selection-state-result.md), [한글 대화상자 도구 오류 조사](docs/39-native-dialog-investigation.md)를 확인한다.

최신 기본 편집·상태 저장 검수본은 **[Start-Review.cmd](build/jueony-basic-state-20261012/Start-Review.cmd)**로 실행한다(4197). 대화상자 키 처리·종료 보호·본문 커서 복원·Ctrl+1~0 기본 스타일을 보강했다. [검사 결과와 실제 한글 조작 도구의 남은 제한](docs/37-basic-editing-state-result.md)을 확인한다.

최신 실제 한글 비교·탭 저장 보정 검수본은 **[Start-Review.cmd](build/jueony-native-tabs-20261012/Start-Review.cmd)**로 실행한다(4196). Delete/Backspace 구역 병합을 실제 한글 2024에서 확인하고 HWPX 기본 탭 저장 값을 수정했다. [확인 범위·결함·검증 결과](docs/36-native-section-comparison.md)를 참고한다.

최신 경계 합치기 검수본은 **[Start-Review.cmd](build/jueony-section-merge-20261012/Start-Review.cmd)**로 실행한다(4195). 본문 구역 경계의 Delete/Backspace, 앞 구역 설정 유지와 undo/redo·저장을 연결했다. [지원 범위와 한글 직접 비교 제한](docs/35-section-boundary-merge-result.md)을 확인한다. 이전 묶음과 업무 저장소는 유지한다.

최신 구역·탭 검수본은 **[Start-Review.cmd](build/jueony-sections-tabs-20261012/Start-Review.cmd)**로 실행한다(4194). Alt+Shift+Enter로 실제 구역 분할, 구역별 기본 탭 간격, 저장·되돌리기를 보강했다. [지원 범위·검증·실제 한글 비교 제한](docs/34-sections-tabs-result.md)을 확인한다. 포트별 업무 저장소가 달라 기존 업무·연결이 자동으로 표시되지 않을 수 있다.

이전 기능 검수본은 **[Start-Review.cmd](build/jueony-features-20261011/Start-Review.cmd)**로 실행한다(4193). F6 스타일, 캡션 위치·되돌리기, 머리말/꼬리말 창, 영구 쪽 감추기, 복구 설정과 AI 스타일·다단 명령을 보강했다. [지원 범위·검증·남은 차이](docs/33-editor-parity-features-result.md)를 확인한다.

리팩터링 검수본은 **[Start-Review.cmd](build/jueony-refactor-20261011/Start-Review.cmd)**로 실행한다(4192). [모듈 구조·검사·남은 이관](docs/32-modular-refactor-result.md)을 참고한다. 기존 4173/4191 실행 묶음은 유지한다.

이전 자율 구현 검수본은 **[Start-Review.cmd](build/jueony-continuation-20261011/Start-Review.cmd)**로 실행한다(4191). 통합 메뉴, 문서 기본값·배율·스크롤 복원, 지정 자료 검색, 적용 전 후보 검토, 반복 작업/업무 초안을 추가했다. 기존 4173 앱과 저장소가 분리되므로 새 업무 화면이 보일 수 있다. [지원 범위·검사·남은 작업](docs/28-continuation-implementation.md)을 확인한다. 아래 기본 실행기는 이전 4173 묶음을 유지한다.

프로젝트명은 **Jueony**이며, 현재 로컬 루트는 `C:\Users\jjome\Documents\work\jueony`다. [이름 변경 기록](docs/08-project-name.md)을 참고한다.

프로젝트 루트의 **[Start-Jueony.cmd](Start-Jueony.cmd)**를 더블클릭한다. PowerShell 실행 스크립트가 준비된 `build/jueony-mvp`의 동봉 런타임으로 로컬 서버를 시작하고 Edge 또는 Chrome의 독립 창을 연다. 새 Rust exe는 컴파일했으나 이 PC의 애플리케이션 제어가 실행을 차단하여 기본 진입점은 cmd 스크립트다. 실행 묶음에는 WASM·글꼴·자산과 Node.js 22 런타임이 들어 있어 Node.js를 별도로 설치할 필요가 없다. 브라우저는 PC에 설치되어 있어야 한다.

- 왼쪽에서 업무·독립 채팅을 만들고 여러 폴더를 연결한다. 가운데의 AI 연결 설정에서 실제 endpoint·모델·키를 등록하면 채팅 요청을 오른쪽 문서에 직접 반영한다.
- AI 대화와 문서 사이의 분할선을 드래그해 너비를 조절한다. 좌우 방향키도 지원하며 두 번 클릭/Enter로 초기화한다. 설정은 재실행 후 복원된다.
- 채팅은 Enter로 전송하고 Shift+Enter로 줄바꿈한다. 작업 진행은 대화에 표시하고 오류는 입력창 아래에서 확인한다.
- GPT·Claude·Gemini·HyperCLOVA X를 각각 등록하고 저장된 연결에서 키·모델을 관리한다. 세 새 제공자는 실제 계정 키 등록 후 연결 테스트가 필요하다.
- 참고 파일 버튼·드래그·파일 붙여넣기로 폴더 없이 HWP/HWPX/TXT/MD를 첨부한다. 임시 첨부는 채팅별로 분리되고 새로고침 시 해제된다.
- 새 문서, HWP/HWPX 열기, 본문 입력, 제목 서식, 문단 정렬, 표 삽입·셀 입력, 되돌리기/다시 실행을 사용한다.
- 아래쪽 문서 탭과 오른쪽 스타일 창이 있다. 탭마다 문서·커서·undo 이력을 유지한다.
- 일반 Edge/Chrome에서는 파일 선택 대화상자로 열고 저장한다. 다운로드 모드에서는 파일 저장을 확인한 후 **저장 확인**을 눌러야 수정 상태가 해제된다.
- 검수할 예제는 [기본 HWP](apps/editor/fixtures/three-paragraphs.hwp), [기본 HWPX](apps/editor/fixtures/three-paragraphs.hwpx), [표 HWP](apps/editor/fixtures/schedule-table.hwp), [표 HWPX](apps/editor/fixtures/schedule-table.hwpx)다.

[HyperCLOVA X 연결 가이드](docs/14-hyperclova-x-api-guide.md), [최신 MVP 실행·지원 범위·검증 결과](docs/12-mvp-implementation.md), [개발·빌드 방법](apps/editor/README.md)을 먼저 읽는다. 복잡한 원본 문서는 사본으로 검수한다. 현재 빌드의 글꼴 대체와 미지원 개체 때문에 한글에서의 지면·개체 보존을 별도로 확인해야 한다.

문서 엔진은 Rust/WASM, 화면·Agent는 TypeScript, 로컬 API는 동봉한 Node 서버다. **rhwp가 열린 문서 상태를 소유**한다. workspace·채팅·지정 자료·OpenAI 호환/HyperCLOVA X adapter·요청 undo를 연결했다. 2026-10-11 실제 HCX-005로 본문 편집과 4×3 일정표·제목/셀 서식·A4 가로/여백 변경을 확인했다. 키는 Windows DPAPI 암호화 저장을 선택하고 설정에서 교체·삭제한다. 개체·병합/중첩 표·고급 기능·외부 MCP와 한글 독립 검수는 남아 있다. 이전 서버가 떠 있으면 문서를 저장하고 창을 닫은 뒤 [Restart-Jueony.cmd](Restart-Jueony.cmd)를 실행한다.

## 프로젝트 문서

| 문서 | 다루는 결정 |
| --- | --- |
| [다른 용지의 쪽 붙이기](docs/56-different-paper-page-paste.md) | 4232 검수본, 새 구역과 뒤 본문 용지 복원·문단 서식·단일 undo·저장과 제한 |
| [기본 쪽 모양 이식](docs/57-basic-page-style-paste.md) | 4234 검수본, 테두리·단색·두 색 그러데이션의 새 구역 이식과 뒤 본문 복원·거절 검사 |
| [그림 배경의 쪽 복사·붙이기](docs/58-embedded-page-image-paste.md) | 4236 검수본, 내장 PNG/JPEG 자산 이식·자산 번호 충돌 방지·뒤 배경 복원·저장/거절 검사 |
| [빈 본문 구역 삭제](docs/59-empty-body-section-removal.md) | 4238 검수본, 구역 분리 설정 보존·커서 이동·undo/redo·저장과 HWPX 캐럿 제한 |
| [쪽 본문 복사·붙이기](docs/55-page-body-copy-and-paste.md) | 4230 검수본, 내부 복사 버퍼·서식 자원 이식·한 번의 undo·저장과 미지원 범위 |
| [기본 편집·상태 보존 보강](docs/33-editor-parity-features-result.md) | 4193 검수본, 캡션·감추기·머리말·복구·17종 AI 명령과 저장 보존 검사 |
| [통합 UI·상태·검색·검토·반복 작업](docs/28-continuation-implementation.md) | 새 검수본 실행, 실제 Claude 확인, 한글 검수용 파일과 미완료 범위 |
| [이번 자율 구현 결과와 다음 실행](docs/23-autonomous-work-result.md) | 완료 항목·실제 검증·아침 사용 순서와 남은 범위 |
| [제공자 3종·표 행열·서식·임시 첨부](docs/20-native-providers-and-editing.md) | GPT·Claude·Gemini 설정과 키 관리, 실제 구현 및 검증 한계 |
| [공개 문서 호환성 검사](docs/21-public-document-validation.md) | 인터넷 표본 5개, 재열기 결과, 알려진 차이와 실제 한글 검수 파일 |
| [RAG·Agent 실행 설계](docs/22-agent-retrieval-execution-design.md) | 로컬 검색·문맥·제한된 loop·MCP·평가 사례와 단계별 적용 계획 |
| [Agent 입력과 새 문서 작성 오류 수정](docs/19-agent-interaction-fix.md) | Enter 전송, 중복 삽입 처리, 진행·오류 표시, 실제 초안·후속 편집 검사 |
| [영역 크기 조절과 현재 Agent 검사](docs/18-pane-resize-agent-check.md) | 드래그·키보드·너비 복원과 실제 실행 서버에서의 HCX-005 편집 검사 |
| [단축키·AI 구조 편집 구현 결과](docs/17-editor-control-implementation.md) | 실제 지원 범위, 하이퍼클로바 실호출, 저장 검수 파일, 남은 작업 |
| [한글 2024 단축키 구현과 검증](docs/16-hangul-shortcuts-plan.md) | 공식 매핑, 겹글쇠·IME·셀/개체 문맥, 포커스 격리, Windows 예약키 전달 |
| [전체 편집 기능의 AI 제어 작업 계획](docs/15-ai-editor-control-plan.md) | 구현 전 명세: 표·서식·개체·쪽 설정부터 전체 기능의 공통 제어 API, Agent, MCP 연결과 [기능별 작업 목록](docs/ai-editor-capability-matrix.csv) |
| [LLM 제공자 4종 구현 명세](docs/13-llm-provider-adapters.md) | GPT·Claude·Gemini·HyperCLOVA X의 계약, 구현 상태, 다음 작업 |
| [HyperCLOVA X API 사용 가이드](docs/14-hyperclova-x-api-guide.md) | 일반 NAVER Cloud 계정, 키 발급, 합성 연결 검사, 편집 검수 |
| [MVP 구현 결과와 사용법](docs/12-mvp-implementation.md) | 현재 실행 묶음, 지원 범위, 확장 위치, 검증 한계, 한글 검수용 문서 |
| [Workspace·채팅·AI 직접 편집 MVP](docs/11-workspace-agent-mvp-plan.md) | 최신 방향: M00~M12 작업, Ports and Adapters, 직접 적용·undo, V01~V28 수용 검사 |
| [기본 편집기 보강 작업 계획](docs/10-basic-editor-work-plan.md) | 구현 전 작업 지시서: 13개 작업, 완료 기준, 의존 관계, [54개 검사 목록](docs/basic-editor-checklist.csv) |
| [현재 한글 2024 편집기 개발판](docs/07-hangul-2024-editor.md) | 실행, 구현 상태, 실측 검증, 아침 검수와 남은 과제 |
| [제품 요구사항과 초기 범위](docs/01-product-requirements.md) | 사용자 흐름, 자료 범위, 첫 검증과 초기 제품의 구분 |
| [저장소 재검증과 재사용 판단](docs/02-source-audit.md) | 현재 커밋, 코드 근거, 재사용 모듈과 신규 개발 |
| [편집 엔진 연결 설계](docs/03-editor-architecture.md) | 문맥 adapter, 수정 명령, 충돌, 저장, 로컬 실행 |
| [문서 호환성 검증 계획](docs/04-compatibility-validation.md) | 무수정 저장과 편집 저장, 실제 한글 검수, 증거 묶음 |
| [단계별 구현 계획과 첫 검증 과제](docs/05-implementation-plan.md) | 단계별 진입·완료 조건, 첫 작업 목록, 중단 기준 |
| [라이선스와 배포 구성 관리](docs/06-license-inventory.md) | MIT 확인, 개별 자산 조건, 배포 전 고지 작성 |

## 확인된 소스 기준

2026년 10월 9일 한국 시간 기준 원격 기본 브랜치와 태그를 직접 확인했다.

| 저장소 | 분석 경로 | 기본 브랜치 커밋 | 소스 버전 |
| --- | --- | --- | --- |
| [gongmuwon](https://github.com/Kminer2053/gongmuwon) | `upstream/gongmuwon` | `ef84271059eb178a08e4a358d761dab10ada7a78` | 0.1.14 |
| [rhwp](https://github.com/edwardkim/rhwp) | `upstream/rhwp-source` | `1a76570e833917d15817415a53c09ad61ab3203f` | 0.8.7 |

두 기본 브랜치 커밋은 이전 조사 기준과 같다. rhwp 개발 브랜치 `devel`은 별도 커밋이며, 이번에 비교한 LICENSE·editor wrapper·Document Agent·embed·plugin·Studio 조립점에는 기본 브랜치 대비 차이가 없었다. 전체 개발 브랜치의 동일성을 뜻하지 않는다.

두 참조 저장소는 해당 커밋의 전체 작업 파일을 확보했다. rhwp는 분석용 부분 복제로 시작한 뒤 전체 체크아웃으로 확장했으며, 41,624개 tracked 파일에 누락된 HEAD 객체와 sparse 제외 경로가 없다. Git 이력은 shallow 상태이므로 전체 과거 커밋을 받은 것은 아니다. **소스 확보와 실행 가능한 오프라인 빌드 묶음 준비는 별개다.** 기존 `upstream/rhwp`의 별도 소스 중심 사본은 보존했으며, 이 문서의 전체 참조 기준 경로는 `upstream/rhwp-source`다.

## 최신 MVP 검증 결과

최신 확장은 세 native adapter·설정·암호화 키·단순 표 행열·글꼴·임시 첨부를 검사했다. [최신 검사 기록](docs/evidence/native-agent-2026-10-11/README.md)에 실행 수와 실제 API/합성 응답의 차이를 기록한다. 인터넷 공개 문서 5개 중 4개는 내용 재열기 검사를 통과했고 1개는 HWP 끝 빈 문단 차이를 발견했다. 실제 한글 독립 검수는 남아 있다. 이전 HCX-005 실호출은 [기존 기록](docs/evidence/hyperclova-live-2026-10-11/README.md)에 보존한다.

## 기본 편집기 단계의 이전 검증 결과

- rhwp `npm/editor` 기존 계약 테스트: **32 통과, 실패 0, 건너뜀 0**. [실행 로그](docs/evidence/rhwp-editor-tests-2026-10-09.txt)
- gongmuwon 백엔드 테스트: 필요한 Python 의존성이 설치되어 있지 않아 이번에는 미실행.
- 새 편집기 테스트 **8 통과**: 기본 문단·표의 HWP/HWPX 재저장, 저장 중 수정·외부 변경·쓰기 실패 보호.
- Rust 런처 HTTP 통합 검증 **13 통과**: 화면/엔진 제공, MIME·바이트 무결성, 경로 이탈·잘못된 Host·쓰기 요청 거부.
- 로컬 WASM 편집 화면에서 입력·서식·표·탭·저장·HWPX 재열기를 확인했다. 사용자가 실제 한글에서 저장 파일 재열기와 한글 입력 성공을 보고했다([기록](docs/evidence/user-validation-2026-10-09.json)). 복잡한 문서 보존·IME 세부 사례·OS 수준 인터넷 차단·기관 API 호출은 추가 검증이 필요하다.
- Tauri 호스트 소스는 있으나 Windows 애플리케이션 제어가 의존성 빌드 실행을 차단했다. 현재 실행 묶음은 별도로 컴파일·실행한 Rust 런처와 설치된 브라우저를 사용한다.
- [분석 기준과 파일 해시](docs/evidence/source-audit-2026-10-09.json), [호환성 검수 기록 양식](docs/validation-results.csv)

## 다음에 확인할 사항

대표 업무 문서와 기관의 한글 제품·빌드 버전은 미정이다. 우선 본문 중심의 합성 문서로 기술 경로를 검증하고, 표·결재란·글상자가 많은 실제 양식은 별도의 호환성 관문으로 둔다. 기관 endpoint·인증·반출 허용 범위는 실제 AI 연결 단계 전에 확정한다.
