# 업무 저장소 검증 결과와 복원 중단 조건

2026-10-11. S-010 수정. `mvp/store.ts`는 IndexedDB state/current의 원문을 `validateAppState`로 검사한 뒤에만 중단된 실행을 interrupted로 전환한다. 검증기는 입력 객체를 변경하거나 DB에 쓰지 않는다.

## 복원을 중단하는 조건

- root가 null/원시값/배열이거나 version이 숫자 1이 아님.
- workspaces/chats/folders/runs/models 또는 채팅 messages가 배열이 아님.
- 같은 컬렉션의 id가 비어 있거나 중복됨. 메시지 id는 채팅 안에서만 중복 검사.
- 표시/실행에 필요한 문자열·숫자·enum의 타입이 잘못됨. NaN/Infinity/음수 크기, 잘못된 run.status/provider 방식, boolean 대신 문자열, 중복 documentOrder 등.
- 채팅/폴더/실행이 존재하지 않는 workspace를 참조함.
- workspace.activeChatId가 없거나 다른 업무의 채팅을 가리킴. 없는 채팅을 자동 생성하거나 잘못된 참조를 조용히 고치지 않는다.
- 실행의 chatId가 없거나 다른 업무에 속함. 메시지가 실제 존재하는 run을 가리키면서 업무/채팅이 다름.
- 폴더 handle이 directory/name/entries를 가진 디렉터리 handle 형태가 아님. 권한 검사는 호출하지 않는다.
- receipt가 해당 runId와 다르거나 UI에서 사용하는 필수 구조 배열/속성 객체가 없음.

오류에는 필드 경로만 포함하고 채팅 내용·설정값·자료 이름을 포함하지 않는다. “기존 데이터를 삭제하거나 초기화하지 않았다”는 안내를 반환한다. 복원 실패 시 앱 UI에서 자동 초기화하거나 저장하지 않아야 하며 수동 복구를 위한 DB 원문은 그대로 유지된다.

## 허용하고 보존하는 경우

- state/current 레코드 자체가 존재하지 않아 request 결과가 undefined이면 최초 실행의 initialState를 만든다. **저장값 null과 없는 레코드를 구별한다.**
- 기존 version 1 데이터에 agentWidth/sidebarHidden/documentOrder/원본 연결 등 새 선택 필드가 없어도 통과한다.
- 알 수 없는 추가 필드, FileSystemDirectoryHandle 원래 참조는 삭제하거나 JSON 복제하지 않는다.
- activeWorkspaceId가 없는 workspace를 가리키면 기존 shell.start의 첫 업무 fallback에 맡긴다.
- activeDocumentId/documentOrder의 문서 ID가 실제 documents 저장소에 있는지는 이 검증기에서 확인하지 않는다. 개별 문서 복구 경계에서 처리하여 손상된 문서 하나가 모든 workspace를 막지 않게 한다.
- 이미 삭제된 모델 선택 ID와 없는 과거 run ID를 가진 메시지는 허용한다. **참조 대상 run이 실제 존재하면** 업무 경계를 검사한다.
- 폴더 접근 권한이 취소되었어도 handle 형태가 유효하면 복원한다. 실제 접근 시의 재인증은 기존 permission 경로에 맡긴다.
- undo 구조가 기록되지 않던 옛 receipt는 허용한다. 구조 정보가 존재하면 필수 UI shape만 검사한다.

## 검증

- `node --experimental-strip-types --test apps/editor/tests/workspace-state.test.ts`: **21개 통과, 실패 0**.
- store/validator strict TypeScript 검사: 통과.
- 이 검사는 순수 상태 객체와 메모리의 handle 대역을 사용한다. 실제 사용자 DB 읽기·변경은 없었다.
- 실제 IndexedDB 읽기 → throw → 원문 보존 및 브라우저 UI 복원 검사는 통합 담당에게 전달했다.
