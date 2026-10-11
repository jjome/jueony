# Jueony 모듈 리팩터링 적용 결과

2026년 10월 11일 기준. 기존 `1386cd4`의 편집·저장·AI 동작을 유지하며 핵심 코드를 9개 모듈과 기술 어댑터로 분리했다. 현재 실행 경로가 새 facade를 사용한다. 기존 기능을 복제한 두 번째 엔진이나 저장소는 만들지 않았다.

이번 변경은 [전체 계획](30-layered-modular-refactor-plan.md)의 첫 이관 단계다. **핵심 업무 규칙의 경계는 검사로 강제하지만, 모든 UI·저장소·수명 API 이관이 완료된 상태는 아니다.** 전체 작업의 완료 여부는 [계획표](refactor-work-plan.csv)의 상태와 아래 잔여 목록으로 구분한다.

## 실행

검수본: [`build/jueony-refactor-20261011/Start-Review.cmd`](../build/jueony-refactor-20261011/Start-Review.cmd), 포트 **4192**.

기존 4173/4190/4191 실행 묶음과 사용자 프로필은 변경하지 않았다. 4192는 별도 웹 origin이므로 기존 업무 목록이 자동으로 보이지 않을 수 있다. 호환성은 합성 v1 업무·채팅·문서·폴더 연결을 새 테스트 프로필에 넣어 검사했다. 실제 사용자 DB를 초기화하거나 이주시키지 않았다.

실행 묶음에는 Studio·WASM·글꼴·Node 런타임과 분리된 서버 서비스·문서 명령 계약이 포함된다. 원본 저장소를 참조하는 개발용 schema 재수출 파일은 패키징 시 독립 실행 가능한 canonical 파일로 교체한다.

## 적용된 구조

```text
apps/editor/src/
  shell.ts                         화면 이벤트와 남은 전환·복원 조정
  ui/                              AI 연결 창, 새 문서 기본값 창, DOM 헬퍼
  composition/                     실제 저장소·모델·검색·Agent 조립
  modules/
    session/                       탭 소속·순서·선택·복원과 전환 제어
    workspace/                     업무·채팅·메시지와 소속 검증
    document/                      문서 DTO, 명령 규칙, facade, wire schema
    document-files/                저장 충돌·복구 정책과 쓰기 Port
    references/                    지정 자료 검색·구간·출처, 해시 Port
    preferences/                   환경 병합·검증·문서 보기 복원
    connections/                   모델·연결 관리·모델 호출 계약
    agent/                         문맥 구성·단일 실행·제한된 검토 실행
    automation/                    반복 작업 대상·변수·템플릿·명령 재생
  adapters/
    rhwp/                          Studio/WASM 접근·실제 명령 실행
    iframe/                        타입이 있는 화면 연결과 버전·메서드 검사
    files/                         브라우저 파일·다운로드·원본 연결·자료 읽기
    storage/                       IndexedDB v1·저장 큐·기존 저장 DTO/검증
    browser/                       브라우저 해시·환경 변경 이벤트
    http/                          로컬 AI 서버 통신
apps/launcher/
  server.mjs                       HTTP 진입점과 Host/Origin/token/CSP
  services/model-service.mjs        연결·키 재사용·호출 수 제한·저장 조정
  providers/                       기존 5개 제공자 adapter
  contracts/                       문서 wire schema 연결
apps/editor/scripts/integration/
  studio-patches.mjs               고정된 upstream 연결 패치
```

각 모듈의 `public`은 외부 진입점이다. `application`은 처리 순서와 주입받은 Port 호출, `domain`은 순수 규칙, `ports`는 필요한 외부 기능을 맡는다. 작은 모듈에는 사용하지 않는 레이어 파일을 추가하지 않았다. 기존 빌드가 제품 소스를 Studio 아래에 복사하므로 모듈의 실제 위치는 루트 `modules` 대신 `apps/editor/src/modules`다.

| 영역 | 실제 연결된 경계 | 보존한 동작 |
|---|---|---|
| 문서 | `createDocumentFacades`, `DocumentEditFacade`, `DocumentInteractionFacade` | 본문·서식·표·쪽 설정 14개 명령, preflight, revision 검사, 요청 undo, 부분 실패 구분 |
| 파일 | `createSnapshotWriter`, 저장·복구 Port | 외부 파일 변경 확인, 저장 중 편집 거부, close 완료 후 저장 확인, 암호 문서 평문 복구 방지 |
| 업무 | `createWorkspaceFacade` | 업무별 채팅·메시지 소속 검사, ID 생성 주입 |
| 상태 | `WorkspaceStore` 저장 adapter와 직렬 writer | DB 이름·버전·key 유지, native 파일 handle과 추가 필드 보존, 실패 후 큐 복구 |
| 환경 | Preferences facade와 storage/viewport Port | 부분 변경 병합, 새 문서 기본값, 배율·스크롤 복원 |
| 자료 | `createReferenceFacade`, `ContentHashPort` | 직접 지정한 자료의 기존 lexical 검색·문맥 한도·출처 좌표 |
| 연결 | `ConnectionFacade`, `ModelGatewayPort` | 제공자·모델 선택, 키 변경·삭제, DPAPI, 연결 시험 |
| Agent | `createAgentFacade` | single/bounded 실행, 취소, 오래된 결과 거부, 최종 계획 한 번 적용 |
| 반복 작업 | `createAutomationFacade` | 기존 7종 명령, 대상 유일성, 새 문서 생성 시 대상 전환, 같은 문서 명령·undo 사용 |
| 세션 | `createSessionFacade` | 탭 순서, 다른 업무 선택 거부, 닫기 실패 보존, 이전 활성 문서 복원 |

문서 명령의 JSON schema는 `modules/document/public/wire-schema.mjs` 한 곳에서 관리한다. 제공자별 구조화 출력 변환은 이를 소비한다. 런타임 의미 검증도 같은 모듈이 소유하며, 지원 명령 종류는 canonical schema에서 가져온다. 기존 UI 연결 메서드는 typed iframe adapter가 `bridgeVersion: 1`과 필요한 메서드를 확인한 뒤 사용한다.

## 경계 검사와 병렬 개발 규칙

`scripts/check-module-boundaries.mjs`는 AST를 읽어 아래 위반을 거부한다. 테스트 실행과 제품 빌드에도 연결했다.

- 다른 모듈의 `application/domain/ports` 직접 참조
- `import type`, 재수출, 동적 import를 포함한 모듈 순환
- 핵심 모듈의 브라우저/Node 전역·기술 adapter·기존 mvp 경로 의존
- 공개 계약의 `any`와 native 파일/DOM/IDB 타입 노출
- 존재하지 않는 모듈 파일, 오래된 예외 항목

현재 예외 허용 목록은 비어 있다. 기존 경로들은 공개 진입점 또는 외부 adapter를 재수출하는 호환 파일이며, **새 코드에서 구현 소유권으로 사용하지 않는다.** 검사 도구는 선언된 AST 의존성을 검사한다. 런타임에 임의로 문자열을 조합한 접근까지 차단하는 보안 경계는 아니다.

다음 기능 개발에서는 문서/파일, 업무/환경, Agent/연결/자료를 각 소유 영역으로 배정할 수 있다. `public` 계약, `shell.ts`, composition, build/lockfile, 물리 v1 저장 DTO 변경은 통합 담당자가 조정한다. 계약 변경 후에는 소비자 검사도 실행한다. 모듈 내부 변경이 모든 경우 다른 영역에 영향이 없다는 보장은 하지 않는다.

## 검증

증거: [`docs/evidence/refactor-2026-10-11`](evidence/refactor-2026-10-11).

| 검사 | 결과와 범위 |
|---|---|
| 원본 HEAD 분리 검사 | 편집기 170개, 서버 43개 통과 |
| 리팩터링 자동 검사 | 편집기 202개, 서버 47개 통과 |
| 구조 검사 | 9개 모듈, 경계 위반 0, 허용 예외 0 |
| 빌드 | 고정 rhwp 0.8.7, Vite build 및 생성 Studio 전체 TypeScript 검사 통과 |
| 브라우저 업무 흐름 | AI 명령 적용·요청 undo·반복 작업·대상 충돌 거부·자료 검색·후보 검토·취소·재시작 보존 9개 시나리오 |
| v1 데이터와 독립 실행 묶음 | 이전 업무/독립 채팅/폴더 handle/문서/매크로 복원, 업무 분리, 추가 필드 보존, 미완료 실행 중단 처리 |
| 인터넷 차단 저장 | 외부 요청 0, 실제 브라우저 파일 handle에 HWPX 쓰기·저장 내용 재읽기·undo |
| 실제 WASM | HWP/HWPX 왕복, 표·서식·쪽 설정 및 저장 충돌·복구 검사 포함 |

복구 목록 전체 검사 때문에 손상된 레코드 하나가 정상 문서 복원까지 중단하던 이관 중 회귀를 발견했다. `partitionRecoveryRecords`로 개별 오류를 격리하고 원본 레코드는 보존한다. 빈 ID의 손상 복구본과 정상 문서를 함께 넣는 회귀 검사도 추가했다.

저장 확인용 파일: [`saved-after-refactor.hwpx`](evidence/refactor-2026-10-11/compatibility/saved-after-refactor.hwpx). 이 파일의 내용 재읽기는 rhwp에서 확인했다. **이번 변경에 대해 실제 한글 2024 GUI 비교나 유료 LLM 재호출은 하지 않았다.** 브라우저 모델은 localhost의 결정적 시험 응답이다. 기존 기능 범위를 넓히거나 한글 전체 호환성을 새로 보증하는 변경이 아니다.

## 남은 이관

1. `shell.ts`에는 자료 트리 렌더링, 메시지·실행 기록, 문서 열기/닫기/복구의 일부 조정이 남아 있다. 현재 facade 호출을 유지하며 UI controller와 Session/RunRepository 경계로 더 옮긴다.
2. 저장 adapter는 기존 v1 aggregate를 하나의 writer로 다룬다. workspace/실행/매크로/폴더별 repository와 부분 갱신 계약은 아직 전부 도입하지 않았다. 여러 프로세스의 동시 쓰기 병합을 새로 지원하는 것은 아니다.
3. Document에는 query/edit/interaction 계약이 적용됐다. 전체 lifecycle·selection·save receipt를 목표 계약의 `documentId/epoch` 형태로 바꾸는 작업은 남아 있다. 현재는 기존 document generation/revision/탭 scope 검사를 보존한다.
4. iframe 연결은 typed adapter로 옮겼지만 같은 origin의 직접 연결이다. `contentWindow` 크기/포커스 이벤트, Studio bootstrap 패치, 일부 native adapter의 `any`는 남아 있다. 외부 MCP 및 독립 프로세스 transport는 별도 작업이다.
5. 자료 파일 읽기는 파일 adapter, 검색은 References 모듈로 분리했다. 자료 등록/추출의 전체 Metadata/Parser/Repository Port 통합은 다음 단계다.

이 항목들은 새 기능과 함께 무조건 한꺼번에 바꾸지 않는다. 해당 모듈을 확장할 때 공개 계약과 보존 검사를 먼저 추가하고 호환 파일을 제거한다. F6 동작 충돌, content-loss 보고만으로 완전 보존을 증명할 수 없는 점 등 기존 호환성 결함은 [한글 비교 목록](29-hangul-2024-comparison.md)에서 계속 관리한다.

## 개발 검사 명령

저장소 루트, Node.js 22 기준:

```powershell
node scripts/check-module-boundaries.mjs
node --test apps/editor/tests/*.test.ts
node --test apps/launcher/tests/*.test.mjs
$env:JUEONY_BUILD_PROFILE='refactor'
node apps/editor/scripts/build.mjs
node apps/editor/node_modules/typescript/bin/tsc --project apps/editor/.build/studio-refactor/tsconfig.json --pretty false
.\scripts\Build-Standalone.ps1 -OutputName jueony-refactor-20261011 -FrontendProfile refactor -ReviewPort 4192
```

브라우저 검사는 `apps/editor`에서 실행한다. 사용 중인 테스트 포트가 있으면 시작하지 않는다.

```powershell
$env:JUEONY_TEST_DIST='evidence/dist-refactor'
$env:JUEONY_TEST_OUTPUT='evidence/refactor-workbench'
node scripts/verify-agent-workbench.mjs
node scripts/verify-refactor-compatibility.mjs
```

이번 자동 실행은 Volta shim 대신 기존 실행 묶음의 `build/jueony-continuation-20261011/runtime/node.exe`를 사용했다. 브라우저 검사는 설치된 Edge와 새로운 테스트 프로필을 사용한다.
