# 한글 동작·상태 저장 기반 자율 구현 결과

2026-10-11. 통합 담당 1명과 기능/단축키·상태·엔진 담당 3명이 병렬 조사한 뒤, 확인된 기반 결함을 수정했다. 기준 commit은 `e53e3e4`, rhwp 소스는 `1a76570e833917d15817415a53c09ad61ab3203f`, 엔진은 `@rhwp/core@0.8.7`이다. Rust/WASM 엔진 자체는 교체하지 않았다.

## 실제 바뀐 동작

- 표에서 F5 셀 블록 뒤 F7은 칸 전체, F8은 줄 전체를 선택한다. 본문 F7 편집 용지는 유지한다. 선택만 바뀌며 dirty/revision/저장 bytes는 바뀌지 않는다.
- Ctrl+F1 도구상자 명령을 복구했다. Ctrl+F 탐색은 미지원으로 안내하고 찾기는 Ctrl+Q,F로 구분했다. 빈 실행 함수였던 셀 높이·너비 같게는 미지원으로 표시하고 실행을 차단했다.
- 기존 Studio 환경 설정 저장에 변경 필드 병합과 탭 간 갱신을 연결했다. 오래된 다른 탭에서 설정을 바꿔도 먼저 바꾼 문단 부호·도구상자 등이 사라지지 않는다. 손상되거나 더 새로운 설정은 자동 덮어쓰지 않으며 오류를 표시한다.
- 열었던 문서 순서·활성 문서와 업무 패널 표시를 복원한다. 기존 문서 레코드는 유지하고 선택적 필드만 추가했다.
- 브라우저 파일 handle과 마지막 디스크 SHA-256을 함께 보관한다. 복원 때 권한과 원본 hash가 맞으면 원본에 다시 연결한다. 권한이 필요하면 `원본 다시 연결` 버튼을 제공한다. 외부 변경·삭제·다른 문서로 교체는 기존 파일에 잘못 덮어쓰지 않도록 차단한다. 미저장 복구 bytes를 디스크 원본 hash로 오인하지 않는다.
- 복원 실패 문서는 기존 복구본을 보존하고 정상 문서는 계속 연다. 잘못된 문서 ID 등은 업무의 탭 순서를 오염시키기 전에 거부한다. 잘못된 업무 구조·다른 업무 채팅 참조·미래 schema는 UI 쓰기를 막고 원본 DB를 보존한다.
- 복구 export가 내용 손실을 보고하면 이전 정상 복구본을 유지하고 오류를 알린다. 암호 문서는 평문 자동 복구 export를 금지하며, 보호로 전환하기 전의 평문 복구 레코드도 제거한다. 원본 암호 파일은 이 동작으로 수정하지 않는다.
- 복구 저장 실패가 닫기 재시도를 영구히 막던 경로를 고쳤다. 진행 중 저장·삭제와 설정 저장 오류도 종료 경고에 반영한다.

## 점검 범위와 결과

| 검사 | 결과 | 한계 |
|---|---|---|
| 편집기 단위 검사 | 112/112 통과 | 데이터 계약·단축키·엔진 검사를 포함하며 물리 IME 대조는 아님 |
| 런처·공급자 기준 검사 | 43/43 통과 | 기존 공급자 adapter 회귀; 새 실모델 호출은 없음 |
| TypeScript 및 격리 프런트엔드 빌드 | 통과 | 기존 사용자 앱의 dist와 서버를 교체하지 않음 |
| 상태 저장 브라우저 검사 | 14/14 통과 | 새 Edge 프로필·OPFS 파일 handle 사용; Windows 실제 파일 선택기 검수는 별도 |
| 단축키 브라우저 검사 | 8/8 통과 | 실제 엔진·셀 DOM·bytes 비교; 한글 편집기/물리 키 전달은 미검증 |
| 기존 AI 업무 흐름 회귀 | 19/19 통과 | 로컬 결정적 LLM 응답으로 작성·다중 편집·undo·실제 HWP 다운로드·재열기·자료 범위·재시작 검증 |
| 공개 문서 5개 × HWP/HWPX | 4개 내용 비교 통과, 1개 차이 | python-hwpx 표본의 HWP 추가 끝 문단 차이 재현. 레이아웃·독립 한글 호환성 PASS 아님 |

암호 검사에서는 실제 core의 차단 경계를 단위 검사하고, 브라우저에서는 동일 오류 신호를 주입해 이전 평문 레코드 삭제와 일반 복구 재개를 검증했다. 실제 암호 한글 문서의 UI 저장/재열기를 수행했다고 보고하지 않는다. 저장소 실패·손실 보고도 의도적으로 주입한 회귀 항목을 포함한다.

[실행 기준](evidence/hangul-parity/2026-10-11-autonomous/reference/manifest.json), [통합 검사](evidence/hangul-parity/2026-10-11-autonomous/integration/), [단축키 감사](evidence/hangul-parity/2026-10-11-autonomous/behavior/behavior-audit.md), [상태 감사](evidence/hangul-parity/2026-10-11-autonomous/state/README.md), [공개 표본 결과](evidence/hangul-parity/2026-10-11-autonomous/engine/public-corpus-report.json)에 근거를 저장했다. 각 검사 JSON의 build hash로 검사 당시 소스를 구분한다.

## 한글 동등성 판정

[기능 목록](hangul-2024-feature-audit.csv)은 공식 한글 도움말에서 출발한 **1차 182개 기능 묶음**이다. 71 WIRED / 33 PARTIAL / 4 STUB / 74 MISSING이며 WIRED는 코드가 연결됐다는 뜻이다. 대화상자 세부 탭·우클릭·입력 상태별 변형까지 전부 열거한 최종 분모가 아니며, 182개 중 몇 %가 한글과 같다는 식으로 환산하지 않는다.

[상태 계약](editor-state-contract.csv)은 S01~S22의 32개 필드 묶음과 해당 감사 시점의 저장 경로다. 이번 수정 결과는 위 변경 목록과 통합 증거로 함께 읽는다. 참조 동작을 아직 관찰하지 않은 항목은 그대로 미검증으로 남겼다.

현재 PC에서는 한컴오피스 **2024 뷰어 13.0.0.387**만 발견됐다. 편집기와 나란히 동작을 비교하지 못했고, 이 세션에는 Windows Computer Use에 필요한 node_repl 도구도 노출되지 않았다. 뷰어가 설치됐다는 사실만으로 재열기/렌더링 성공을 선언하지 않는다. 실제 한글 비교는 `BLOCKED_REFERENCE`다.

G0/G1은 기준·초기 조사 산출물을 확보한 상태이며 전수 대조 완료는 아니다. H03의 확인된 결함 수정과 H04 자동 검수 일부를 마쳤다. 실제 한글 대표 검수를 포함한 **G2는 아직 통과하지 않았다**. 따라서 새 인증·RAG·loop·매크로 구현으로 넘어가지 않았다. 기존 Claude/API 편집 기능은 유지했다.

## 실행과 다음 검수

준비한 실행 묶음: `build/jueony-parity-20261011/`.

- `Start-Parity-Review.cmd`: 새 검수 버전을 4190 포트에서 실행한다. 실행 중인 4173 버전과 업무 저장소가 다르므로 처음에는 새 업무가 보인다. 기존 업무가 삭제된 것이 아니다.
- 검수용 복사 문서를 열어 F5/F7/F8, 도구상자, 두 문서의 보기값, 닫기·재실행, 원본 변경 충돌을 확인한다.
- `review-documents/`의 HWP/HWPX 저장 결과는 실제 한글 편집기에서 열어 표/쪽/글꼴/줄바꿈/개체를 대조할 수 있도록 준비했다. 공개 원본과 파생 파일은 Git에 넣지 않았다.
- 기존 4173 앱·문서·API 키를 자동 재시작/교체하지 않았다. 검수본은 별도 실행 후 필요한 문서를 직접 열어 사용한다.

재현 명령(저장소 루트에서):

```powershell
Set-Location apps/editor
$env:JUEONY_BUILD_PROFILE = 'parity'
node scripts/build.mjs
node --experimental-strip-types --test tests/*.test.ts
.\node_modules\.bin\tsc.cmd --project .build/studio-parity/tsconfig.json --pretty false
node scripts/verify-parity-state.mjs
node scripts/verify-parity-shortcuts.mjs
$env:JUEONY_TEST_DIST = Join-Path (Get-Location) 'evidence/dist-parity'
$env:JUEONY_TEST_EVIDENCE = 'evidence/parity-mvp'
node scripts/verify-mvp-isolated.mjs
```

공용 build는 한 번 만든 뒤 고정하고, 상태·단축키·MVP 검사는 각각 4198·4199·4202를 사용한다. 상태/단축키 검사는 합성 자료와 새 브라우저 프로필만 사용한다. 실제 한국어 IME·물리 단축키·한글 인쇄/레이아웃·모니터/DPI·원본 Windows 권한 대화상자 검수는 다음 환경 검수로 남는다.

다음 우선순위는 실제 한글 2024 편집기를 기준으로 T01~T16과 대표 문서를 대조하고, 새 문서 기본 용지/스타일, 수치 배율·커서 복원 수명, F3 선택 단계와 머리말/쪽번호·표 균등 기능의 차이를 확정하는 것이다. 한글 전체 기능 구현이나 100% 호환 완료로 보고하지 않는다.

## 이후 진행

이 문서는 첫 기반 수정 시점의 결과다. 사용자의 추가 진행 지시 이후 독립 기능을 보강한 결과는 [28번 문서](28-continuation-implementation.md)에 있다. Ctrl+F 탐색과 제한된 표 균등, 새 문서 기본값/문서별 보기, 통합 UI와 검색/검토/매크로는 이후 구현됐고 실제 한글 비교 대기는 유지된다.
