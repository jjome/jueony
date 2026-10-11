# 환경 설정 병합 모듈 구현 결과

2026-10-11. S-001/S-002 첫 수정. **순차적으로 오래된 iframe 설정이 다른 탭 값을 지우는 문제**를 대상으로 한다.

- `apps/editor/src/preferences/persistence.ts`: baseline과 변경 후 값의 필드 차이만 최신 저장 JSON에 적용한다. 중첩 객체는 필드별 병합, 배열은 하나의 사용자 변경 단위로 교체한다.
- `apps/editor/src/preferences/binding.ts`: 기존 설정 서비스의 load/replace와 storage 이벤트를 연결한다. 외부 갱신은 changedPaths를, 로컬 저장은 병합 과정에서 새로 받아 온 원격 필드만 changedPaths로 알린다.
- 기존 미인식 필드는 보존한다. 구버전 boot의 version 없는 JSON을 읽고 실제 변경 저장 시 version 1을 기록한다.
- JSON 손상/루트 타입 오류/미래·잘못된 version/읽기 실패는 기존 raw를 지우지 않는다.
- setItem 실패는 오류를 전달하고 설정 서비스 메모리를 마지막 성공 snapshot으로 되돌린다. 파일 편집 내용과 dirty에는 손대지 않는다.
- 여러 프로세스가 동시에 같은 localStorage 값을 읽고 쓰는 경우의 원자성은 보장하지 않는다. API가 CAS를 제공하지 않으므로 향후 단일 설정 작성 서비스/비동기 lock 도입 검사를 별도로 남긴다.

## 검증

- `node --experimental-strip-types --test apps/editor/tests/preferences-persistence.test.ts`: **25개 통과, 실패 0**.
- 두 source 모듈만 대상으로 TypeScript strict / ES2022 / DOM typecheck: **통과**.
- 실제 build 변환/renderer/UI 연결과 브라우저 회귀는 통합 담당이 수행한다. 이 결과는 실제 한글 비교가 아니다.
- 모듈 검사 중 사용자 프로필/IndexedDB/4173 서버/원본 HWP는 읽거나 수정하지 않았다. 테스트는 메모리 저장소를 사용한다.

## 통합 hook 계약

기존 UserSettingsService의 constructor에서 this.data를 load한 뒤 bindPreferencesPersistence를 생성한다. load callback은 기존 load()를 호출, replace callback은 this.data를 교체, save()는 binding.save(this.data)를 호출한다. 외부 storage 수신은 settings의 key 또는 clear 이벤트만 처리한다.

renderer는 `jueony:preferences-changed`에 `{source,value,changedPaths}`를 받아 변경된 보기/글꼴/테마/복구 정책을 적용한다. local commit의 changedPaths가 비어 있으면 기존 local command가 화면 적용을 담당한다. 새로 병합한 remote 필드가 있을 때만 재적용한다. 재적용 중 UserSettings setter를 반복 호출하여 이벤트를 순환시키지 않는다.

`jueony:preferences-error`의 message를 화면에 표시한다. 초기 loader의 손상 fallback이 조용히 넘어가지 않도록 UI listener를 등록한 후 public refreshFromStorage()에서 binding.refresh()를 한 번 호출한다.

baseline raw를 초기화하거나 사용자 저장소를 자동 삭제하는 경로는 없다.
