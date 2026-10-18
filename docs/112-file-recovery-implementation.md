# 파일·저장·복구 구현 보강과 Agent 저장 연결

2026-10-18. 사용자 컴퓨터의 창·입력장치·한글을 조작하지 않고 구현과 격리 자동 검수를 진행했다.

| 항목 | 구현 | 자동 검증 | 직접 비교 |
| --- | --- | --- | --- |
| XML 작업 복구 | 업무·독립 창별 원문/XSD/현재 내용/Undo·Redo 보관, 명시적 복원·폐기 | 단위9, 실제 IndexedDB와 화면 없는 Edge13 | 사용자 요청으로 보류 |
| XML 저장 충돌·실패 | SHA-256 무결성, 원자 CAS, strict transaction 완료 후 확인, 실패 시 편집 유지·재저장 | 동시 창·손상·쓰기 실패·다시 열기 포함 위 검사에서 확인 | OS·한글 검수와 구별 |
| 최근 문서 목록 | 읽기와 같은 1MiB 상한을 쓰기 전 검사, 이전 목록 보존 | Windows library32, Node33의 관련 범위 | 사용자 요청으로 보류 |
| Native 저장 취소 | Blob 준비 중 취소 후 쓰기0, 중복 close/쓰기 거절, 이미 보낸 IPC의 거짓 취소 성공 방지 | 실제 재현 before1→after0, 전용 경합 검사 | 실제 파일 선택창 검수와 구별 |
| Agent 원본 저장 | 승인된 현재 활성 파일 연결만 저장. 버전·문서·연결 CAS, 기존 전체 의미/지면 보호·기록 후 재읽기, 잠금 유지 | HWP/HWPX 양형식 포함 합성 모델/Native IPC의 실제 앱 흐름15 | 실제 OS·실제 모델 API 검사와 구별 |
| 실패 표시 | 저장 부분 실패·원복·충돌을 늦은 취소가 덮어쓰지 않음 | 늦은 취소 단위2와 파일 거절/부분 실패 단위 | 직접 비교 보류 |
| 합본 회귀 | 최종89 소스의 전체 단위970/970·skip0(Node22/24), 타입·모듈 경계 | 한 번의 같은 빌드 통합 실행13군149/149, 변경 전후 실패 근거 별도 보존 | 전체 한글 호환률을 뜻하지 않음 |

## 변경 범위

XML 복구는 기존 한글 문서와 다른 IndexedDB object store를 사용한다. Rust가 확인한 독립 창 scope와 현재 workspace ID로 키를 나누며, 다른 업무의 복구본을 자동으로 읽지 않는다. 복원 전에 스키마와 모든 Undo/Redo 항목을 다시 검사한다. 복구본은 로컬 데이터이며 원본 XML 파일 저장이나 원본 HWP 변경을 뜻하지 않는다. 브라우저 데이터 삭제·다른 origin·다른 실행 포트 간 이관은 제공하지 않는다.

다른 창이 먼저 저장했거나 복구본이 손상되면 자동 덮어쓰기를 거절한다. 현재 편집은 유지하고 사본 내보내기를 제공한다. 저장 실패 뒤에는 ‘복구본 다시 저장’을 사용할 수 있다. 명시적으로 작업을 폐기할 때만 해당 토큰의 복구본을 삭제한다. schema는 기존 local sequence 프로필을 유지하며 HWT/XSL/일반 XSD 지원으로 확대하지 않는다.

최근 문서 목록은 큰 registry를 교체해 놓고 다음 읽기에서 거절하던 결함을 고쳤다. 이미 손상되거나 상한을 넘은 예전 목록을 임의로 잘라 복구했다고 표시하지 않는다. Native sink는 IPC 전송 전 취소와 이미 디스크 커밋이 시작된 요청을 구분한다. 전송 후 취소는 실패로 표시하고 원래 저장 결과를 기다린다.

## Agent 저장 계약

자연어로 ‘현재 문서를 저장해 줘’라고 요청하면 모델은 단독 `save_active_document` 명령과 조회한 `contextStamp`만 제출한다. 경로·파일 핸들·형식·비밀번호를 모델에 주지 않는다. 현재 문서의 기존 연결과 쓰기 권한이 있어야 하며 새 문서의 최초 저장·다른 이름 저장·파일 선택창은 사용자 UI에서 수행한다. 편집 요청 뒤 임의로 저장하지 않도록 제공자 공통 지침에 명시했다.

저장 중 모든 편집 잠금을 유지한다. 내부 저장 준비만 비공개 authority로 허용하고, 본문 편집·열기·다른 탭의 변경에는 이 권한을 사용하지 않는다. 기존 저장과 동일한 의미·전체 지면 검사, 원본 변경 거절, 버전 검사, 파일 기록과 재읽기를 통과해야 완료 receipt를 낸다. 사용자 편집이 모델 응답보다 먼저 도착하면 원본 쓰기 전에 거절한다. 쓰기 후 오류나 취소는 부분 실패로 표시하며 ‘변경 없음’으로 덮지 않는다. iframe의 쓰기 전 거절 오류도 다른 Error realm 때문에 부분 실패로 오인하지 않도록 고쳤다. 저장은 파일에 대한 효과이므로 문서 편집 Undo로 디스크까지 되돌렸다고 표시하지 않는다.

## 아직 구현·검수가 남은 범위

| 구분 | 남은 내용 |
| --- | --- |
| 파일 Agent 확장 | OS 열기·최근 문서·SaveAs·dirty 폐기·프로그램 종료는 아직 Agent 명령이 아님. 현재 활성 연결 저장과 탭 명령만 지원 |
| 형식 변환 | 명시 `textDir`의 HWP5 매핑 근거 미확정. XML 정확 보존과 HWP 쓰기 전 손실 차단 유지 |
| 초기 조판 | MCST·Python3의 미수록 기호에 대한 실제 fallback 선택 미확정. 폰트 폭 추정이나 clean 원시 행 강제 변경을 하지 않음 |
| XML 확장 | HWT 서식·한글 필드 매핑·XSL·일반 XSD·XML Agent는 미지원 |
| 직접 비교 | 사용자가 컴퓨터를 사용하는 동안 Windows·한글 조작 및 비교를 실행하지 않음 |

이 기록은 **구현 묶음의 완료**이며 파일 파트 전체나 한글2024 전체 동등성의 완료 선언이 아니다. 미검증을 완료로 바꾸지 않는다. 기존 엔진86과 복잡 원본의 보호 조건은 유지한다.

## 재현과 실행

저장소 상단 **`Start-Jueony-FileReview.cmd`**로 새 묶음을 실행한다. 실제 위치는 `build/jueony-file-review89/Start-Jueony.cmd`이며4357 포트다. LLM 백엔드와 provider adapter를 포함한다. 기존 창·서버·이전 묶음은 바꾸거나 종료하지 않았다. 이전 포트의 업무·연결·복구본을 새 origin으로 자동 이관하지 않는다.

`build/native-file-final89-20261018/JueonyNativeFinal89Review.exe`도 빌드했지만 **API backend가 없는 별도 파일 검수용 preview**이며 실행하지 않았다. 새 Native 코드는 이전 실행파일과 별개로 컴파일했다. 예전 실제 Windows 검수를 이 실행본에 소급하지 않는다.

```powershell
$env:JUEONY_ENGINE_PACKAGE='build/rhwp-engine/source-b59322fd380dc175/pkg'
node --experimental-strip-types --test apps/editor/tests/*.test.ts
$env:JUEONY_TEST_OUTPUT='C:/Users/jjome/Documents/work/jueony/build/xml-recovery-review'
node apps/editor/scripts/verify-xml-recovery.mjs
# 모든 파일/복구 사례를 새로 실행할 때(격리 headless, 실제 한글 아님)
python scripts/verify_file_workflows.py --engine <절대-pkg-경로> --dist <절대-dist-file-agent-final89-경로> --output <새-절대-출력경로> --node <node.exe-경로> --workers 1
```

[최종89 합본·SHA manifest](evidence/file-completion-2026-10-18/agent-final89/README.md) · [앞선 복구87 근거](evidence/file-completion-2026-10-18/recovery87/README.md) · [파일 기능별 작업표](features/05-files-storage-recovery.md) · [기존 엔진86 검수](111-file-storage-final-review.md).

앞선88의149개는 공통 통과군과 Agent15·XML 통합7의 재검수를 묶은 결과였고, **최종89에서는149개 전체를 새로 한 번에 실행해 통과**했다. 처음148 실행은 XML 통합 테스트가 새 복구 선택 단계를 처리하지 않아 실패했다. 새 계약에 맞춰 실제 복원·확인 폐기·사본 재열기를 검사했고, production 보호 검사를 완화하지 않았다. 첫 타입 오류와 fixture의 잘못된 CAS 토큰 비교도 원래 실패로 보존한다.
