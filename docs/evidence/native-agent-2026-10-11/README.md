# 제공자·Agent·공개 문서 검사 기록

2026-10-11, Windows, Node.js 22, Edge 155, @rhwp/core 0.8.7. 테스트 브라우저는 사용자 프로필과 분리했다. DPAPI 검사는 임시 저장소와 가짜 키만 사용했다.

| 검사 | 결과 | 기록 |
|---|---:|---|
| 앱·WASM 단위/회귀 | 42 통과 | `editor-tests.txt` |
| 로컬 API·암호화·제공자 단위 | 37 통과 | `launcher-tests.txt` |
| GPT/Claude/Gemini 설정·실제 편집 UI·임시 첨부 | 9 시나리오 통과 | `native-ui.json` |
| 기존 OpenAI 호환 업무 흐름 | 19 시나리오 통과 | `mvp-compatible.json` |
| CLOVA HCX-007 합성 업무 흐름 | 20 시나리오 통과 | `mvp-hyperclova.json` |
| CLOVA 키 저장/회전/삭제 UI | 6 시나리오 통과 | `connections.json` |
| 한글 단축키 브라우저 | 9 통과 | `shortcuts.json` |
| 표·서식·쪽 설정·실패 복원 UI | 7 통과 | `document-control.json` |
| 공개 문서 UI | 5개 열기 통과, 4개 셀 편집/undo 통과 | `public-browser.json` |
| 공개 문서 엔진 무수정 저장 | 4 PASS_CONTENT / 1 REVIEW_REQUIRED | `public-roundtrip.json` |
| TypeScript / production build | 통과 | `typecheck.txt`, `build.txt` |

native UI의 16번 모델 요청은 전부 로컬 fixture다. 세 제공자의 **실제 계정 호출은 키가 없어 미검증**이다. fixture는 인증 헤더·URL·모델 선택·응답 변환·거부·편집 연결을 확인하며 자연어 품질이나 해당 계정의 모델 권한을 입증하지 않는다. 일반 API가 실제 기관망에서 연결되는지도 별도다.

공개 표본의 출처/다운로드 실패/SHA-256은 `public-sources.json`에 있다. 엔진의 content-loss 0과 실제 텍스트 비교를 구분했다. note_example의 HWP 결과는 끝 빈 문단 한 개 증가로 별도 검수 판정이다. 원본·저장 파일·공개 자료 화면 캡처는 `.tools/public-documents`에만 있고 Git/배포 묶음에는 포함하지 않는다. [독립 한글 검수 절차](../../21-public-document-validation.md).

새 기능 검사 재실행:

```powershell
# root (Node.js 22)
node --experimental-strip-types --test apps/editor/tests/*.test.ts
node --test apps/launcher/tests/*.test.mjs
# apps/editor
node scripts/verify-native-providers.mjs
node scripts/verify-connections.mjs
node scripts/verify-mvp-isolated.mjs
$env:JUEONY_TEST_ADAPTER='hyperclova'
node scripts/verify-mvp-isolated.mjs
Remove-Item Env:JUEONY_TEST_ADAPTER
node scripts/verify-shortcuts.mjs
node scripts/verify-document-control.mjs
node scripts/verify-public-browser.mjs
```

public-browser는 다운로드 스크립트를 먼저 실행해야 한다. 검증 스크립트의 지정 로컬 포트가 사용 중이면 다른 프로세스를 임의 종료하지 않고 실패한다. 단축키 검사는 브라우저 이벤트이며 물리 Windows 예약키 전달, 실제 IME의 모든 조합, 실제 한글 시각/인쇄 호환성은 별도다.

실제 문서 적용에는 요청 단위 snapshot undo와 실패 rollback이 동작한다. 재시작 뒤 복합 undo·강제 종료 직전 durability·전체 고급 개체 보존은 아직 완료되지 않았다. RAG와 bounded loop는 설계 산출물이며 위 통과 수에 구현 검사로 포함하지 않았다.
