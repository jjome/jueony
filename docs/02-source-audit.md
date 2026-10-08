# 저장소 재검증과 재사용 판단

2026년 10월 9일 한국 시간에 원격 Git 참조와 로컬 소스를 직접 대조했다. 이전 조사의 큰 방향은 유지되지만, **페이지 수 변경 거부, 최근 명령만 되돌리기, 저장 완료 통지의 버전 검사 부재, 외부 웹폰트 경로**를 초기 설계의 명시적 제약으로 추가한다.

## 분석 기준과 작업 지침

| 항목 | gongmuwon | rhwp |
| --- | --- | --- |
| 저장소 | `Kminer2053/gongmuwon` | `edwardkim/rhwp` |
| 원격 기본 브랜치 | `main` | `main` |
| 확인한 커밋 | `ef84271059eb178a08e4a358d761dab10ada7a78` | `1a76570e833917d15817415a53c09ad61ab3203f` |
| 커밋 시각 | 2026-08-03 14:59:01 +09:00 | 2026-10-06 16:15:59 +09:00 |
| 일치하는 태그 | `v0.1.14` | `v0.8.7` |
| 버전 선언 | desktop·sidecar·Tauri 0.1.14 | Cargo·Studio·editor wrapper 0.8.7 |
| 로컬 사본 | `upstream/gongmuwon` 기존 사본 | `upstream/rhwp-source` 전체 작업 파일 확보 |

`git ls-remote --symref <url> HEAD`로 원격 기본 브랜치를 확인했다. rhwp `devel`의 확인 SHA는 `5168e3256ad58eda425d84fdd4d67e9b47bb74b1`이다. 이를 fetch하고 main과 `LICENSE`, `npm/editor`, `rhwp-studio/src/document-agent`, `embed`, `plugin`, `main.ts`를 비교한 결과 변경 파일이 없었다. 분석 결론은 표에 고정한 main 기준이며, devel 전체·npm registry의 최신 배포 상태까지 확인했다는 의미는 아니다.

gongmuwon의 `AGENTS.md`, rhwp의 `AGENTS.md`, `CLAUDE.md`, Codex `MEMORY.md`, 문서 지도, 문서·Git 절차, 기여·개발 환경 안내의 관련 항목을 읽었다. 조사와 구현을 구분하고 검증 근거를 남긴다. rhwp 업스트림 기여는 devel과 그 검증 절차를 따라야 하지만, 이번 작업은 별도 제품의 설계이며 업스트림 수정·이슈·PR·배포를 수행하지 않는다. gongmuwon 지침에 언급된 gstack·Superpowers는 현재 제공된 도구 목록에 없으므로 사용했다고 기록하지 않는다.

rhwp는 `--depth 1 --filter=blob:none --sparse`로 분석 소스를 먼저 확보한 뒤, 사용자의 참조 저장소 확보 요청에 따라 `sparse-checkout disable`로 전체 작업 파일을 내려받았다. 41,624개 tracked 파일, 누락 HEAD 객체 0, sparse 제외 경로 0을 확인했다. 두 분석 사본의 작업 트리는 깨끗하다. 과거 Git 전체 이력과 실행·빌드 의존성은 별도다. 기존 `upstream/rhwp`의 별도 소스 중심 사본은 보존했으며 이번 실패한 임시 복제 `rhwp-current`만 정리했다.

## gongmuwon 확인 결과

아래 경로의 기준 접두어는 `services/sidecar/src/gongmu_sidecar/`다. 줄 번호는 고정 커밋 기준이다.

| 이전 조사 항목 | 현재 판정 | 코드 근거와 제품 영향 |
| --- | --- | --- |
| Tauri 2·React 19·FastAPI·SQLite | 확인 | desktop package, Cargo, sidecar pyproject, `db.py`. 기존 로컬 실행 구조를 활용할 수 있다. |
| 폴더 등록·스캔·변경·이동·삭제 | 확인 | `knowledge.py`의 `register_source` 70행, `scan_source` 124행, `_apply_move` 514행. 업무 범위 검사는 추가해야 한다. |
| 추출·색인·동기화·검색 | 확인 | `knowledge_wiki.py`의 `ingest_source` 613행, `search` 2900행; `db.py` 692행 FTS5 trigram. 전역 검색을 업무별 검색으로 분리해야 한다. |
| workspace가 업무별 공간 | 해당하지 않음 | `workspace.py`는 설정·DB·캐시·출력 폴더를 가진 앱 데이터 루트다. `db.py`의 세션·자료 테이블에 업무 격리용 `workspace_id`가 없다. |
| HWP 임시 첨부 즉시 분석 | 미구현 | `app.py` 1144~1184행 업무 세션 첨부는 파일을 저장하고 텍스트 계열만 decode한다. HWP·HWPX 파서 호출이 없다. |
| 텍스트 첨부 4,000자 | 확인 | `app.py` 1169행에서 앞 4,000자를 발췌한다. 1221~1234행은 발췌 길이를 표시하며 질의 기반 전체 검색은 별도 과제라고 명시한다. |
| kordoc 연결 | 확인 | `kordoc_bridge.py` 41행 `parse_with_kordoc`: Node runner 호출·timeout·JSON 검증. 임시 첨부 경로에 이 계층을 연결할 수 있다. |
| custom fill·patch | 확인 | `document_authoring.py` 2004행 `custom-fill-apply`, 2061행 `custom-patch`. 기존 양식 수정 기능이 전혀 없는 것은 아니다. |
| patch의 위치 정확성 | 제한 확인 | 같은 파일 1324~1376행에서 생성 내용을 교체 가능한 블록 순서대로 얹는다. 열린 문서의 선택 위치와 버전에 묶인 변경 명령으로 재사용하지 않는다. |
| API 키 보관 | 보완 필요 | `secrets_vault.py` 94행 부근: vault 사용·저장 실패 시 평문 값을 남긴다. 기관용 제품은 실패 시 저장을 거부하거나 메모리 세션만 허용한다. |
| 로컬 API 인증 | 보완 필요 | `app.py`의 생성·라우트 등록에 인증 의존성·Bearer 검증을 찾지 못했다. 3699행의 CORS는 접근 토큰 인증을 대신하지 않는다. |
| loopback 실행 | 기본값 확인 | `server.py`는 기본 `127.0.0.1:8765`이며 환경변수로 바뀔 수 있다. 제품 빌드에서는 loopback 바인딩을 정책으로 고정한다. |
| rhwp 미리보기 버전 | 0.7.17 확인 | desktop 선언 `^0.7.17`, 루트 lockfile의 실제 해석 버전 0.7.17. 새로운 0.8.7 Studio와 동일 엔진으로 취급하면 안 된다. |
| 오프라인 패키징 | 재사용 후보 | Tauri의 `offlineInstaller`, sidecar resource, release scripts가 있다. 기관용 최소 번들의 배포 성공은 아직 검증하지 않았다. |

## rhwp 확인 결과

| 항목 | 확인한 계약 | 제품 영향 |
| --- | --- | --- |
| 편집기 구성 | Rust 문서 엔진 + WASM + Studio + iframe wrapper | `@rhwp/editor`만 설치해서 Studio·WASM·폰트까지 로컬 제공된다고 가정하지 않는다. |
| 공개 API | `loadFile`, `getDocumentState`, `getSelectionContext`, `applyTextCommand`, `revertTextCommand`, `focusTarget`, `exportHwp`, `exportHwpx`, `notifySaved` | 기존 조사와 일치. wrapper·Studio·WASM을 같은 기준으로 묶는다. |
| 문서 버전 | `documentEpoch`, `changeSeq`, `documentSha256` | 문서 교체와 후속 편집을 구분하여 오래된 제안을 거부한다. |
| 원문 검증 | 원문·서식·인접 문맥 SHA-256 | host가 임의로 요약한 내용이나 Markdown 파싱 결과로 이 값을 대체하지 않는다. |
| 대상 | 본문 문단 전체, `charOffset: 0`, 길이 최대 4,000 | 문단 내 부분 교체 API가 아니다. replacement 길이는 `Array.from`의 code point 수 기준이다. |
| 편집 불가 대상 | 표 내부 위치, 혼합 글자 서식, 컨트롤·필드 포함 문단 | 일반 편집기 기능 전체의 제한과 구분한다. 공무 문서의 결재란·본문 표는 별도 난제다. |
| 교체문 | 최대 4,000, C0 제어문자·DEL 거부 | 줄바꿈·탭이 들어간 AI 응답은 그대로 적용할 수 없다. 조용히 잘라내지 않고 재제안한다. |
| 적용 후 검사 | 원문 후상태·서식·인접 문맥·비대상 의미 manifest·페이지 수 | 페이지 수가 바뀌면 `PAGE_COUNT_CHANGED`로 실패한다. 비대상 manifest가 모든 개체의 완전 보존을 입증하는 것은 아니다. |
| 실행 예산 | `COMMAND_BUDGET_MS = 3000` | 네트워크 LLM 시간이 아닌 편집 명령 경로의 상한이다. 큰 문서는 해시·직렬화 비용도 측정한다. |
| 되돌리기 | 가장 최근 명령이고 적용 직후 changeSeq인 경우 | 사용자 추가 편집 후 과거 AI 변경만 취소하는 기능은 별도 설계가 필요하다. 문서 재로드 시 journal은 초기화된다. |
| 선택 문맥 | target·편집 가능 여부·선택 텍스트 해시 | 원문·서식 해시·인접 문맥 해시는 반환하지 않는다. 여러 문단 선택을 안전한 단일 선택으로 오인하지 않도록 adapter가 검사해야 한다. |
| 내부 문맥 수집 | `collectTargetEvidence`가 원문과 필수 해시를 수집 | 같은 helper를 쓰는 읽기 전용 확장면이 가장 작은 변경 후보다. 현재 공개 wrapper API는 아니다. |
| 저장 완료 | `notifySaved(fileName?)` → clean 처리·복구 draft 삭제 | 저장 성공 뒤 호출해야 한다. epoch·seq 인자가 없어 저장 도중 편집에 대한 별도 잠금·검증이 필요하다. |
| 통신 | HTTP(S) Studio URL과 HTTP(S) parent origin | opaque origin·`file:`은 지원하지 않는다. Windows Tauri 실제 origin·CSP·iframe 조합을 먼저 검증한다. |
| 기본 연결 | `https://edwardkim.github.io/rhwp/` | 반드시 로컬 Studio 주소로 바꾼다. |
| 웹폰트 | 로컬 자산과 외부 CDN source가 함께 존재 | `RHWP_DISABLE_EXTERNAL_WEBFONTS=1` 빌드 설정을 사용하고 실제 요청을 검수한다. |
| plugin | `PluginHost.read`, 세대가 있는 DocumentLease, plugin allowlist·invoke | 문맥 adapter 후보지만 host 표면만으로 controller의 문서 해시·seq·선택을 모두 얻을 수 있다고 단정하지 않는다. 작은 Studio 확장이 필요할 수 있다. |

`documentChanged` 공개 이벤트의 reason은 `agent_apply`와 `agent_revert`다. 일반 키보드 편집까지 이 이벤트 하나로 모두 감지한다고 가정하지 않는다. 적용 전 상태 재조회는 필수이며, 제품 확장에서는 모든 mutation의 revision 통지도 다룬다.

## 재사용과 신규 개발 경계

| 모듈 | 처리 | 필요한 변경 또는 경계 |
| --- | --- | --- |
| gongmuwon `knowledge.py` | 선택적 재사용 | 폴더 수집·이동 감지; 업무 범위·폴더 밖 경로·중복 정책 추가 |
| `knowledge_wiki.py`, `db.py` | 구조·함수 재사용 | 업무·요청 scope, 자료 revision, 인용 위치, migration을 새 모델에 맞게 변경 |
| `kordoc_bridge.py` | 파서 adapter 재사용 | 임시 파일 큐·추출 한도·오류 상태·질의 기반 색인 추가 |
| `llm.py` | 전송·스트리밍·오류 처리 참고 | 기관 endpoint allowlist와 HyperCLOVA 호환 계약 검사; 현재 provider 목록 전체를 노출하지 않음 |
| `document_authoring.py`, `hwpx_writer.py` | 후속 신규 문서 생성에 활용 | 열린 문서의 AI 편집·저장 권한은 주지 않음 |
| Tauri·sidecar·패키징 | 최소 실행 골격 참고 | 제품 식별자, 인증, CSP, 저장, 자산·런타임 고지 재설계 |
| rhwp Studio·WASM·editor wrapper | 핵심 편집 계층으로 활용 | 고정 버전 로컬 번들, 문맥 읽기 확장, host 저장 연결 |
| HwpCtrl 호환 계층 | 당장 필요하지 않음 | 첫 수정 검증은 Document Agent 경로만 사용; 별도 문서 인스턴스 생성 금지 |
| 업무 workspace·자료 범위 | 신규 개발 | 공통·업무·요청 데이터 격리와 참조 관계 |
| 임시 첨부 분석 | 신규 연결 계층 | 첨부 → 추출 → 임시 색인 → 관련 근거 → 만료 |
| 편집 문맥·수정 제안 | 신규 개발 | 원자적 context snapshot, diff, 승인, receipt, 충돌 UI |
| 파일 저장 서비스 | 신규 개발 | 파일 identity·외부 변경 감지·임시 저장·교체·완료 통지 |
| 기관 정책·보관 | 신규 개발 | outbound 통제, 비밀 저장 실패 처리, 로그·캐시·복구본 관리 |

gongmuwon 전체 화면과 부가 기능을 합치는 방식은 첫 단계에 사용하지 않는다. 일정·에이전트 작업·로컬 모델 배포까지 가져오면 편집 호환성 검증 전에 제품 범위가 불필요하게 커진다.

## 하이퍼클로바 연결 재확인

공공용 CLOVA Studio 공식 문서는 OpenAI 호환 `/chat/completions`와 `https://clovastudio.stream.gov-ntruss.com/v1/openai/`를 안내한다. `response_format`, `stream_options` 등 미지원 필드도 있으므로 이름만 같다고 모든 옵션을 그대로 보내면 안 된다. 기관의 실제 gateway·권한·모델·응답은 아직 미확인이다. 이 공개 주소를 제품 기본 허용 주소로 자동 등록하지 않는다. [공공용 OpenAI 호환 API](https://api-gov.ncloud-docs.com/docs/clovastudio-openaicompatibility), [공공용 인증과 요청 규격](https://api-gov.ncloud-docs.com/docs/clovastudio-overview)

gongmuwon은 Bearer와 Chat Completions를 지원하지만, **`custom_openai`의 비스트리밍 경로는 `/responses`를 먼저 시도**한다. `llm.py` 593~624행과 952~967행에서 이를 확인했다. HTTP 400/404 등의 조건에서만 Chat Completions로 폴백하므로 CLOVA adapter는 확인된 Chat Completions 경로를 명시적으로 선택해야 한다. 스트리밍과 비스트리밍을 각각 계약 시험하고 기존 provider를 설정만 바꾸어 완성된 연동으로 취급하지 않는다.

## 이번 실행 검증

Node 22.22.2의 실제 실행 파일로 `npm/editor/tests/*.test.mjs`를 기존 소스 그대로 실행했다. **32개 통과, 실패·건너뜀 0개**다. wrapper의 RPC·capability·응답 검사·transport·저장 통지 계약 테스트이며 실제 WASM·Tauri·문서 저장 결과 시험은 아니다. [로그](evidence/rhwp-editor-tests-2026-10-09.txt)

기본 Node shim은 sandbox에서 Volta 경로를 찾지 못했지만 설치된 Node 실행 파일로 검사를 완료했다. 현재 Python은 3.14.3이며 pytest·FastAPI 등 백엔드 실행에 필요한 의존성이 없었다. 이전의 백엔드 31 통과·6 건너뜀 결과는 이번 환경의 결과로 재사용하지 않는다. 실제 한글과 기관 API도 아직 시험하지 않았다.

## 주요 소스 근거

다음 링크는 분석 커밋에 고정되어 있다. 로컬 사본과 파일 해시는 [분석 기준 JSON](evidence/source-audit-2026-10-09.json)에 기록했다.

- [G1 앱 workspace](https://github.com/Kminer2053/gongmuwon/blob/ef84271059eb178a08e4a358d761dab10ada7a78/services/sidecar/src/gongmu_sidecar/workspace.py), [G2 DB](https://github.com/Kminer2053/gongmuwon/blob/ef84271059eb178a08e4a358d761dab10ada7a78/services/sidecar/src/gongmu_sidecar/db.py)
- [G3 첨부와 로컬 API](https://github.com/Kminer2053/gongmuwon/blob/ef84271059eb178a08e4a358d761dab10ada7a78/services/sidecar/src/gongmu_sidecar/app.py#L1144), [G4 문서 작성과 patch](https://github.com/Kminer2053/gongmuwon/blob/ef84271059eb178a08e4a358d761dab10ada7a78/services/sidecar/src/gongmu_sidecar/document_authoring.py#L1324)
- [G5 비밀 저장](https://github.com/Kminer2053/gongmuwon/blob/ef84271059eb178a08e4a358d761dab10ada7a78/services/sidecar/src/gongmu_sidecar/secrets_vault.py), [G6 Tauri CSP와 번들](https://github.com/Kminer2053/gongmuwon/blob/ef84271059eb178a08e4a358d761dab10ada7a78/apps/desktop/src-tauri/tauri.conf.json)
- [G7 패키지 lockfile](https://github.com/Kminer2053/gongmuwon/blob/ef84271059eb178a08e4a358d761dab10ada7a78/package-lock.json#L1759), [G8 LLM](https://github.com/Kminer2053/gongmuwon/blob/ef84271059eb178a08e4a358d761dab10ada7a78/services/sidecar/src/gongmu_sidecar/llm.py#L549)
- [R1 wrapper API](https://github.com/edwardkim/rhwp/blob/1a76570e833917d15817415a53c09ad61ab3203f/npm/editor/index.d.ts#L213), [R2 wrapper 구현](https://github.com/edwardkim/rhwp/blob/1a76570e833917d15817415a53c09ad61ab3203f/npm/editor/index.js#L25), [R3 transport](https://github.com/edwardkim/rhwp/blob/1a76570e833917d15817415a53c09ad61ab3203f/npm/editor/transport.js#L71)
- [R4 Document Agent controller](https://github.com/edwardkim/rhwp/blob/1a76570e833917d15817415a53c09ad61ab3203f/rhwp-studio/src/document-agent/controller.ts), [R5 명령 검증](https://github.com/edwardkim/rhwp/blob/1a76570e833917d15817415a53c09ad61ab3203f/npm/editor/document-agent-contract.js)
- [R6 저장 완료 처리](https://github.com/edwardkim/rhwp/blob/1a76570e833917d15817415a53c09ad61ab3203f/rhwp-studio/src/main.ts#L139), [R7 embed origin](https://github.com/edwardkim/rhwp/blob/1a76570e833917d15817415a53c09ad61ab3203f/rhwp-studio/src/embed/protocol.ts#L108)
- [R8 plugin host 계약](https://github.com/edwardkim/rhwp/blob/1a76570e833917d15817415a53c09ad61ab3203f/rhwp-studio/src/plugin/types.ts), [R9 외부 웹폰트 빌드 설정](https://github.com/edwardkim/rhwp/blob/1a76570e833917d15817415a53c09ad61ab3203f/rhwp-studio/vite.config.ts)
