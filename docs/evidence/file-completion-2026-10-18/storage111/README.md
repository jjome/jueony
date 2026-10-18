# 합본111: 새 문서 날짜와 파일 저장 회귀

공식118 `b443fe8f896f3e7b`, WASM `22679c4eed3efb564b6a1aa61cf34d1f5d8dfd842d10db08d72cde8debcf27f4`, 프런트 `file-storage111`.

| 실제 실행 | 결과 |
| --- | --- |
| [전체 파일·복구 회귀](workflows/result.json) | 461/461, 단일 실행36군 |
| [구버전 저장](legacy14/result.json) | 별도14/14 |
| [정확한 날짜 API](typed-time14/result.json) | 별도 실제 WASM14/14, 독립 CFB/OPF와 디스크16회 |
| [새 문서 앱](created12/result.json) | 별도 실제 전체 앱12/12, 오류·외부 요청0 |
| [합계](combined-summary.json) | 501/501; 단일501개 실행으로 표시하지 않음 |
| [공식 Native](native8/official-proof.json) | 회귀7 + 컴파일 소스 지문1 통과; ignore0 |
| [Windows](windows/result.json) · [단/표](columns/result.json) · [실행 묶음](bundle/result.json) | 11 / 24 / 7 통과 |
| 단위·TypeScript·모듈 경계 | 1,036개 / 통과 / 통과, 단위 skip0 |

[소스 대조](prepared-source-proof.json)는 추가·수정3파일이 정확하고 다른 Rust1,076파일이 불변임을 검사한다. 기존236개 물리 행 계산 입력은 모두 그대로다. 전체 ABI·WASM 지문은 별도다. Native8은 공식 소스를 직접 의존하는 외부 자체 harness이며 원본 소스/Cargo를 수정하지 않았다. 사전 Native6·7이나 중복 WASM14를 합산하지 않는다.

`created-compact/`는 원래15파일 봉인 구조를 유지한다. 초기 headless 실패와 해당 검사기 원문·준비 상태 및 SaveAs 이름 대화상자 누락의 스택을 포함한다. 같은 동결 앱에 실제 준비 확인·이름 승인을 수행한 최종12개가 `created12/`다. `before/missing-api117.json`은 기존 API 부재 대조군이며14개 결함이 발견됐다는 뜻이 아니다.

새 문서의 실제 복구 바이트와 dirty 열기를 확인했지만 이를 새 crash/IDB 검증이라고 주장하지 않는다. 기존461개 중 강제 종료·IDB 검사는 별도 기존 시나리오 그대로 실행했다. Native GUI·한글 비교는 하지 않았다.

```powershell
C:/Python314/python.exe -X utf8 docs/evidence/file-completion-2026-10-18/storage111/verify.py
```

[구현·한계·실행 방법](../../../124-new-document-time-storage.md). 자동 저장 시각·활성 편집 시간·인쇄 승인·Undo 독립 시간 수명은 이 합본의 완료 범위에 포함하지 않는다.
