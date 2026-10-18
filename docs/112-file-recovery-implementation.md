# 파일·저장·복구 구현 보강

| 항목 | 구현 | 자동 검증 | 직접 비교 |
| --- | --- | --- | --- |
| XML 작업 복구 | 업무·독립 창별 원문/XSD/현재 내용/Undo·Redo 보관, 명시적 복원·폐기 | 단위9, 실제 IndexedDB와 화면 없는 Edge13 | 사용자 요청으로 보류 |
| XML 저장 충돌·실패 | SHA-256 무결성, 원자 CAS, strict transaction 완료 후 확인, 실패 시 편집 유지·재저장 | 동시 창·손상·쓰기 실패·다시 열기 포함 위 검사에서 확인 | OS·한글 검수와 구별 |
| 최근 문서 목록 | 읽기와 같은 1MiB 상한을 쓰기 전 검사, 이전 목록 보존 | Windows library32, Node33의 관련 범위 | 사용자 요청으로 보류 |
| Native 저장 취소 | Blob 준비 중 취소 후 쓰기0, 중복 close/쓰기 거절, 이미 보낸 IPC의 거짓 취소 성공 방지 | 실제 재현 before1→after0, 전용 경합 검사 | 실제 파일 선택창 검수와 구별 |
| 회귀 | 같은 소스의 전체 단위945/945·skip0, 타입·모듈 경계, 기존 XML13 통과 | 변경 전후 실패 근거 별도 보존 | 전체 한글 호환률을 뜻하지 않음 |

## 변경 범위

XML 복구는 기존 한글 문서와 다른 IndexedDB object store를 사용한다. Rust가 확인한 독립 창 scope와 현재 workspace ID로 키를 나누며, 다른 업무의 복구본을 자동으로 읽지 않는다. 복원 전에 스키마와 모든 Undo/Redo 항목을 다시 검사한다. 복구본은 로컬 데이터이며 원본 XML 파일 저장이나 원본 HWP 변경을 뜻하지 않는다. 브라우저 데이터 삭제·다른 origin·다른 실행 포트 간 이관은 제공하지 않는다.

다른 창이 먼저 저장했거나 복구본이 손상되면 자동 덮어쓰기를 거절한다. 현재 편집은 유지하고 사본 내보내기를 제공한다. 저장 실패 뒤에는 ‘복구본 다시 저장’을 사용할 수 있다. 명시적으로 작업을 폐기할 때만 해당 토큰의 복구본을 삭제한다. schema는 기존 local sequence 프로필을 유지하며 HWT/XSL/일반 XSD 지원으로 확대하지 않는다.

최근 문서 목록은 큰 registry를 교체해 놓고 다음 읽기에서 거절하던 결함을 고쳤다. 이미 손상되거나 상한을 넘은 예전 목록을 임의로 잘라 복구했다고 표시하지 않는다. Native sink는 IPC 전송 전 취소와 이미 디스크 커밋이 시작된 요청을 구분한다. 전송 후 취소는 실패로 표시하고 원래 저장 결과를 기다린다.

## 아직 구현·검수가 남은 범위

| 구분 | 남은 내용 |
| --- | --- |
| 파일 Agent | 현재 연결된 활성 문서 저장을 안전한 명령 계층으로 연결하는 후속 구현 중 |
| 형식 변환 | 명시 `textDir`의 HWP5 매핑 근거 미확정. XML 정확 보존과 HWP 쓰기 전 손실 차단 유지 |
| 초기 조판 | MCST·Python3의 미수록 기호에 대한 실제 fallback 선택 미확정. 폰트 폭 추정이나 clean 원시 행 강제 변경을 하지 않음 |
| XML 확장 | HWT 서식·한글 필드 매핑·XSL·일반 XSD·XML Agent는 미지원 |
| 직접 비교 | 사용자가 컴퓨터를 사용하는 동안 Windows·한글 조작 및 비교를 실행하지 않음 |

이 기록은 **구현 묶음의 완료**이며 파일 파트 전체나 한글2024 전체 동등성의 완료 선언이 아니다. 미검증을 완료로 바꾸지 않는다. 기존 엔진86과 복잡 원본의 보호 조건은 유지한다.

## 재현과 실행

현재 단계는 소스·자동 검수 반영이다. 이전86 실행본에 이 변경이 들어 있다고 표시하지 않는다. 후속 Agent 연결을 합친 실행 묶음을 따로 준비한다.

```powershell
$env:JUEONY_ENGINE_PACKAGE='build/rhwp-engine/source-b59322fd380dc175/pkg'
node --experimental-strip-types --test apps/editor/tests/*.test.ts
$env:JUEONY_TEST_OUTPUT='C:/Users/jjome/Documents/work/jueony/build/xml-recovery-review'
node apps/editor/scripts/verify-xml-recovery.mjs
```

[근거·SHA manifest](evidence/file-completion-2026-10-18/recovery87/README.md) · [파일 기능별 작업표](features/05-files-storage-recovery.md) · [기존 엔진86 검수](111-file-storage-final-review.md).
