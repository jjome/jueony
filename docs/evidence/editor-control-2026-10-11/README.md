# 단축키와 구조 편집 검증 기록

2026-10-11, Windows / Node.js 22 / rhwp WASM 0.8.7 / 설치된 Microsoft Edge의 headless 모드. 합성 문서만 사용했다. 실제 기관 문서나 API 키는 포함하지 않는다.

검사 대상은 `863850f`의 단축키와 `971fb8e`의 구조 편집 구현 및 후속 서버 버전 가드다. 검사 당시 일부 문서와 시작 스크립트 변경이 커밋 전이므로 실행 증거의 `applicationSourceDirty: true`는 보존했다. 최종 실행 묶음의 정확한 소스 커밋과 파일 해시는 `build/jueony-mvp/bundle-evidence.json`에 별도로 기록한다.

| 파일 | 검증 내용 |
| --- | --- |
| editor-unit-tests.txt | 29개 통과. 실제 WASM의 표·서식·쪽 설정, HWP/HWPX 재열기, 대상 좌표 이동, 검증 거절, 키 resolver, 서버 버전 가드 포함 |
| server-tests.txt | 23개 통과. 로컬 API·credential 저장·제공자 계약 |
| mvp-results.json | 18개 통과. 독립 workspace/채팅, 지정 자료, 저장/재열기, 충돌/취소, 복원. 모델은 로컬 고정 응답 fixture |
| shortcuts-results.json | 9개 통과. 실제 Edge 키 입력과 문서 변화. 실제 물리 키나 Windows IME 검수는 아님 |
| document-control-results.json | 7개 통과. 동일 열린 문서 적용, 전체 사전 검증, 실패 복구, 요청 undo, revision 충돌. 이 브라우저 검사 자체는 HWPX 재열기이며 HWP/HWPX 양쪽 구조 재열기는 단위 검사에서 수행 |
| hyperclova-results.json | 실제 HCX-005 요청 1회로 4×3 표, 첫 행만 굵게/회색, 제목 16pt, A4 가로/20mm 적용. 구조 비교 및 요청 undo 검사 |
| live-diff.png | 실제 모델 적용 후 변경 확인 화면 |
| 실제-AI-일정표.hwp / .hwpx | 실제 모델이 편집한 동일 문서의 저장본. 한글 2024 독립 검수 대기 |

실제 API 검사의 초기 시도에서는 복잡한 함수 인수 schema 거절과 표 두 행을 꾸미는 모델 출력이 발생했다. HCX-005의 전송 계약을 `operationsJson`으로 단순화하고 범위를 시작+개수로 표현한 뒤, 첫 행뿐 아니라 나머지 행의 서식 보존도 확인했다. 이 폴더는 그 수정 후 최종 실행 증거다. 임의 요청에 대한 모델 정확도나 한글 전체 호환성을 증명하지 않는다.

## 재현

루트에서 `node --test apps/launcher/tests/*.test.mjs`, `apps/editor`에서 `node --experimental-strip-types --test tests/*.test.ts`를 실행한다. 이어 `node scripts/verify-shortcuts.mjs`, `node scripts/verify-document-control.mjs`, `node scripts/verify-mvp-isolated.mjs`를 실행한다. Node.js 22와 로컬 의존성 및 사전 빌드가 필요하다. 서버 테스트와 구조 편집 검사는 같은 검사 포트를 사용하므로 동시에 실행하지 않는다.

실제 과금 가능한 API 검사는 `apps/editor`에서 `node scripts/verify-control-live.mjs --live`로 명시적으로 실행한다. 기존 로컬에 저장된 HCX-005 연결을 사용한다. 자동 재시도하지 않는다.

## 한글 2024 검수

두 파일을 각각 열어 복구 경고 유무, 4×3 표와 모든 셀 내용, 첫 행만 굵게/회색인지, 제목 16pt, A4 가로와 20mm 여백을 확인한다. 각 파일을 한글에서 다시 저장하고 재열어 표와 쪽 배치가 유지되는지도 확인한다. 이 독립 검수는 아직 실행하지 않았다.
