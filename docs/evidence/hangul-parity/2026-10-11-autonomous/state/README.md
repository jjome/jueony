# 상태 저장 정적 감사와 우선 수정

기준: 2026-10-11, Jueony base e53e3e4. 이 폴더는 B 상태 담당의 산출물이다. S01~S22를 32개 필드 행으로 나누고 T01~T16을 전이 검사 목록으로 만들었다. 제품 코드 실행/실제 한글 동작 비교가 완료됐다는 의미가 아니다. 통합 담당 확인으로 한글 2024 편집기는 없고 Viewer 13.0.0.387만 있어 참조 비교는 **BLOCKED_REFERENCE**다.

## 근거 구분

- `editor-state-contract.csv`: 현재 코드의 소유자/저장소/trigger와 미확인 계약.
- `state-transition-cases.csv`: 후속 자동·수동 검사 항목. 현재 실행 전 상태.
- REF-OPTIONS: [한글 2024 환경 설정](https://help.hancom.com/hoffice130/ko-KR/Hwp/file/options/options.htm), 2026-10-11 확인. 앱 편집 환경 기본값이 모든 문서에 적용되는 범위가 있음.
- REF-NEWPAPER: [환경 설정 새 문서](https://help.hancom.com/hoffice130/ko-KR/Hwp/file/options/options%28newpaper%29.htm), 같은 날 확인. 새 문서 기본 용지는 재실행 후 지속되며 현재 문서 용지를 바꾸지 않음.
- REF-NEWTAB: [새 탭](https://help.hancom.com/hoffice130/ko-KR/Hwp/file/new_tab.htm), 같은 날 확인. 각 탭은 별도 문서로 저장되고 새 문서 기본값은 바탕문서에 연결됨.
- 위 도움말 확인과 실제 레퍼런스 실행은 다른 증거다. 숫자 배율·커서·선택·undo의 종료 후 수명을 아직 단정하지 않는다.

## 우선 결함과 작업 경계

| ID | 우선순위 | 코드에서 확인한 상태와 영향 | 다음 수정/검사 |
|---|---|---|---|
| S-001 | P1 | 각 iframe의 UserSettingsService가 시작 시 rhwp-settings를 캐시하고 save()에서 전체 JSON을 기록한다. 저장 직전 최신값 병합과 storage listener가 없다. A에서 보기 설정을 변경한 뒤 이전 상태의 B가 글꼴 등 다른 설정을 저장하면 A 변경을 지울 수 있다. | 변경 필드만 최신 저장값에 병합, 다른 iframe 갱신 수신, 엔진 재적용 경계를 연결. 순차 stale write 회귀 검사; 다중 프로세스 동시 쓰기는 별도 조건으로 기록. |
| S-002 | P1 | 같은 서비스 load()는 손상된 JSON을 기본값으로 읽고 save()는 기존 raw/future schema를 보존하지 않는다. setter는 메모리를 먼저 바꾼 후 setItem을 호출한다. 저장 실패 후 상태 rollback/전용 안내가 없다. | 실패를 throw하고 저장 실패 안내, 이전 raw 보존, 미지원 schema 쓰기 차단, 손상 데이터 자동 덮어쓰기 금지, 설정 변경 취소/재시도 정의. |
| S-003 | P2 | SavedDocument에 배율/커서/스크롤/선택이 없다. 쪽/폭 맞춤은 settings에 있지만 숫자 배율은 viewport 메모리이다. | 한글의 문서/창/종료 수명 확인 후 해당 범위만 직렬화. 현재 임의로 선택/undo까지 재시작 복원하지 않음. |
| S-004 | P1 | 새 문서는 wasm.createNewDocument() 경로. 사용자 기본 양식/용지 설정 연결이 감사 범위에서 발견되지 않았다. | 사용자 기본 템플릿/용지 설정을 새 문서 생성 시만 적용. 기존 파일 열기 경로와 분리. 실제 한글 기대값 근거는 REF-NEWPAPER. |
| S-005 | P1 | 복구 SavedDocument에 원본 handle/hash가 없고 shell.newTab은 handle=null로 연다. 매번 다른 이름 저장을 안내한다. | 저장 handle과 마지막 확인 원본 hash를 복구 계약에 추가. 권한 재확인·외부 변경 검증 후만 재연결; 다운로드 모드 한계 표시. 통합 담당. |
| S-006 | P2 | store.documents는 getAll 결과(key 순서)를 그대로 반환. 생성 순서/사용자 탭 순서 필드가 없다. | 영구 탭 순서를 명시; 기존 레코드는 안정적인 이전 순서 정책. 복원 중 activeDocumentId가 각 newTab의 selectTab으로 갱신되는 것도 통합 검사. |
| S-007 | P1 | Studio 복구 enabled/interval/idle 설정과 shell의 1.4초 무조건 workspace snapshot은 별도 경로다. iframe은 skipRecovery=1로 시작한다. | 사용자에게 어떤 복구 정책인지 정확히 표시하고 중복 저장소/종료·버리기 정리 범위 확정. 설정을 끌 때 실제 모든 복구가 꺼졌다고 표시하지 않음. |
| S-008 | P1 | shell.persistTab의 api.recovery() 호출이 try/catch 밖이다. export/상태 수집이 throw하면 tab.persistError가 설정되지 않는다. | snapshot 수집부터 저장완료까지 오류 플래그/메시지를 일관 적용; close 중 안전성 검사. 통합 담당. |
| S-009 | P1 | tab.persist가 한 번 reject한 뒤 closeTab이 그 promise를 그대로 await한다. 저장/버리기 후에도 이전 실패로 닫기 동작이 멈출 수 있다. | 최신 미완료 쓰기와 과거 실패를 구분; 명시 discard 시 recoverystate 삭제, 실패 재시도와 단축키 닫기 검사. 통합 담당. |
| S-010 | P1 | WorkspaceStore.load는 root version만 확인하고 workspace/chat/문서 레코드 shape와 참조 정합성을 검사하지 않는다. | 손상 레코드 시 사용자 데이터를 그대로 두고 복구 가능 오류 표시. 초기화로 덮어쓰기 금지; future version migration 정책. 단일 current 객체 다중 창 stale write도 별도 검사. |

정적 근거 주요 위치: apps/editor/src/mvp/store.ts, model.ts, shell.ts의 newTab/persistTab/closeTab/switchWorkspace, mvp/editor-bridge.ts:open/recovery, upstream/rhwp-source/rhwp-studio/src/core/user-settings.ts:constructor/load/save와 main.ts:initializeDocument/createNewDocument.

## 첫 구현 범위

통합 담당의 H03 배정에 따라 B는 `apps/editor/src/preferences/*` 신규 모듈과 `tests/preferences*.test.ts`에서 S-001/S-002를 처리한다. upstream/.build/dist/model/store/shell은 직접 바꾸지 않는다. 실제 서비스 연결에 필요한 build transform과 이벤트 hook을 통합 담당에게 전달한다.

설정 병합은 같은 key를 무조건 덮어쓰는 현 결함을 줄이지만 브라우저 localStorage에 트랜잭션 CAS를 제공하지는 않는다. 동시 다중 프로세스 writer는 별도 직렬화 서비스가 필요한지 검사하며, 검증되지 않은 완전 원자성을 주장하지 않는다.
