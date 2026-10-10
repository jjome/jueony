# Jueony — 공무원용 AI 문서 편집기

폐쇄망 Windows PC에서 업무별 자료와 대화를 관리하고, 가운데 채팅의 요청으로 오른쪽 HWP/HWPX 문서를 AI와 함께 직접 편집하는 프로그램을 만든다. **현재는 업무·채팅과 실제 문서 편집을 연결한 본문 중심 MVP 개발판**이다. 소스 조사 이후 사용자의 후속 지시에 따라 로컬 실행·편집·저장 구현에 착수했다. 한글 2024 전체 기능·화면·파일 호환성 100%를 달성한 상태는 아니다.

## 이용허락

자체 코드·자산에는 **[Jueony Personal Use License 1.0](LICENSE.txt)**이 적용된다. 개인의 사적·비업무용 사용은 무료다. **행정·직무·조직 업무, 상업적 사용, 프로그램 수정·수정본 사용 및 유무상 재배포에는 별도의 사전 서면 허락이 필요하다.** 문서 편집과 프로그램 코드 수정은 구분한다.

제3자 오픈소스·글꼴 등에는 각각의 원래 라이선스가 우선한다. [제3자 고지](THIRD_PARTY_NOTICES.md)와 [적용 기록](docs/09-licensing.md)을 참고한다. 기관용 개발이라는 제품 목표가 기관의 무료 사용을 허가하는 것은 아니다. 기관 사용은 별도 계약 대상으로 둔다.

## 바로 실행

프로젝트명은 **Jueony**이며, 현재 로컬 루트는 `C:\Users\jjome\Documents\work\jueony`다. [이름 변경 기록](docs/08-project-name.md)을 참고한다.

프로젝트 루트의 **[Start-Jueony.cmd](Start-Jueony.cmd)**를 더블클릭한다. PowerShell 실행 스크립트가 준비된 `build/jueony-mvp`의 동봉 런타임으로 로컬 서버를 시작하고 Edge 또는 Chrome의 독립 창을 연다. 새 Rust exe는 컴파일했으나 이 PC의 애플리케이션 제어가 실행을 차단하여 기본 진입점은 cmd 스크립트다. 실행 묶음에는 WASM·글꼴·자산과 Node.js 22 런타임이 들어 있어 Node.js를 별도로 설치할 필요가 없다. 브라우저는 PC에 설치되어 있어야 한다.

- 왼쪽에서 업무·독립 채팅을 만들고 여러 폴더를 연결한다. 가운데의 AI 연결 설정에서 실제 endpoint·모델·키를 등록하면 채팅 요청을 오른쪽 문서에 직접 반영한다.
- 새 문서, HWP/HWPX 열기, 본문 입력, 제목 서식, 문단 정렬, 표 삽입·셀 입력, 되돌리기/다시 실행을 사용한다.
- 아래쪽 문서 탭과 오른쪽 스타일 창이 있다. 탭마다 문서·커서·undo 이력을 유지한다.
- 일반 Edge/Chrome에서는 파일 선택 대화상자로 열고 저장한다. 다운로드 모드에서는 파일 저장을 확인한 후 **저장 확인**을 눌러야 수정 상태가 해제된다.
- 검수할 예제는 [기본 HWP](apps/editor/fixtures/three-paragraphs.hwp), [기본 HWPX](apps/editor/fixtures/three-paragraphs.hwpx), [표 HWP](apps/editor/fixtures/schedule-table.hwp), [표 HWPX](apps/editor/fixtures/schedule-table.hwpx)다.

[HyperCLOVA X 연결 가이드](docs/14-hyperclova-x-api-guide.md), [최신 MVP 실행·지원 범위·검증 결과](docs/12-mvp-implementation.md), [개발·빌드 방법](apps/editor/README.md)을 먼저 읽는다. 복잡한 원본 문서는 사본으로 검수한다. 현재 빌드의 글꼴 대체와 미지원 개체 때문에 한글에서의 지면·개체 보존을 별도로 확인해야 한다.

문서 엔진은 Rust/WASM, 화면·Agent는 TypeScript, 로컬 API는 동봉한 Node 서버다. 현재 실행 진입점은 PowerShell이며 별도 Rust 런처 소스도 유지한다. **rhwp가 열린 문서 상태를 소유**한다. workspace·채팅·명시 자료·OpenAI 호환/HyperCLOVA X adapter·여러 본문 위치 직접 편집·요청 undo를 연결했다. 실제 기관 LLM은 endpoint와 인증정보가 없어 검증 대기이며 AI 표·서식·개체·쪽 설정은 미지원이다. 키는 서버 메모리에만 보관하며 연결 설정에서 삭제한다. 실제 모델/한글 독립 검수까지 완료한 제품으로 보고하지 않는다.

## 프로젝트 문서

| 문서 | 다루는 결정 |
| --- | --- |
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

앱/엔진 **19개**, 로컬 API **7개**, headless Edge 통합 **18개**가 통과했다. 타입 검사·빌드도 수행했다. 모델은 실제 LLM과 구분한 로컬 HTTP fixture, 폴더는 OPFS 핸들로 검증했다. [세부 결과와 미검증 항목](docs/12-mvp-implementation.md), [28개 수용 검사 상태](docs/mvp-acceptance-results.csv)를 참고한다.

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
