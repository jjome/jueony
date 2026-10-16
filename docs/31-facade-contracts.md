# Jueony Facade 계약과 변경 규칙

[레이어·모듈 계획](30-layered-modular-refactor-plan.md)의 공개 경계를 구체화한다. 아래 이름과 TypeScript는 **목표 계약 예시**다. 첫 이관에서 적용한 실제 API와 차이는 [구현 결과](32-modular-refactor-result.md)를 따른다. 기존 14개 편집 명령·동작·데이터를 먼저 옮기고 새 기능은 별도 capability로 추가한다.

## 1 Facade와 Port의 역할

- **Facade:** 해당 모듈을 사용하는 사람이 알아야 하는 공개 기능. 예: `DocumentEditFacade.execute`.
- **Port:** 모듈이 외부에서 제공받아야 하는 최소 기능. 예: `EnginePort`, `ModelGatewayPort`.
- **Adapter:** Port를 실제 기술로 구현. 예: rhwp, Anthropic, IndexedDB. 외부 타입을 내부 DTO로 변환한다.
- **Composition Root:** 구현체를 선택하고 주입하는 유일한 장소. 업무 규칙을 넣지 않는다.

외부 모듈은 공개 계약만 import하고 구현체는 주입받는다. 예를 들어 Agent가 DocumentEditFacade 전체를 필요로 하지 않으면 조회/적용/되돌리기의 최소 Port를 정의하고, composition이 해당 facade를 연결한다. 이에 불필요한 메서드를 단순 전달하는 wrapper까지 추가할 필요는 없다. 서로 다른 도메인 DTO의 변환이 필요할 때만 별도 adapter를 둔다.

Facade는 코드 의존 경계이며 그 자체로 프로세스 보안 경계를 만들지는 않는다. HTTP/RPC의 인증·origin/source 검증·허용 기능 검사와 비밀 저장 격리는 각 실제 진입점에서 별도로 유지한다.

모든 모듈을 `getService(name)`으로 찾는 전역 service locator나 거대한 `AppFacade.execute(action: string, params: any)`는 사용하지 않는다. 문자열 action과 임의 객체를 받는 표면은 타입 이름만 Facade로 바꾸어도 경계가 생기지 않는다.

## 2 공개 계약 목록

메서드는 의미를 설명하는 설계명이다. R01에서 현재 동작과 정확한 필드를 대조해 버전을 고정한다.

| Facade | 대표 호출 | 입력 / 결과 | 공개하지 않는 것 |
|---|---|---|---|
| Session | `restore`, `switchWorkspace`, `selectChat`, `openTab`, `closeTab`, `getState`, `subscribe` | scope ID와 사용자 intent → 활성 ID·탭 projection·전환 결과 | HTMLElement/iframe, 전역 mutable AppState |
| Workspace | `createWorkspace`, `renameWorkspace`, `createChat`, `renameChat`, `readHistory`, `appendMessage` | workspace/chat ID와 명시 데이터 → 불변 요약/메시지 | IDBDatabase, Agent Run 구현 객체 |
| DocumentQuery | `readSnapshot`, `readSelection`, `getCapabilities`, `subscribe` | document binding → revision을 포함한 문서/선택 projection | native handle, live mutable document, 숨은 디스크 재읽기 |
| DocumentEdit | `validate`, `execute`, `undo` | snapshot 참조와 typed operations → 검증 결과/편집 결과 | 임의 Studio command 문자열, shell 실행, 저장 경로 |
| DocumentLifecycle | `load`, `create`, `export`, `confirmPersisted`, `dispose` | bytes 또는 document/export ref → 세션·export artifact·저장 확인 | 사용자 파일 handle, 채팅, API 키 |
| DocumentInteraction | `describeActions`, `invokeUiAction`, `focus`, `readView`, `restoreView` | 허용된 UI action 및 입력 문맥 → 상태/필요한 대화상자 의도 | LLM이 호출할 수 있는 무제한 UI 자동화 |
| DocumentFiles | `open`, `save`, `saveAs`, `reconnect`, `checkpoint`, `restoreDraft` | opaque file ref, 문서 ID, 명시 intent → 저장/복구 결과 | 현재 document 객체, 다른 업무의 복구본 |
| Reference | `attachFolder`, `detachFolder`, `listChildren`, `attachTemporary`, `resolveContext`, `search` | workspace/chat/source ref와 요청 범위 → SourceBundle/근거 | OS 경로를 임의 탐색하는 API, 타 업무 자료 |
| Preferences | `read`, `patch`, `reset`, `subscribe` | user/document/workspace scope와 허용 설정 delta → 새 값/버전 | 임의 localStorage key, 문서 본문 속성 변경 |
| Connection | `list`, `upsert`, `remove`, `probe`, `catalog` | 연결 설정 및 제한된 credential 입력 → 연결 ID·모델·hasCredential·검사 결과 | 키 조회 API, 제공자 SDK의 원본 응답 |
| Agent | `start`, `cancel`, `getRun`, `subscribe` | 고정된 scope·document·connection/model·자료 선택·요청 → run ID/상태/receipt | 활성 iframe, 임의 fetch, UI DOM |
| Automation | `capture`, `list`, `bind`, `play`, `cancel` | workspace·검증된 template/변수/현재 snapshot → 재생 결과 | 임의 JS 평가, 독자적인 문서 undo, LLM 응답을 곧바로 실행 |

`confirmPersisted`는 Files workflow에만 주입하는 제한된 수명 인터페이스다. 일반 UI/Agent/MCP에는 노출하지 않는다. `upsert`의 credential 입력은 설정 전용 채널에서 잠시 처리하고 즉시 신뢰된 로컬 서버/비밀 저장 adapter로 넘긴다. 공개 연결 상태, 오류, 이벤트, 채팅, 일반 로그, IndexedDB에는 키를 담지 않는다.

복구 기록 검증에는 `RecoveryIntegrityPort.verify(record)`를 주입한다. Core는 선택적 지문의 버전·알고리즘·형식과 검증 결과만 판단하고, 저장 adapter가 SHA-256 계산과 호출 시점 사본을 담당한다. 지문 있는 기록은 검증 port 없이 복원할 수 없다. 손상 기록은 개별 격리하며 삭제·재서명하지 않는다. 지문 없는 기존 v1 기록은 호환성을 유지한다. [106번 범위·실제 강제 종료 검사](106-recovery-integrity.md)를 따른다.

## 3 계약의 기본 형태

```ts
// 개념 예시. Brand/DTO의 전체 선언은 R01 산출물에 둔다.
type DocumentBinding = Readonly<{
  workspaceId: WorkspaceId;
  documentId: DocumentId;
  epoch: DocumentEpoch;      // 새로 열거나 교체하면 변경
}>;

type SnapshotRef = Readonly<{
  document: DocumentBinding;
  snapshotId: SnapshotId;
  revision: Revision;        // 같은 epoch 안의 내용 변경 버전
}>;

type EditRequest = Readonly<{
  contractVersion: 1;
  requestId: RequestId;
  base: SnapshotRef;
  operations: readonly DocumentOperation[];
}>;

interface DocumentEditFacade {
  validate(request: EditRequest): Promise<ValidationResult>;
  execute(request: EditRequest, options: LocalCallOptions): Promise<EditOutcome>;
  undo(request: UndoRequest, options: LocalCallOptions): Promise<EditOutcome>;
}

type EditOutcome =
  | { kind: 'applied'; receipt: EditReceipt }
  | { kind: 'no_change'; revision: Revision }
  | { kind: 'rejected'; error: AppError; actualRevision?: Revision }
  | { kind: 'rolled_back'; error: AppError; evidence: RollbackEvidence }
  | { kind: 'partial' | 'unknown'; error: AppError;
      confirmedOperationIds: readonly OperationId[]; recoveryRef?: RecoveryRef };
```

`LocalCallOptions`에 있는 `AbortSignal` 등의 실행 객체는 **같은 런타임 호출 옵션**이며 wire DTO가 아니다. RPC에서는 requestId에 결합된 별도 cancel 메시지로 변환한다. 식별자 brand도 wire에서는 문자열이므로 형식·소속·현재 문서 binding을 런타임에서 다시 검증한다.

`SnapshotRef`의 node ID는 해당 epoch/revision의 조회 결과 안에서만 유효하다. 현재 `s0p1` 같은 위치 ID를 문서를 다시 열어도 유지되는 영구 ID라고 취급하지 않는다. 순서 변경이 있는 한 묶음에서는 Document가 기존 대상과 삽입 resultId의 대응을 유지한다. 유사한 텍스트나 현재 커서로 임의 재지정하지 않는다. 매크로 대상 재해석은 Automation이 명시적으로 하고, 해석 결과도 현재 snapshot으로 다시 검증한다.

## 4 DocumentOperation의 단일 정의

명령 종류, 허용 필드, 단위와 범위의 소유자는 Document다.

```text
document/public 명령 schema와 feature descriptor
  ├─ TypeScript DocumentOperation / 런타임 shape validator
  ├─ Document 의미 검증과 실행 handler registry
  ├─ Agent용 모델 출력 schema/projection
  ├─ Automation용 기록/재생 허용 목록
  └─ 향후 MCP tool input schema
```

canonical schema/type을 두 벌로 직접 관리하지 않는다. R01에서 현재 빌드에 맞는 schema-first 또는 typed descriptor의 한 소스를 선택한다. engine API와 무관한 순수 계약 모듈로 작성하고 브라우저와 Node에서 같은 생성물을 읽는다. TypeScript 소스를 복사해 만든 별도 `.mjs` 명세는 유지하지 않는다.

provider의 구조화 출력 schema는 지원 subset으로 투영할 수 있지만, 투영 때문에 빠진 범위 검사는 실행 전 canonical validator에서 유지한다. 공급자별 제약을 UI나 Document 내부 규칙에 퍼뜨리지 않는다. 미지원 schema shape를 요청하면 명시적으로 연결 capability 오류를 반환한다.

| 항목 | 계약에 고정할 의미 |
|---|---|
| 텍스트 offset | 현행 본문 명령의 Unicode code point 기준. UTF-16/native 좌표 변환은 engine adapter 한 곳에서 수행 |
| 크기·길이 | API는 mm/pt/percent를 필드명으로 명시. HWPUNIT 변환은 adapter 내부 |
| 대상 | document binding·snapshot·node/cell/section ref. 파일 경로나 화면 좌표로 편집하지 않음 |
| 생략된 속성 | 기존 값 유지. null/삭제/초기화는 별도 명시된 동작만 허용 |
| 생성된 대상 | 동일 batch 내 resultId만 지원 범위대로 사용. 이후 조회 전 영구 ID로 가정하지 않음 |
| 지원 범위 | command descriptor에 사람/AI/매크로 사용 가능 여부, 대상 종류, 지원 옵션·제한을 기재 |
| 순서 | batch 순서와 구조 변경 후 주소 의미를 정의. 검증과 적용이 같은 규칙 사용 |

현재 14종을 우선 계약 v1으로 옮긴다. 혼합 서식/중첩 표 등 지원 범위를 리팩터링 중 넓히지 않는다. UI 메뉴의 모든 command 문자열을 자동으로 AI tool로 변환하지 않는다.

## 5 변경과 저장의 원자성 경계

### 문서 편집

```text
입력 shape 검증
→ scope와 문서 binding 확인
→ 지원 명령·대상·원문/서식·revision 의미 검증
→ 필요 시 현행 사전 검사
→ 문서 변경 경계 진입
→ 취소/busy/IME/revision 최종 확인
→ 기존 엔진의 요청 단위 history로 적용
→ 상태·receipt 확정
→ 관찰 이벤트 전송
```

사전 검사와 최종 적용 사이에 사용자가 편집하면 conflict로 거부한다. 경계 진입 대기 중 취소는 무변경이어야 한다. 적용이 이미 시작됐으면 완료 또는 검증된 복원 결과를 기다린다. 단순히 await만 중단하고 ‘취소 성공’이라고 반환하지 않는다.

현행 엔진/명령이 rollback을 보장하지 못하면 `partial` 또는 `unknown`으로 남긴다. 코드상 snapshot 기능이 있다는 이유로 모든 자산·개체 복원이 검증되었다고 주장하지 않는다. 손상 가능 상태에서는 후속 자동 변경을 막고 복구 정보를 제공한다. 앞서 발견한 전체 개체 보존 검사 공백은 별도 결함 과제다.

requestId는 현재 epoch 내 중복 적용을 방지하고 undo 뒤에도 재사용하지 않는다. 같은 ID에 다른 명령을 넣으면 거부한다. 재시작 후 durable journal/exactly-once는 현재 구현에 없으므로 v1 지원으로 선언하지 않는다. 전송 timeout 결과가 불명확하면 자동 재전송하지 않고 조회/복구로 확인한다. 향후 journal을 붙일 때 별도 capability와 migration으로 추가한다.

### 파일 저장

```text
Document.export(binding, revision, format)
→ ExportArtifact(immutable bytes, exportId, revision, 보존 보고)
→ Files가 원본 fingerprint/권한을 확인하고 FileAccessPort.write
→ FileWriteReceipt(실제 close/commit 또는 다운로드 확인 상태)
→ Document.confirmPersisted(exportId, revision, receipt)
```

저장 중 편집으로 현재 revision이 달라졌다면 이전 revision의 디스크 저장이 성공해도 현재 dirty를 지우지 않는다. 다른 이름 저장·취소·원본 외부 수정·디스크 쓰기 이후 통지 실패도 결과로 구분한다. export bytes는 WASM 메모리의 borrowed view가 아니라 수명이 고정된 복사본/소유 버퍼여야 한다.

FileAccessPort는 backend의 실제 보장을 반환한다. 브라우저 writable close, Windows atomic replace 지원 여부, 다운로드 생성/사용자 저장 확인은 같지 않다. 지원하지 않는 원자적 저장을 추상화 이름만으로 보장하지 않는다. 파일 쓰기+엔진 상태+IndexedDB 전체를 하나의 transaction으로 간주하지 않는다. 도중 실패는 확인 가능한 단계와 복구 경로를 반환한다.

복구 checkpoint는 원본 저장 완료가 아니며 dirty를 해제하지 않는다. 암호 문서의 평문 복구 금지, 손실 보고 시 기존 복구본 유지, 실제 사용자 저장 확인을 유지한다. `contentLoss.count=0`만으로 전체 무손실이라는 새 보장을 만들지 않는다.

읽을 수 있는 파일 연결은 close 뒤 실제 commit 바이트를 다시 읽어 사본 지문과 일치한 다음 저장 성공을 알린다. close 이후 실패는 이미 디스크가 바뀌었을 수 있으므로 열린 문서는 dirty로 유지하고 원본 불변을 단정하지 않는다. 성공한 SaveAs의 출력 형식은 파일 연결 adapter가 관리하며 문서 엔진의 원본 형식을 바꾸지 않는다. 명시적으로 새 문서를 연 뒤에는 이전 연결의 출력 형식을 재사용하지 않는다. [저장·복구 보강 계약과 검증 범위](105-file-storage-preservation.md)를 따른다.

## 6 자료와 Agent 계약

`ReferenceFacade.resolveContext`는 읽을 자료를 명시적으로 선택한 `workspaceId/chatId/sourceRefs`와 예산을 받는다. 결과는 실제 전달한 내용·출처·hash·추출 제한·잘림/누락 정보를 포함한 SourceBundle이다. 폴더 등록은 자동 분석 완료가 아니다. 자료 선택과 검색 범위를 provider adapter가 결정하지 않는다.

열린 미저장 파일의 참고 내용은 DocumentQueryPort를 통해 읽는다. 따로 디스크 파일을 읽은 오래된 내용과 섞지 않는다. index/parser 캐시는 source fingerprint·scope와 결합한다. 향후 쪽/셀 위치를 추가해도 현재 텍스트만 있는 출처를 정확한 쪽 근거인 것처럼 표시하지 않는다.

```ts
interface ModelGatewayPort {
  generate(
    request: Readonly<{
      connectionId: ConnectionId;
      modelId: string;
      messages: readonly ModelMessage[];
      responseSchema: JsonSchema;
      limits: GenerationLimits;
    }>,
    options: LocalCallOptions
  ): Promise<Result<ModelResult, ModelError>>;
}
```

Agent가 context·편집 지시·출력 schema를 만든다. 로컬 gateway는 connectionId의 실제 허용 모델·endpoint·자격증명을 서버에서 확인하고 adapter를 선택한다. provider는 요청·응답·usage·오류를 중립 타입으로 변환한다. provider raw 응답이나 SDK error를 UI에 반환하지 않는다. gateway의 결과는 문서 적용 성공이 아니라 모델 생성 결과다.

모델 API client와 연결 설정 client가 같은 HTTP 연결을 써도 `ModelGatewayPort`와 `ConnectionFacade`를 합치지 않는다. API-key를 교체하는 권한이 문서 Agent에 필요하지 않다. 브라우저 로그인/OAuth 추가는 이후 Connections의 auth adapter 범위이며, 제공자의 허용 인증 경로 검토가 선행된다.

Agent는 SourceBundle/DocumentSnapshot/대화로 context를 구성하고, 생성된 계획을 검증한 뒤 DocumentEditFacade로 실행한다. 현재 bounded 후보 검토를 유지하며, 새로운 observe/act loop는 이후 ExecutionPolicy 구현으로 추가한다. References나 provider 안에 loop를 숨기지 않는다.

## 7 오류와 이벤트

공통 오류에는 안전한 `code`, 사용자용 `message`, `retryable`, 선택적 `requestId`만 둔다. 엔진/제공자 상세는 해당 adapter의 진단 코드로 분리한다. 문서 내용·경로·키·요청 body를 일반 로그에 무조건 저장하지 않는다.

| code 예 | 의미 / 호출자의 처리 |
|---|---|
| UNSUPPORTED_CAPABILITY | 해당 기능·옵션 미지원. 임의 대체 명령 실행 금지 |
| INVALID_ARGUMENT / INVALID_TARGET | 구조·값·대상 오류. 자동 위치 추정 금지 |
| SCOPE_MISMATCH / STALE_DOCUMENT | 다른 업무/세대의 요청. 현재 문서에 재사용 금지 |
| REVISION_CONFLICT | 사용자 변경 이후 오래된 결과. 새 snapshot부터 다시 작업 |
| BUSY / IME_COMPOSING | 현재 진입 불가. 키 입력/조합을 파괴하지 않음 |
| CANCELLED | 작업이 시작되지 않았거나 확인된 중단 결과. 적용 후에는 outcome과 함께 설명 |
| AUTH / RATE_LIMIT / PROVIDER_ERROR | 연결/모델 호출 문제. 문서 적용 실패와 구분 |
| STORAGE_CONFLICT / STORAGE_FAILURE | 원본 외부 변경/로컬 저장 실패. 원본 덮어쓰기 재시도 금지 |
| PARTIAL_APPLY / UNKNOWN_OUTCOME | 효과가 남았거나 확인 불가. 완료로 표시하거나 자동 재적용하지 않음 |

이벤트는 `module`, `eventVersion`, `scope`, `sequence`, `requestId?`, 최소 payload를 가진다. `DocumentChanged`, `RunProgress`, `ConnectionChanged`, `PreferencesChanged` 등을 모듈별로 정의한다. 전역 wildcard bus를 다른 모듈 내부 명령의 통로로 쓰지 않는다. 초기 상태 조회+증분 구독, 중복/역순/끊김 후 재조회, dispose 시 해제를 계약 검사에 포함한다. 파일 쓰기 완료는 반환 receipt로 확인한다.

## 8 공개 API와 wire 저장 버전

다음 버전은 서로 다른 목적이다.

- `contractVersion`: facade/wire DTO 의미와 파싱 규칙.
- `capabilityRevision`: 지원 명령·옵션·문맥의 현재 목록.
- `storageVersion`: persisted DTO와 migration.
- `engineBuild`: 실행 중인 WASM/Studio 조합.
- `productBuild`: 사용자가 실행하는 번들.

메서드 이름, 단위, offset 기준, 이벤트 의미, 오류 enum이 바뀌면 계약 변경으로 다룬다. optional 필드 추가도 strict parser의 이전 소비자가 거부할 수 있으므로 자동 하위 호환이라고 가정하지 않는다. 버전 협상/구버전 projection 또는 함께 배포하는 소비자 전환이 필요하다. 오래된 host와 새 editor/server 조합을 조용히 실행하지 않는다.

각 계약 변경은 다음을 포함한다: 소유자, 영향 소비자, 이전·신규 입출력 fixture, 호환/실패 동작, 배포 순서, 저장 migration 여부, 제거할 shim의 조건. 같은 major 안에서 내부 구현만 바꾸면 이 계약 자료를 통과하는 한 소비자 코드는 수정하지 않는다.

## 9 경계 시험과 작업 예시

| 검사 | 필요한 증거 |
|---|---|
| public 표면 | module 내부 deep import, private reexport, type-only 순환 탐지 |
| DTO | 잘못된 필드/타입/단위/다른 workspace/old epoch/과거 revision 거부 |
| adapter 적합성 | fake와 실제 adapter가 동일 fixture의 성공·실패 의미 준수 |
| 명령 registry | 14종 schema/validator/handler/provider projection의 종류·필드·한도 일치 |
| mutation | 사용자 변경 경합·중복 ID·취소·undo 이후 재사용·부분 실패 |
| 파일 | 동일 revision 저장 성공·다른 revision dirty 유지·외부 파일 변경·취소·download 확인 |
| 상태 | 기존 v1 업무/메시지/탭/설정/연결을 초기화 없이 읽고 다른 영역을 보존하며 기록 |
| scope | 다른 workspace의 자료/채팅/복구본 차단, 열린 미저장 내용 우선 |
| transport | origin/source/session/request 연결·버전 불일치·timeout·disconnect 처리 |
| provider | 문서/Agent 코드 변경 없이 adapter 교체, 중립 오류·schema 적합성 유지 |

예를 들어 ‘표 셀 병합’을 추가할 때 Document 담당자가 명령과 capability, handler, undo/저장 검사를 구현한다. Agent 담당자는 이미 정해진 명령 schema를 계획 생성에 노출하고, Automation 담당자는 기록/재생 가능 여부를 별도로 결정한다. UI 담당자는 자신의 메뉴를 typed command에 연결한다. 공용 schema 변경은 먼저 통합하며 각 담당이 엔진 내부나 다른 모듈의 private 파일을 동시에 수정하지 않는다.

한글과의 동일한 동작은 계약 적합성만으로 증명되지 않는다. facade contract 검증, 엔진 왕복, 실제 한글 GUI/출력 비교는 각각 별도의 완료 조건이다.
