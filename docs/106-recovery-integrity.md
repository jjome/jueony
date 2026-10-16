# 106. 복구본 무결성 및 강제 종료 복원

2026-10-16. [파일·저장·복구 작업표](features/05-files-storage-recovery.md)의 G101. [105번 저장 보강](105-file-storage-preservation.md)에 이어 복구 기록 자체의 손상을 점검한다.

## 구현

새 문서 복구본을 기록할 때 SHA-256을 함께 보관한다. 버전, 문서 ID, workspace ID, 파일 이름, dirty, checkpoint 시각, 바이트 길이와 실제 문서 바이트를 묶는다. 뷰와 파일 handle은 내용 지문에서 제외한다. 스크롤·배율·커서 등의 뷰 저장이 문서 바이트를 다시 내보내거나 checkpoint 시각을 바꾸지는 않는다.

| 경로 | 동작 |
| --- | --- |
| 복구본 쓰기 | 호출 시 structuredClone으로 고정하고 유효성 확인·해시 계산 후 기존 단일 저장 큐로 기록 |
| 복구본 열기 | 버전·알고리즘·해시·문서/업무/내용의 결합을 확인한 기록만 탭에 전달 |
| 바이트·메타데이터 손상 | 해당 복구본을 열지 않고 오류 표시, 기존 IDB 기록과 원본 파일 보존 |
| 지원하지 않는 지문 버전 | 구버전 취급으로 우회하지 않고 해당 기록 복원 거절 |
| 이미 손상된 지문이 있는 기록 | 해시를 새로 덮어써 정상 복구본으로 위장하지 않고 쓰기 거절 |
| 지문 없는 기존 복구본 | 기존 구조 검사를 유지하며 읽고, 다음 정상 복구 쓰기부터 지문 추가 |

Core에는 환경 중립적인 `RecoveryIntegrityPort`만 둔다. SHA-256 구현은 저장 adapter에 있고, shell에서 port를 주입한다. IDB 물리 envelope v1과 업무·채팅 자료는 변경하지 않는다. 손상된 복구본 하나가 정상 복구본이나 기존 기록의 복원을 막지 않는다.

이 지문은 우발적인 손상을 탐지하는 checksum이다. 전자서명·암호화·악의적인 변조 방지는 제공하지 않는다. 기존 지문 없는 복구본의 과거 무결성을 소급 증명하지 않으며, 지문을 기록하지 못하면 이전 복구본을 유지하고 저장 실패를 알린다.

## 검증

[검증 요약](evidence/recovery-integrity-2026-10-16/verification-summary.json): 편집기 단위 검사 812개, 실제 Edge 브라우저 검사 46개 통과. 브라우저 검사는 새 무결성·강제 종료 10개, 기존 저장/취소/실패 회귀 29개와 머리말/각주 상태 복원 회귀 7개다. TypeScript와 모듈 경계 검사도 통과했다. 105번의 전체 엔진 430개 회귀를 이번 프런트엔드에서 다시 실행한 것처럼 합산하지 않는다. 엔진은 동일한 검증된 06b338995d5e1d80을 재사용한다.

격리된 별도 Edge 프로필에서 HWP/HWPX 미저장 수정 → undo/redo → 실제 IDB checkpoint 확인 → `Browser.crash`로 테스트 브라우저 프로세스 강제 종료 → 같은 프로필 재실행 → 미저장 내용/dirty 복원 → 실제 UI 저장과 clean checkpoint까지 검사했다. 두 종료 모두 정상 종료 이벤트가 실행되지 않았으며, 원본 OPFS 파일은 저장 명령 전까지 동일했다.

복구 문서 바이트 한 개 변경, 문서 식별/이름 변경, 미래 지문 버전을 각각 주입해 해당 기록의 복원 거절과 원본 기록 보존을 확인했다. 정상 문서와 지문 없는 예전 복구본은 함께 열리고, 예전 복구본은 후속 편집·자동 복구 쓰기에서 새 지문을 얻는다. Node의 독립 SHA-256 구현으로 저장 지문을 대조했다.

첫 검수의 두 번째 문서는 이미 쪽 맞춤 상태라 같은 명령으로 뷰가 바뀌지 않았다. 검사기를 현재 맞춤 상태에 따라 100% 또는 쪽 맞춤으로 실제 전환하도록 고쳤다. 이후 최종 10개가 모두 통과했고 해당 실패 시도는 완료 수치에 포함하지 않았다.

## 실행과 남은 제한

`build/jueony-recovery-integrity-20261016/Start-Review.cmd` (4327), 프로필 `recovery-integrity`. `review-documents/recovery-integrity/`의 `recovered-saved-hwp.hwp`, `recovered-saved-hwpx.hwpx`가 실제 강제 종료 복원 후 저장한 자체 문서다. 기존 4326 실행본과 사용자 창은 유지한다.

이번 강제 종료는 격리된 테스트 브라우저 프로세스에 한정한다. Windows 전체 장애·전원 차단·디스크 손상 내구성, 실제 파일 선택창/권한/공유 잠금, 한글 2024 직접 재열기 검수는 남아 있다. 아직 checkpoint로 기록되지 않은 직전 편집까지 복원한다고 보장하지 않는다. 알려진 미지원 겹침 배치의 저장 차단도 그대로 유지한다.

재검사:

```powershell
$env:JUEONY_ENGINE_PACKAGE = 'build/rhwp-engine/source-06b338995d5e1d80/pkg'
$env:JUEONY_BUILD_PROFILE = 'recovery-integrity'
node apps/editor/scripts/build.mjs
$env:JUEONY_TEST_DIST = 'evidence/dist-recovery-integrity'
$env:JUEONY_TEST_OUTPUT = 'build/recovery-integrity-browser'
node apps/editor/scripts/verify-recovery-integrity.mjs
```

테스트 스크립트는 4433 포트가 점유되어 있으면 중단하며 기존 서버를 종료하지 않는다. 자체 Edge 프로필과 OPFS 파일만 사용하고 외부 네트워크/실제 LLM 요청은 수행하지 않는다.
