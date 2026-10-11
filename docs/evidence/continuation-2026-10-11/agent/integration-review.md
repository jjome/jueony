# 반복 작업 / 사본 사전 검사 통합 읽기 검토

2026-10-11. C 담당은 제품 파일을 변경하지 않고 `src/macros/commands.ts`, `src/shell.ts`, `src/mvp/editor-bridge.ts`를 읽고 독립 메모리 probe를 실행했다. 최종 수정과 브라우저 검수는 통합 담당이 수행한다.

## 발견한 결함과 전달 사항

1. **서로 다른 기준 문단의 대상 합침**: 원래 두 문단이 같은 `제목` 문자열이고 각각 다른 문단 서식을 기록한 경우, 현재 문서에 그 문자열이 하나만 남으면 두 기준 ID가 모두 동일한 현재 ID로 매핑됐다. 독립 `captureTemplate`/`materializeTemplate` probe에서 `s0p0`, `s0p1`의 left/right 서식 명령이 모두 `s0p4`로 만들어지는 것을 재현했다. 원본 ID→현재 ID 대응은 일대일이어야 하므로 중복 도착 ID를 거절해야 한다. 통합 담당이 수정과 회귀 시험을 맡았다.
2. **HWPX 편집의 불필요한 HWP 변환**: non-create preflight가 항상 `staging.hwp`로 사본을 만든다. 이전 공개 표본 `python-hwpx-1`은 HWP 변환 시 끝 본문 문단이 2→3으로 변하지만 HWPX 동일 형식은 일치했다. 따라서 지원 가능한 HWPX 편집도 preflight의 본문 비교에서 거절된다. 원래 형식으로 사본을 만드는 것을 권장했다. 기존 증거는 `../../hangul-parity/2026-10-11-autonomous/engine/public-corpus-report.json`에 있다.
3. **저장 검사 표현 범위**: 검토 당시 사본 결과는 `contentLoss`만 확인하고 bytes를 재열기하지 않았다. 손실 보고 0이어도 구조 차이가 생긴 기존 공개 표본이 있으므로 이 경로를 저장 결과 재열기 검사로 표현하면 안 된다. 실제 재열기와 본문·표·서식 결과 비교를 추가하거나 검사 범위를 분명히 표시해야 한다.

## 확인된 안전 경계

- `HwpDocument.createEmpty()`를 현재 설치 엔진에서 직접 실행했다. section=1, paragraph=1, length=0이므로 새 초안의 사본 바탕으로 사용할 수 있다.
- 반복 작업은 현재 workspace에서만 나열되며 실행 전 workspace/chat/tab 일치를 다시 검사한다.
- replay는 변수를 문자열로 치환하고 공통 명령 스키마를 다시 검사한다. LLM이나 외부 네트워크를 호출하지 않는다.
- 원본 변경 전에는 별도 WASM 사본에서 명령을 실행하며 사본과 export artifact를 해제한다.
- 암호 문서는 `recoveryBytes`의 정책으로 preflight에서 거절되어 평문 자동 복구/사본 경로로 흘러가지 않는다. 이는 현재 암호 문서 AI/반복 편집의 기능 제한이기도 하다.
- 요청 ID 소모와 요청 snapshot undo를 재사용한다. 단, 실제 브라우저에서 macro apply/undo 및 실패 경로 검증은 통합 담당의 후속 범위다.

## 추가 회귀 권장

- 중복 도착 ID 매핑 거절, 명확한 단일 원문 재배치 허용.
- 매크로 1회 적용→1회 요청 undo, 사전 검사 실패→원본 무변경, workspace 전환 거절.
- HWPX 동일형식 사본과 결과 재열기 비교.
- 비동기 preflight가 도입되면 shell 실행 잠금은 await 전에 잡고, bridge.apply는 await 이후 busy/applying 상태도 재검사한다. 현재 구현의 preflight 본체는 동기이므로 일반 사용자 doubleclick 결함으로 실증한 사항은 아니다.

사용자 문서, API 키, 실제 모델, 사용자 서버 및 프로필을 사용하지 않았다. 한글 2024 독립 대조 완료를 주장하지 않는다.
