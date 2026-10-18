# 합본110 파일 저장 검수 근거

공식 엔진117 `b20b9eb0ed097b92`, 프런트 `file-storage110`. 기존424개와 신규37개를 **한 번의461개 실행**으로 확인했고, 동일 엔진의 별도 구버전14개까지 **475/475** 통과했다. 전체 한글 동등성이나 파일 파트 상위10개 완료를 뜻하지 않는다.

| 근거 | 결과 |
| --- | --- |
| [통합](workflows/result.json) | 461/461, 실패0, 검사기 실행 중 변경0 |
| [구버전 표준 행](legacy14/result.json) | 14/14, 저장 보호 검사 checked, 전체 의미·지면 차이0 |
| [공식 Native](native25/proof/native-official117-result.json) | 25/25, ignore0, 컴파일된 공식 소스6파일 raw 지문 일치 |
| [Windows](windows/result.json) | 실제 생산 저장 계층11/11, 자체 임시 HWP/HWPX/HWT |
| [단·표 회귀](columns/result.json) | 24/24 |
| [실행 묶음](bundle/result.json) | 로컬 서버7/7, 사용자 API 연결 저장소 미사용 |
| `checks/unit1025.log.gz` | 1,025/1,025, skip0 |
| `checks/typescript.log.gz` · `checks/boundaries.log.gz` | 성공, diagnostics 없음 |
| [준비 소스](prepared-source-proof.json) · [독립 검토](independent-merged-source-review.json) | 병합13파일 exact, 다른 Rust1,065파일 불변, resource236 독립 재계산 일치 |

Native 결과 파일은 `native25/`에 원래 봉인된 상대 경로 구조를 유지한다. 원래 내부 manifest와 바깥 manifest는 서로 다른 범위를 검증한다. 이 검수에서는 Native25만 실제 실행했으며 전체 엔진 라이브러리 검사를 실행했다고 주장하지 않는다.

`before/`와 `private-preview-baseline/`에는 중복 표준 기록 유실, 이모지 미리보기 손실, 반복 HWT 편집 실패, 제한 환경의 Windows 교체 거부, DOM 타입 오류를 보존했다. 구버전14개 보고의 HWP descriptor 미검사 표기 정정 전 결과도 남겼다. 정정 뒤 최종 결과가 `legacy14/result.json`이다. 이 표기는 검사 조건을 바꾸지 않았다.

새37개는 HWT 작업13, 전체 앱/iframe/브라우저 사본7, 실제 Native adapter+합성 IPC10, 독립 CFB 원시 관측을 사용하는 실제 WASM 미리보기7이다. 실제 Windows 저장11개와 합성 Native 화면10개를 서로 대체하지 않는다. 실제 OS 파일 선택창·한글 재열기·전체 ACL/정전/디스크 장애 검수는 포함하지 않는다.

재현 명령은 `checks/run-workflows.py.gz`에 있다. CFB 관측기는 `apps/editor/scripts/prepare-preview-raw-auditor117.mjs`, 자체 구버전 입력은 `generate-legacy-stack-fixtures115.mjs`, 검사는 `verify-legacy-stack-storage115.mjs`로 재생성한다. 기준 엔진·원본·참조가 명시되지 않으면 해당 사례를 PASS로 세지 않는다. 공개 문서나 기존 한글 참조의 원본 바이트를 이 묶음에 추가하지 않았다.

이 폴더의 무결성 확인:

```powershell
C:/Python314/python.exe -X utf8 docs/evidence/file-completion-2026-10-18/storage110/verify.py
```

[남은 범위와 실행 방법](../../../123-current-stack-and-preview-storage.md). 다음 문서 시간 수명 계획은 `remaining/`에 있으며 이 합본의 구현 완료로 세지 않는다.
